const { Router } = require('express');
const { pool } = require('../db.js');
const { authRequired } = require('../mw/auth.js');
const multer = require('multer');
const path = require('path');

const router = Router();

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/shop-media/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed'), false);
    }
  }
});

// 1. UPDATE SHOP GENERAL INFO
router.put('/general-info', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      business_name,
      description,
      city,
      phone,
      website,
      whatsapp_phone,
      instagram_handle,
      business_hours
    } = req.body;

    console.log('Updating shop info for user:', userId);
    console.log('Request body:', req.body);

    // Undefined değerleri null'a çevir
    const params = [
      business_name || null,
      description || null,
      city || null,
      phone || null,
      website || null,
      whatsapp_phone || null,
      instagram_handle || null,
      business_hours ? JSON.stringify(business_hours) : null,
      userId
    ];

    console.log('SQL parameters:', params);

    // First, check if seller profile exists
    const [existing] = await pool.execute(
      'SELECT id FROM seller_profiles WHERE user_id = ?',
      [userId]
    );

    if (existing.length === 0) {
      // Create new seller profile
      await pool.execute(`
        INSERT INTO seller_profiles (
          user_id, business_name, description, city, phone,
          website, whatsapp_phone, instagram_handle, business_hours,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [userId, ...params.slice(0, 8)]);
    } else {
      // Update existing profile
      const [result] = await pool.execute(`
        UPDATE seller_profiles SET
          business_name = ?,
          description = ?,
          city = ?,
          phone = ?,
          website = ?,
          whatsapp_phone = ?,
          instagram_handle = ?,
          business_hours = ?,
          updated_at = NOW()
        WHERE user_id = ?
      `, params);
    }

    res.json({
      ok: true,
      message: 'Shop information updated successfully'
    });

  } catch (error) {
    console.error('Error updating shop info:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error'
    });
  }
});

// 2. TOGGLE PREMIUM FEATURES
router.put('/toggle-feature', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const { feature, enabled } = req.body;

    let updateQuery;
    let params = [enabled, userId];

    switch (feature) {
      case 'boost':
        updateQuery = 'UPDATE seller_profiles SET can_boost = ? WHERE user_id = ?';
        break;
      case 'analytics':
        updateQuery = 'UPDATE seller_profiles SET can_use_analytics = ? WHERE user_id = ?';
        break;
      case 'featured':
        updateQuery = 'UPDATE seller_profiles SET is_featured = ? WHERE user_id = ?';
        break;
      default:
        return res.status(400).json({
          ok: false,
          error: 'Invalid feature name'
        });
    }

    const [result] = await pool.execute(updateQuery, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        ok: false,
        error: 'Shop not found'
      });
    }

    res.json({
      ok: true,
      message: `Feature ${feature} ${enabled ? 'enabled' : 'disabled'} successfully`
    });

  } catch (error) {
    console.error('Error toggling feature:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error'
    });
  }
});

// 3. UPDATE SHOP STATUS
router.put('/status', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.body; // 'active', 'paused', 'closed'

    if (!['active', 'paused', 'closed'].includes(status)) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid status'
      });
    }

    const [result] = await pool.execute(`
      UPDATE seller_profiles SET
        shop_status = ?,
        updated_at = NOW()
      WHERE user_id = ?
    `, [status, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        ok: false,
        error: 'Shop not found'
      });
    }

    res.json({
      ok: true,
      message: `Shop status updated to ${status}`
    });

  } catch (error) {
    console.error('Error updating shop status:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error'
    });
  }
});

// 4. UPLOAD SHOP MEDIA (Logo/Banner)
router.post('/upload-media', authRequired, upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'banner', maxCount: 1 }
]), async (req, res) => {
  try {
    const userId = req.user.id;
    const files = req.files;

    // Get shop ID
    const [shops] = await pool.execute(
      'SELECT id FROM seller_profiles WHERE user_id = ?',
      [userId]
    );

    if (shops.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'Shop not found'
      });
    }

    const shopId = shops[0].id;
    const uploadedFiles = [];

    // Process uploaded files
    for (const [fieldName, fileArray] of Object.entries(files)) {
      if (fileArray && fileArray.length > 0) {
        const file = fileArray[0];
        const fileUrl = `/uploads/shop-media/${file.filename}`;

        // Insert to shop_media table
        await pool.execute(`
          INSERT INTO shop_media (shop_id, media_type, file_url, file_name, file_size, mime_type)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [shopId, fieldName, fileUrl, file.originalname, file.size, file.mimetype]);

        // Update seller_profiles with new URL
        const columnName = fieldName === 'logo' ? 'logo_url' : 'banner_url';
        await pool.execute(`
          UPDATE seller_profiles SET ${columnName} = ? WHERE id = ?
        `, [fileUrl, shopId]);

        uploadedFiles.push({
          type: fieldName,
          url: fileUrl,
          filename: file.filename
        });
      }
    }

    res.json({
      ok: true,
      message: 'Media uploaded successfully',
      files: uploadedFiles
    });

  } catch (error) {
    console.error('Error uploading media:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error'
    });
  }
});

// 5. GET SHOP STATISTICS
router.get('/statistics', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get shop ID
    const [shops] = await pool.execute(
      'SELECT id FROM seller_profiles WHERE user_id = ?',
      [userId]
    );

    if (shops.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'Shop not found'
      });
    }

    const shopId = shops[0].id;

    // Get statistics for last 30 days
    const [stats] = await pool.execute(`
      SELECT
        stat_date,
        views_count,
        contact_clicks,
        listing_views,
        whatsapp_clicks,
        phone_clicks
      FROM shop_statistics
      WHERE shop_id = ? AND stat_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      ORDER BY stat_date DESC
    `, [shopId]);

    // Get total stats
    const [totals] = await pool.execute(`
      SELECT
        SUM(views_count) as total_views,
        SUM(contact_clicks) as total_contacts,
        SUM(listing_views) as total_listing_views
      FROM shop_statistics
      WHERE shop_id = ?
    `, [shopId]);

    res.json({
      ok: true,
      statistics: {
        daily: stats,
        totals: totals[0] || { total_views: 0, total_contacts: 0, total_listing_views: 0 }
      }
    });

  } catch (error) {
    console.error('Error getting statistics:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error'
    });
  }
});

// 6. GET SHOP REVIEWS
router.get('/reviews', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get shop ID
    const [shops] = await pool.execute(
      'SELECT id FROM seller_profiles WHERE user_id = ?',
      [userId]
    );

    if (shops.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'Shop not found'
      });
    }

    const shopId = shops[0].id;

    // Get reviews
    const [reviews] = await pool.execute(`
      SELECT
        sr.id,
        sr.rating,
        sr.review_text,
        sr.is_verified,
        sr.created_at,
        u.full_name as reviewer_name,
        u.avatar_url as reviewer_avatar
      FROM shop_reviews sr
      JOIN users u ON sr.reviewer_id = u.id
      WHERE sr.shop_id = ? AND sr.is_approved = TRUE
      ORDER BY sr.created_at DESC
      LIMIT 50
    `, [shopId]);

    // Get review summary
    const [summary] = await pool.execute(`
      SELECT
        COUNT(*) as total_reviews,
        AVG(rating) as average_rating,
        COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star,
        COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star,
        COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star,
        COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star,
        COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star
      FROM shop_reviews
      WHERE shop_id = ? AND is_approved = TRUE
    `, [shopId]);

    res.json({
      ok: true,
      reviews,
      summary: summary[0] || {
        total_reviews: 0,
        average_rating: 0,
        five_star: 0, four_star: 0, three_star: 0, two_star: 0, one_star: 0
      }
    });

  } catch (error) {
    console.error('Error getting reviews:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error'
    });
  }
});

// 7. TRACK SHOP EVENTS (Real-time statistics)
router.post('/track-event', async (req, res) => {
  try {
    const { event_type, shop_id, listing_id } = req.body;

    // Validate event type
    const validEvents = ['view', 'contact_click', 'whatsapp_click', 'phone_click', 'listing_view'];
    if (!validEvents.includes(event_type)) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid event type'
      });
    }

    if (!shop_id) {
      return res.status(400).json({
        ok: false,
        error: 'shop_id is required'
      });
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    // Determine which column to increment
    let incrementColumn;
    switch (event_type) {
      case 'view':
        incrementColumn = 'views_count';
        break;
      case 'contact_click':
        incrementColumn = 'contact_clicks';
        break;
      case 'listing_view':
        incrementColumn = 'listing_views';
        break;
      case 'whatsapp_click':
        incrementColumn = 'whatsapp_clicks';
        break;
      case 'phone_click':
        incrementColumn = 'phone_clicks';
        break;
    }

    // Insert or update daily statistics
    await pool.execute(`
      INSERT INTO shop_statistics (shop_id, stat_date, ${incrementColumn})
      VALUES (?, ?, 1)
      ON DUPLICATE KEY UPDATE
      ${incrementColumn} = ${incrementColumn} + 1,
      updated_at = NOW()
    `, [shop_id, today]);

    console.log(`📊 Tracked ${event_type} for shop ${shop_id} on ${today}`);

    res.json({
      ok: true,
      message: 'Event tracked successfully'
    });

  } catch (error) {
    console.error('Error tracking event:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error'
    });
  }
});

module.exports = router;