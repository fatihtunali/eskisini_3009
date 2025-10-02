const express = require('express');
const { pool } = require('../db.js');
const { authRequired } = require('../mw/auth.js');
const notificationService = require('../services/notifications.js');

console.log('Loading OpenAI moderation service...');
const { moderateContent } = require('../services/openai-moderation.js');
console.log('OpenAI moderation service loaded');

const router = express.Router();

// Admin authentication middleware
const adminRequired = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ ok: false, error: 'authentication_required' });
    }

    // Check if user is admin using email-based authentication
    const [rows] = await pool.query('SELECT email FROM users WHERE id = ?', [req.user.id]);

    if (!rows.length) {
      return res.status(403).json({ ok: false, error: 'user_not_found' });
    }

    const userEmail = rows[0].email;
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

    console.log('Admin check for user:', req.user.id, 'Email:', userEmail, 'Admin emails:', adminEmails);

    if (!adminEmails.includes(userEmail)) {
      console.log('Admin access denied for email:', userEmail);
      return res.status(403).json({ ok: false, error: 'admin_access_required' });
    }

    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
};

// Get pending listings for approval
router.get('/listings/pending', authRequired, adminRequired, async (req, res) => {
  try {
    console.log('Admin pending listings request from user:', req.user.id);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const sql = `
      SELECT
        l.id, l.title, l.slug, l.description_md, l.price_minor, l.currency,
        l.condition_grade, l.location_city, l.status, l.created_at, l.updated_at,
        c.name as category_name, c.slug as category_slug,
        u.full_name as owner_name, u.email as owner_email,
        (SELECT COUNT(*) FROM listing_images WHERE listing_id = l.id) as image_count,
        (SELECT file_url FROM listing_images WHERE listing_id = l.id ORDER BY sort_order ASC LIMIT 1) as cover_url
      FROM listings l
      LEFT JOIN categories c ON l.category_id = c.id
      LEFT JOIN users u ON l.seller_id = u.id
      WHERE l.status = 'pending_review'
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [listings] = await pool.query(sql, [limit, offset]);

    // Get total count
    const [countResult] = await pool.query(
      "SELECT COUNT(*) as total FROM listings WHERE status = 'pending_review'"
    );
    const total = countResult[0]?.total || 0;

    res.json({
      ok: true,
      listings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching pending listings:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Get all listings with filters
router.get('/listings', authRequired, adminRequired, async (req, res) => {
  try {
    const { status = '', search = '', page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (status) {
      whereClause += ' AND l.status = ?';
      params.push(status);
    }

    if (search) {
      whereClause += ' AND (l.title LIKE ? OR l.description_md LIKE ? OR u.full_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const sql = `
      SELECT
        l.id, l.title, l.slug, l.price_minor, l.currency, l.status,
        l.created_at, l.updated_at,
        c.name as category_name,
        u.full_name as owner_name, u.email as owner_email,
        (SELECT file_url FROM listing_images WHERE listing_id = l.id ORDER BY sort_order ASC LIMIT 1) as cover_url
      FROM listings l
      LEFT JOIN categories c ON l.category_id = c.id
      LEFT JOIN users u ON l.seller_id = u.id
      ${whereClause}
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [listings] = await pool.query(sql, [...params, limitNum, offset]);

    // Get total count
    const countSql = `
      SELECT COUNT(*) as total
      FROM listings l
      LEFT JOIN users u ON l.seller_id = u.id
      ${whereClause}
    `;
    const [countResult] = await pool.query(countSql, params);
    const total = countResult[0]?.total || 0;

    res.json({
      ok: true,
      listings,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });

  } catch (error) {
    console.error('Error fetching admin listings:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Approve listing
router.post('/listings/:id/approve', authRequired, adminRequired, async (req, res) => {
  try {
    const { id } = req.params;

    // Get listing details before updating
    const [[listing]] = await pool.query(
      'SELECT seller_id, title FROM listings WHERE id = ?',
      [id]
    );

    if (!listing) {
      return res.status(404).json({ ok: false, error: 'listing_not_found' });
    }

    const [result] = await pool.query(
      'UPDATE listings SET status = ?, updated_at = NOW() WHERE id = ?',
      ['active', id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, error: 'listing_not_found' });
    }

    // Send notification to seller (async, don't block response)
    setImmediate(async () => {
      try {
        await notificationService.sendListingApprovedNotification(listing.seller_id, {
          listingId: id,
          title: listing.title
        });
      } catch (notifError) {
        console.error('Failed to send listing approval notification:', notifError);
      }
    });

    res.json({ ok: true, message: 'listing_approved' });

  } catch (error) {
    console.error('Error approving listing:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Reject listing
router.post('/listings/:id/reject', authRequired, adminRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = '' } = req.body;

    // Get listing details before updating
    const [[listing]] = await pool.query(
      'SELECT seller_id, title FROM listings WHERE id = ?',
      [id]
    );

    if (!listing) {
      return res.status(404).json({ ok: false, error: 'listing_not_found' });
    }

    const [result] = await pool.query(
      'UPDATE listings SET status = ?, rejection_reason = ?, updated_at = NOW() WHERE id = ?',
      ['rejected', reason, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, error: 'listing_not_found' });
    }

    // Send notification to seller (async, don't block response)
    setImmediate(async () => {
      try {
        await notificationService.sendListingRejectedNotification(listing.seller_id, {
          listingId: id,
          title: listing.title,
          reason: reason || 'Belirtilen kurallara uygun değil'
        });
      } catch (notifError) {
        console.error('Failed to send listing rejection notification:', notifError);
      }
    });

    res.json({ ok: true, message: 'listing_rejected' });

  } catch (error) {
    console.error('Error rejecting listing:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Get admin dashboard stats
router.get('/stats', authRequired, adminRequired, async (req, res) => {
  try {
    const [stats] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM listings WHERE status = 'pending_review') as pending_listings,
        (SELECT COUNT(*) FROM listings WHERE status = 'active') as active_listings,
        (SELECT COUNT(*) FROM listings WHERE status = 'rejected') as rejected_listings,
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)) as new_users_week,
        (SELECT COUNT(*) FROM listings WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)) as new_listings_week
    `);

    res.json({ ok: true, stats: stats[0] });

  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Get detailed analytics
router.get('/stats/detailed', authRequired, adminRequired, async (req, res) => {
  try {
    // Basic stats
    const [basicStats] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM listings WHERE status = 'pending_review') as pending_listings,
        (SELECT COUNT(*) FROM listings WHERE status = 'active') as active_listings,
        (SELECT COUNT(*) FROM listings WHERE status = 'rejected') as rejected_listings,
        (SELECT COUNT(*) FROM listings WHERE status = 'sold') as sold_listings,
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE status = 'active') as active_users,
        (SELECT COUNT(*) FROM users WHERE status = 'suspended') as suspended_users,
        (SELECT COUNT(*) FROM users WHERE kyc_status = 'verified') as verified_users
    `);

    // Growth analytics (last 30 days by day)
    const [growthStats] = await pool.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as new_users,
        'users' as type
      FROM users
      WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at)

      UNION ALL

      SELECT
        DATE(created_at) as date,
        COUNT(*) as new_listings,
        'listings' as type
      FROM listings
      WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    // Category distribution
    const [categoryStats] = await pool.query(`
      SELECT
        c.name as category_name,
        COUNT(l.id) as listing_count,
        COUNT(CASE WHEN l.status = 'active' THEN 1 END) as active_count,
        COUNT(CASE WHEN l.status = 'sold' THEN 1 END) as sold_count
      FROM categories c
      LEFT JOIN listings l ON c.id = l.category_id
      GROUP BY c.id, c.name
      ORDER BY listing_count DESC
      LIMIT 10
    `);

    // Top sellers
    const [topSellers] = await pool.query(`
      SELECT
        u.id, u.full_name, u.email, u.sales_count, u.rating_avg,
        COUNT(l.id) as total_listings,
        COUNT(CASE WHEN l.status = 'active' THEN 1 END) as active_listings,
        COUNT(CASE WHEN l.status = 'sold' THEN 1 END) as sold_listings
      FROM users u
      LEFT JOIN listings l ON u.id = l.seller_id
      WHERE u.sales_count > 0
      GROUP BY u.id
      ORDER BY u.sales_count DESC, u.rating_avg DESC
      LIMIT 10
    `);

    // Recent activity
    const [recentActivity] = await pool.query(`
      SELECT 'user_registration' as activity_type, full_name as title, created_at as timestamp, id
      FROM users
      WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)

      UNION ALL

      SELECT 'listing_created' as activity_type, title, created_at as timestamp, id
      FROM listings
      WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)

      ORDER BY timestamp DESC
      LIMIT 20
    `);

    // Revenue analytics (if billing_transactions table exists)
    const [revenueStats] = await pool.query(`
      SELECT
        DATE(created_at) as date,
        SUM(amount_minor) / 100 as daily_revenue,
        COUNT(*) as transaction_count
      FROM billing_transactions
      WHERE status = 'completed'
        AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `).catch(() => [[]]);

    res.json({
      ok: true,
      analytics: {
        basicStats: basicStats[0],
        growthStats,
        categoryStats,
        topSellers,
        recentActivity,
        revenueStats: revenueStats || []
      }
    });

  } catch (error) {
    console.error('Error fetching detailed analytics:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// AI Content Moderation
router.post('/listings/:id/ai-check', authRequired, adminRequired, async (req, res) => {
  try {
    const { id } = req.params;

    // Get listing content
    const [listing] = await pool.query(
      'SELECT title, description_md FROM listings WHERE id = ?',
      [id]
    );

    if (!listing.length) {
      return res.status(404).json({ ok: false, error: 'listing_not_found' });
    }

    // Use OpenAI for content moderation
    console.log('Running AI check for listing:', id);
    const aiResult = await moderateContent(listing[0].title, listing[0].description_md || '');

    // Auto-approval logic
    const autoApprovalEnabled = process.env.AI_AUTO_APPROVE_ENABLED === 'true';
    const approveThreshold = parseInt(process.env.AI_AUTO_APPROVE_THRESHOLD) || 85;
    const rejectThreshold = parseInt(process.env.AI_AUTO_REJECT_THRESHOLD) || 20;
    const confidencePercent = Math.round((aiResult.confidence || 0.5) * 100);

    let autoAction = null;
    let newStatus = 'pending_review';

    if (autoApprovalEnabled) {
      if (aiResult.aiSuggestion === 'approve' && confidencePercent >= approveThreshold) {
        autoAction = 'auto_approved';
        newStatus = 'active';
      } else if (aiResult.aiSuggestion === 'reject' && confidencePercent >= approveThreshold) {
        autoAction = 'auto_rejected';
        newStatus = 'rejected';
      } else if (confidencePercent < rejectThreshold) {
        autoAction = 'flagged_for_manual_review';
      }
    }

    // Store AI check result and auto-action
    await pool.query(
      'UPDATE listings SET ai_check_result = ?, ai_check_date = NOW(), ai_flag_reason = ?, status = ? WHERE id = ?',
      [JSON.stringify({...aiResult, autoAction, confidencePercent}), aiResult.flagReason, newStatus, id]
    );

    console.log('AI check completed:', aiResult);
    if (autoAction) {
      console.log(`🤖 Auto-action taken: ${autoAction} (confidence: ${confidencePercent}%)`);
    }

    res.json({
      ok: true,
      aiCheck: {
        ...aiResult,
        recommendation: aiResult.aiSuggestion === 'approve' ? 'Bu ilan onaylanabilir ✅' :
                      aiResult.aiSuggestion === 'reject' ? 'Bu ilan reddedilmeli ❌' :
                      'Bu ilan manuel inceleme gerektirir ⚠️',
        source: aiResult.source,
        confidence: `${confidencePercent}%`,
        autoAction: autoAction,
        autoActionMessage: autoAction === 'auto_approved' ? '🚀 Otomatik onaylandı!' :
                          autoAction === 'auto_rejected' ? '🚫 Otomatik reddedildi!' :
                          autoAction === 'flagged_for_manual_review' ? '⚠️ Manuel inceleme gerekiyor' :
                          '👤 Manuel karar bekleniyor',
        newStatus: newStatus
      }
    });

  } catch (error) {
    console.error('AI check error:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Get AI Performance Dashboard Stats
router.get('/ai-stats', authRequired, adminRequired, async (req, res) => {
  try {
    const [aiStats] = await pool.query(`
      SELECT
        COUNT(*) as total_ai_checks,
        COUNT(CASE WHEN JSON_EXTRACT(ai_check_result, '$.autoAction') = 'auto_approved' THEN 1 END) as auto_approved,
        COUNT(CASE WHEN JSON_EXTRACT(ai_check_result, '$.autoAction') = 'auto_rejected' THEN 1 END) as auto_rejected,
        COUNT(CASE WHEN JSON_EXTRACT(ai_check_result, '$.autoAction') = 'flagged_for_manual_review' THEN 1 END) as flagged_manual,
        COUNT(CASE WHEN ai_check_result IS NULL THEN 1 END) as no_ai_check,
        AVG(JSON_EXTRACT(ai_check_result, '$.confidencePercent')) as avg_confidence,
        COUNT(CASE WHEN JSON_EXTRACT(ai_check_result, '$.source') = 'openai' THEN 1 END) as openai_source,
        COUNT(CASE WHEN JSON_EXTRACT(ai_check_result, '$.source') = 'fallback' THEN 1 END) as fallback_source,
        COUNT(CASE WHEN ai_check_date > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as checks_24h,
        COUNT(CASE WHEN ai_check_date > DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as checks_7d
      FROM listings
      WHERE ai_check_date IS NOT NULL
    `);

    const [riskLevelStats] = await pool.query(`
      SELECT
        JSON_EXTRACT(ai_check_result, '$.riskLevel') as risk_level,
        COUNT(*) as count
      FROM listings
      WHERE ai_check_result IS NOT NULL
      GROUP BY JSON_EXTRACT(ai_check_result, '$.riskLevel')
    `);

    const [confidenceDistribution] = await pool.query(`
      SELECT
        CASE
          WHEN JSON_EXTRACT(ai_check_result, '$.confidencePercent') >= 90 THEN '90-100%'
          WHEN JSON_EXTRACT(ai_check_result, '$.confidencePercent') >= 80 THEN '80-89%'
          WHEN JSON_EXTRACT(ai_check_result, '$.confidencePercent') >= 70 THEN '70-79%'
          WHEN JSON_EXTRACT(ai_check_result, '$.confidencePercent') >= 60 THEN '60-69%'
          ELSE '<60%'
        END as confidence_range,
        COUNT(*) as count
      FROM listings
      WHERE ai_check_result IS NOT NULL
      GROUP BY confidence_range
      ORDER BY confidence_range DESC
    `);

    const [recentChecks] = await pool.query(`
      SELECT
        id, title,
        JSON_EXTRACT(ai_check_result, '$.confidencePercent') as confidence,
        JSON_EXTRACT(ai_check_result, '$.riskLevel') as risk_level,
        JSON_EXTRACT(ai_check_result, '$.autoAction') as auto_action,
        JSON_EXTRACT(ai_check_result, '$.source') as ai_source,
        ai_check_date,
        status
      FROM listings
      WHERE ai_check_date IS NOT NULL
      ORDER BY ai_check_date DESC
      LIMIT 10
    `);

    res.json({
      ok: true,
      aiStats: {
        overview: aiStats[0],
        riskLevels: riskLevelStats,
        confidenceDistribution,
        recentChecks
      }
    });

  } catch (error) {
    console.error('Error fetching AI stats:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// User Management Routes
router.get('/users', authRequired, adminRequired, async (req, res) => {
  try {
    const { status = '', kyc_status = '', plan = '', search = '', page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE 1=1';
    const params = [];

    // Status filters
    if (status === 'suspended') {
      whereClause += ' AND u.status = ?';
      params.push('suspended');
    } else if (status === 'active') {
      whereClause += ' AND u.status = ?';
      params.push('active');
    }

    // KYC filters
    if (kyc_status && kyc_status !== '') {
      whereClause += ' AND u.kyc_status = ?';
      params.push(kyc_status);
    }

    // Plan filters
    if (plan && plan !== '') {
      whereClause += ' AND u.current_plan_code = ?';
      params.push(plan);
    }

    if (search) {
      whereClause += ' AND (u.full_name LIKE ? OR u.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const sql = `
      SELECT
        u.id, u.full_name, u.email, u.phone_e164, u.username,
        u.status, u.kyc_status, u.kyc_level, u.sales_count, u.rating_avg,
        u.created_at, u.updated_at, u.current_plan_code, u.can_sell,
        COUNT(l.id) as total_listings,
        COUNT(CASE WHEN l.status = 'active' THEN 1 END) as active_listings,
        COUNT(CASE WHEN l.status = 'sold' THEN 1 END) as sold_listings
      FROM users u
      LEFT JOIN listings l ON u.id = l.seller_id
      ${whereClause}
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [users] = await pool.query(sql, [...params, limitNum, offset]);

    const countSql = `SELECT COUNT(*) as total FROM users u ${whereClause}`;
    const [countResult] = await pool.query(countSql, params);
    const total = countResult[0]?.total || 0;

    res.json({
      ok: true,
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

router.get('/users/:id', authRequired, adminRequired, async (req, res) => {
  try {
    const { id } = req.params;

    const [users] = await pool.query(`
      SELECT
        u.id, u.full_name, u.email, u.phone_e164, u.username,
        u.status, u.kyc_status, u.kyc_level, u.sales_count, u.rating_avg,
        u.created_at, u.updated_at, u.current_plan_code, u.can_sell,
        COUNT(l.id) as total_listings,
        COUNT(CASE WHEN l.status = 'active' THEN 1 END) as active_listings,
        COUNT(CASE WHEN l.status = 'sold' THEN 1 END) as sold_listings,
        COUNT(CASE WHEN l.status = 'rejected' THEN 1 END) as rejected_listings
      FROM users u
      LEFT JOIN listings l ON u.id = l.seller_id
      WHERE u.id = ?
      GROUP BY u.id
    `, [id]);

    if (!users.length) {
      return res.status(404).json({ ok: false, error: 'user_not_found' });
    }

    const [recentListings] = await pool.query(`
      SELECT id, title, status, created_at, price_minor, currency
      FROM listings
      WHERE seller_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `, [id]);

    res.json({
      ok: true,
      user: {
        ...users[0],
        recentListings
      }
    });

  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

router.post('/users/:id/suspend', authRequired, adminRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = '' } = req.body;

    const [result] = await pool.query(
      'UPDATE users SET status = "suspended", updated_at = NOW() WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, error: 'user_not_found' });
    }

    await pool.query(
      'UPDATE listings SET status = "suspended" WHERE seller_id = ? AND status IN ("active", "pending_review")',
      [id]
    );

    res.json({ ok: true, message: 'user_suspended' });

  } catch (error) {
    console.error('Error suspending user:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

router.post('/users/:id/unsuspend', authRequired, adminRequired, async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      'UPDATE users SET status = "active", updated_at = NOW() WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, error: 'user_not_found' });
    }

    res.json({ ok: true, message: 'user_unsuspended' });

  } catch (error) {
    console.error('Error unsuspending user:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

router.post('/users/:id/verify', authRequired, adminRequired, async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      'UPDATE users SET kyc_status = \"verified\", kyc_verified_at = NOW(), updated_at = NOW() WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, error: 'user_not_found' });
    }

    res.json({ ok: true, message: 'user_verified' });

  } catch (error) {
    console.error('Error verifying user:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Admin role management removed - using email-based authentication from .env ADMIN_EMAILS

// Bulk Operations Routes
router.post('/listings/bulk-action', authRequired, adminRequired, async (req, res) => {
  try {
    const { action, listingIds, reason } = req.body;

    if (!action || !listingIds || !Array.isArray(listingIds) || listingIds.length === 0) {
      return res.status(400).json({ ok: false, error: 'invalid_request' });
    }

    if (listingIds.length > 100) {
      return res.status(400).json({ ok: false, error: 'too_many_items' });
    }

    let updateQuery = '';
    let updateParams = [];
    let successCount = 0;

    switch (action) {
      case 'approve':
        updateQuery = 'UPDATE listings SET status = ?, updated_at = NOW() WHERE id IN (?)';
        updateParams = ['active', listingIds];
        break;

      case 'reject':
        if (!reason) {
          return res.status(400).json({ ok: false, error: 'reason_required' });
        }
        updateQuery = 'UPDATE listings SET status = ?, rejection_reason = ?, updated_at = NOW() WHERE id IN (?)';
        updateParams = ['rejected', reason, listingIds];
        break;

      case 'pause':
        updateQuery = 'UPDATE listings SET status = ?, updated_at = NOW() WHERE id IN (?)';
        updateParams = ['paused', listingIds];
        break;

      case 'feature':
        updateQuery = 'UPDATE listings SET is_featured = 1, featured_until = DATE_ADD(NOW(), INTERVAL 7 DAY), updated_at = NOW() WHERE id IN (?)';
        updateParams = [listingIds];
        break;

      case 'unfeature':
        updateQuery = 'UPDATE listings SET is_featured = 0, featured_until = NULL, updated_at = NOW() WHERE id IN (?)';
        updateParams = [listingIds];
        break;

      case 'ai-check':
        // For AI check, we need to process each listing individually
        const aiResults = [];
        for (const listingId of listingIds) {
          try {
            // Get listing content
            const [listing] = await pool.query(
              'SELECT title, description_md FROM listings WHERE id = ?',
              [listingId]
            );

            if (listing.length) {
              const aiResult = await moderateContent(listing[0].title, listing[0].description_md || '');

              // Auto-approval logic
              const autoApprovalEnabled = process.env.AI_AUTO_APPROVE_ENABLED === 'true';
              const approveThreshold = parseInt(process.env.AI_AUTO_APPROVE_THRESHOLD) || 85;
              const confidencePercent = Math.round((aiResult.confidence || 0.5) * 100);

              let autoAction = null;
              let newStatus = 'pending_review';

              if (autoApprovalEnabled) {
                if (aiResult.aiSuggestion === 'approve' && confidencePercent >= approveThreshold) {
                  autoAction = 'auto_approved';
                  newStatus = 'active';
                } else if (aiResult.aiSuggestion === 'reject' && confidencePercent >= approveThreshold) {
                  autoAction = 'auto_rejected';
                  newStatus = 'rejected';
                }
              }

              // Store AI check result
              await pool.query(
                'UPDATE listings SET ai_check_result = ?, ai_check_date = NOW(), ai_flag_reason = ?, status = ? WHERE id = ?',
                [JSON.stringify({...aiResult, autoAction, confidencePercent}), aiResult.flagReason, newStatus, listingId]
              );

              aiResults.push({
                listingId,
                result: { ...aiResult, autoAction, confidencePercent, newStatus }
              });
              successCount++;
            }
          } catch (aiError) {
            console.error(`AI check failed for listing ${listingId}:`, aiError);
          }
        }

        return res.json({
          ok: true,
          message: 'bulk_ai_check_completed',
          processed: successCount,
          total: listingIds.length,
          results: aiResults
        });

      default:
        return res.status(400).json({ ok: false, error: 'invalid_action' });
    }

    // Execute the bulk update query
    if (updateQuery) {
      // Convert array to comma-separated string for IN clause
      const idsPlaceholder = listingIds.map(() => '?').join(',');
      const finalQuery = updateQuery.replace('(?)', `(${idsPlaceholder})`);
      const finalParams = [...updateParams.slice(0, -1), ...listingIds];

      const [result] = await pool.query(finalQuery, finalParams);
      successCount = result.affectedRows;
    }

    res.json({
      ok: true,
      message: 'bulk_action_completed',
      action,
      processed: successCount,
      total: listingIds.length
    });

  } catch (error) {
    console.error('Bulk action error:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

router.post('/users/bulk-action', authRequired, adminRequired, async (req, res) => {
  try {
    const { action, userIds, reason } = req.body;

    if (!action || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ ok: false, error: 'invalid_request' });
    }

    if (userIds.length > 50) {
      return res.status(400).json({ ok: false, error: 'too_many_items' });
    }

    // Check if trying to modify self
    if (userIds.includes(req.user.id)) {
      return res.status(400).json({ ok: false, error: 'cannot_modify_self' });
    }

    let updateQuery = '';
    let updateParams = [];
    let successCount = 0;

    switch (action) {
      case 'verify':
        updateQuery = 'UPDATE users SET email_verified = 1, updated_at = NOW() WHERE id IN (?)';
        updateParams = [userIds];
        break;

      case 'suspend':
        if (!reason) {
          return res.status(400).json({ ok: false, error: 'reason_required' });
        }
        updateQuery = 'UPDATE users SET is_suspended = 1, suspension_reason = ?, updated_at = NOW() WHERE id IN (?)';
        updateParams = [reason, userIds];

        // Also suspend their listings
        const idsPlaceholder = userIds.map(() => '?').join(',');
        await pool.query(
          `UPDATE listings SET status = "suspended" WHERE seller_id IN (${idsPlaceholder}) AND status IN ("active", "pending_review")`,
          userIds
        );
        break;

      case 'unsuspend':
        updateQuery = 'UPDATE users SET status = "active", updated_at = NOW() WHERE id IN (?)';
        updateParams = [userIds];
        break;

      case 'kyc_approve':
        updateQuery = 'UPDATE users SET kyc_status = "verified", kyc_verified_at = NOW(), updated_at = NOW() WHERE id IN (?)';
        updateParams = [userIds];
        break;

      case 'kyc_reject':
        updateQuery = 'UPDATE users SET kyc_status = "rejected", updated_at = NOW() WHERE id IN (?)';
        updateParams = [userIds];
        break;

      case 'upgrade_basic':
        updateQuery = 'UPDATE users SET current_plan_code = "basic", plan_expires_at = DATE_ADD(NOW(), INTERVAL 1 MONTH), updated_at = NOW() WHERE id IN (?)';
        updateParams = [userIds];
        break;

      case 'upgrade_premium':
        updateQuery = 'UPDATE users SET current_plan_code = "premium", plan_expires_at = DATE_ADD(NOW(), INTERVAL 1 MONTH), updated_at = NOW() WHERE id IN (?)';
        updateParams = [userIds];
        break;

      default:
        return res.status(400).json({ ok: false, error: 'invalid_action' });
    }

    // Execute the bulk update query
    const idsPlaceholder = userIds.map(() => '?').join(',');
    const finalQuery = updateQuery.replace('(?)', `(${idsPlaceholder})`);
    const finalParams = [...updateParams.slice(0, -1), ...userIds];

    const [result] = await pool.query(finalQuery, finalParams);
    successCount = result.affectedRows;

    res.json({
      ok: true,
      message: 'bulk_action_completed',
      action,
      processed: successCount,
      total: userIds.length
    });

  } catch (error) {
    console.error('Bulk user action error:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Category Management Routes
router.get('/categories', authRequired, adminRequired, async (req, res) => {
  try {
    const [categories] = await pool.query(`
      SELECT
        c.id, c.name, c.slug, c.description, c.parent_id, c.sort_order,
        c.created_at, c.updated_at,
        COUNT(l.id) as listing_count,
        COUNT(CASE WHEN l.status = 'active' THEN 1 END) as active_listings,
        parent.name as parent_name
      FROM categories c
      LEFT JOIN categories parent ON c.parent_id = parent.id
      LEFT JOIN listings l ON c.id = l.category_id
      GROUP BY c.id
      ORDER BY c.parent_id ASC, c.sort_order ASC, c.name ASC
    `);

    res.json({ ok: true, categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

router.post('/categories', authRequired, adminRequired, async (req, res) => {
  try {
    const { name, slug, description, parent_id, sort_order = 0 } = req.body;

    if (!name) {
      return res.status(400).json({ ok: false, error: 'name_required' });
    }

    // Generate slug if not provided
    const finalSlug = slug || name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();

    // Check if slug exists
    const [existing] = await pool.query('SELECT id FROM categories WHERE slug = ?', [finalSlug]);
    if (existing.length > 0) {
      return res.status(400).json({ ok: false, error: 'slug_exists' });
    }

    const [result] = await pool.query(
      'INSERT INTO categories (name, slug, description, parent_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
      [name, finalSlug, description || null, parent_id || null, sort_order]
    );

    res.json({ ok: true, categoryId: result.insertId });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

router.put('/categories/:id', authRequired, adminRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, description, parent_id, sort_order = 0 } = req.body;

    if (!name) {
      return res.status(400).json({ ok: false, error: 'name_required' });
    }

    // Check if slug exists for other categories
    if (slug) {
      const [existing] = await pool.query('SELECT id FROM categories WHERE slug = ? AND id != ?', [slug, id]);
      if (existing.length > 0) {
        return res.status(400).json({ ok: false, error: 'slug_exists' });
      }
    }

    const [result] = await pool.query(
      'UPDATE categories SET name = ?, slug = ?, description = ?, parent_id = ?, sort_order = ?, updated_at = NOW() WHERE id = ?',
      [name, slug, description || null, parent_id || null, sort_order, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, error: 'category_not_found' });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

router.delete('/categories/:id', authRequired, adminRequired, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if category has subcategories
    const [subcategories] = await pool.query('SELECT id FROM categories WHERE parent_id = ?', [id]);
    if (subcategories.length > 0) {
      return res.status(400).json({ ok: false, error: 'has_subcategories' });
    }

    // Check if category has listings
    const [listings] = await pool.query('SELECT id FROM listings WHERE category_id = ?', [id]);
    if (listings.length > 0) {
      return res.status(400).json({ ok: false, error: 'has_listings' });
    }

    const [result] = await pool.query('DELETE FROM categories WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, error: 'category_not_found' });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Security & Logs Routes
router.get('/security/events', authRequired, adminRequired, async (req, res) => {
  try {
    const { event_type = '', severity = '', resolved = '', page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (event_type) {
      whereClause += ' AND se.event_type = ?';
      params.push(event_type);
    }

    if (severity) {
      whereClause += ' AND se.severity = ?';
      params.push(severity);
    }

    if (resolved !== '') {
      whereClause += ' AND se.resolved = ?';
      params.push(parseInt(resolved));
    }

    const sql = `
      SELECT
        se.id, se.event_type, se.severity, se.description, se.ip_address,
        se.user_agent, se.additional_data, se.resolved, se.created_at,
        u.full_name, u.email
      FROM security_events se
      LEFT JOIN users u ON se.user_id = u.id
      ${whereClause}
      ORDER BY se.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [events] = await pool.query(sql, [...params, limitNum, offset]);

    // Get counts for stats
    const [stats] = await pool.query(`
      SELECT
        COUNT(CASE WHEN severity = 'critical' AND resolved = 0 THEN 1 END) as critical_count,
        COUNT(CASE WHEN severity = 'high' AND resolved = 0 THEN 1 END) as high_count,
        COUNT(CASE WHEN event_type = 'login_failed' AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as failed_logins_24h
      FROM security_events
    `);

    const countSql = `SELECT COUNT(*) as total FROM security_events se ${whereClause}`;
    const [countResult] = await pool.query(countSql, params);
    const total = countResult[0]?.total || 0;

    res.json({
      ok: true,
      events,
      stats: stats[0],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });

  } catch (error) {
    console.error('Error fetching security events:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

router.get('/security/activity-logs', authRequired, adminRequired, async (req, res) => {
  try {
    const { action = '', resource_type = '', search = '', page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (action) {
      whereClause += ' AND al.action = ?';
      params.push(action);
    }

    if (resource_type) {
      whereClause += ' AND al.resource_type = ?';
      params.push(resource_type);
    }

    if (search) {
      whereClause += ' AND (u.full_name LIKE ? OR u.email LIKE ? OR al.action LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const sql = `
      SELECT
        al.id, al.action, al.resource_type, al.resource_id, al.ip_address,
        al.user_agent, al.data, al.created_at,
        u.full_name, u.email
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [logs] = await pool.query(sql, [...params, limitNum, offset]);

    // Get total action count for stats
    const [statsResult] = await pool.query(`
      SELECT COUNT(*) as total_actions
      FROM activity_logs
      WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `);

    const countSql = `SELECT COUNT(*) as total FROM activity_logs al ${whereClause}`;
    const [countResult] = await pool.query(countSql, params);
    const total = countResult[0]?.total || 0;

    res.json({
      ok: true,
      logs,
      stats: { total_actions: statsResult[0]?.total_actions || 0 },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });

  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

router.post('/security/events/:id/resolve', authRequired, adminRequired, async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      'UPDATE security_events SET resolved = 1 WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, error: 'event_not_found' });
    }

    res.json({ ok: true });

  } catch (error) {
    console.error('Error resolving security event:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

router.post('/security/events/resolve-all', authRequired, adminRequired, async (req, res) => {
  try {
    await pool.query('UPDATE security_events SET resolved = 1 WHERE resolved = 0');
    res.json({ ok: true });

  } catch (error) {
    console.error('Error resolving all security events:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Admin sessions (active sessions tracking)
router.get('/security/admin-sessions', authRequired, adminRequired, async (req, res) => {
  try {
    // This is a simplified version - you might want to implement proper session tracking
    const [sessions] = await pool.query(`
      SELECT
        u.id, u.full_name, u.email,
        MAX(al.created_at) as last_activity,
        COUNT(al.id) as action_count
      FROM users u
      INNER JOIN activity_logs al ON u.id = al.user_id
      WHERE al.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
        AND al.action IN ('admin_login', 'admin_action')
      GROUP BY u.id
      ORDER BY last_activity DESC
    `);

    res.json({ ok: true, sessions });

  } catch (error) {
    console.error('Error fetching admin sessions:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

module.exports = router;