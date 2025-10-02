// backend/routes/listings.js
const { Router } = require('express');
const { pool } = require('../db.js');
const { authRequired, authOptional } = require('../mw/auth.js');
const { moderateContent } = require('../services/openai-moderation.js');

// Note: Logo URLs are now stored in database seller_profiles.logo_url column

// Note: Hardcoded URL functions removed - now using database for images and avatars
// Product images are stored in listing_images table
// User avatars are stored in users.avatar_url field

const r = Router();

/* -------------------------------------------------
 * CONFIGURATION AND BOOTSTRAP
 * We will detect schema details ONCE on startup.
 * ------------------------------------------------- */
let LISTING_OWNER_COL = null;
let HAS_FULLTEXT_INDEX = false;

async function bootstrap() {
  console.log('Bootstrapping listings route...');
  try {
    // Detect the listing owner column
    const candidates = ['user_id', 'owner_id', 'seller_id', 'owner_user_id', 'created_by'];
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'listings'`
    );
    const cols = new Set(rows.map(r => r.COLUMN_NAME));
    for (const c of candidates) {
      if (cols.has(c)) { LISTING_OWNER_COL = c; break; }
    }
    if (!LISTING_OWNER_COL) {
      console.warn('Warning: Could not detect listing owner column. Owner-related features will be disabled.');
    } else {
      console.log(`Detected listing owner column: ${LISTING_OWNER_COL}`);
    }

    // Check for a full-text index on listings.title, description_md
    const [indexRows] = await pool.query(
      `SHOW INDEX FROM listings WHERE KEY_NAME = 'fulltext_title_desc'`
    );
    HAS_FULLTEXT_INDEX = indexRows.length > 0;
    console.log(`Full-text index available: ${HAS_FULLTEXT_INDEX}`);

  } catch (err) {
    console.error('Error during listings route bootstrap:', err);
    // Continue even on error, but features might be disabled
  }
}

// Run bootstrap function on server startup
bootstrap();

/* -------------------------------------------------
 * HELPERS (now using the bootstrapped config)
 * ------------------------------------------------- */
function buildOwnerSelect(alias = 'u') {
  if (!LISTING_OWNER_COL) {
    return `
      NULL AS owner_id,
      NULL AS owner_display_name,
      0    AS owner_verified,
      NULL AS owner_rating_avg,
      NULL AS owner_sales_count,
      NULL AS owner_business_name
    `;
  }
  return `
    ${alias}.id AS owner_id,
    COALESCE(${alias}.full_name, sp.display_name, ${alias}.username, CONCAT('U', ${alias}.id)) AS owner_display_name,
    (
      ${alias}.is_kyc_verified = 1
      OR EXISTS (SELECT 1 FROM kyc_verifications kv WHERE kv.user_id = ${alias}.id AND kv.status = 'approved')
      OR sp.is_verified = 1
    ) AS owner_verified,
    COALESCE(sp.rating_avg, 0) AS owner_rating_avg,
    COALESCE(sp.total_sales, 0) AS owner_sales_count,
    sp.business_name AS owner_business_name,
    sp.logo_url AS owner_logo_url,
    ${alias}.avatar_url AS owner_avatar_url,
    sp.id AS owner_shop_id
  `;
}

function buildOwnerJoin() {
  if (!LISTING_OWNER_COL) return '';
  return `
    JOIN users u ON u.id = l.${LISTING_OWNER_COL}
    LEFT JOIN seller_profiles sp ON sp.user_id = u.id
  `;
}

function buildOwnerVerifiedWhere() {
  if (!LISTING_OWNER_COL) return null; // Can't filter if no owner column exists
  return `(
    u.is_kyc_verified = 1
    OR EXISTS (SELECT 1 FROM kyc_verifications kv WHERE kv.user_id = u.id AND kv.status = 'approved')
  )`;
}

/* -------------------------------------------------
 * CREATE listing — POST /api/listings  (AUTH)
 * ------------------------------------------------- */
r.post('/', authRequired, async (req, res, next) => {
  try {
    const uid = req.user.id; // authRequired middleware ensures req.user exists

    // Check user's can_sell permission and listing limits
    const [userRows] = await pool.query('SELECT can_sell FROM users WHERE id = ?', [uid]);
    if (!userRows.length || !userRows[0].can_sell) {
      return res.status(403).json({ ok: false, error: 'not_allowed_to_sell' });
    }

    // Check if user has a shop (seller_profiles)
    const [shopRows] = await pool.query('SELECT max_listings FROM seller_profiles WHERE user_id = ?', [uid]);
    const hasShop = shopRows.length > 0;
    const maxListings = hasShop ? (shopRows[0].max_listings || 999) : 10; // Individual users: 10 listings max

    // Count user's active listings
    const ownerCol = LISTING_OWNER_COL || 'seller_id';
    const [countRows] = await pool.query(`SELECT COUNT(*) as count FROM listings WHERE ${ownerCol} = ? AND status = 'active'`, [uid]);
    const currentListings = countRows[0].count;

    if (currentListings >= maxListings) {
      return res.status(400).json({
        ok: false,
        error: 'listing_limit_reached',
        current: currentListings,
        max: maxListings,
        hasShop
      });
    }

    let {
      category_id = null,
      category_slug = null,
      title,
      slug = null,
      description_md = null,
      price_minor,
      currency = 'TRY',
      condition_grade = 'good',
      location_city = null,
      allow_trade = false,
      images = [],
      image_urls = []
    } = req.body || {};

    if (!title) {
      return res.status(400).json({ ok: false, error: 'missing_title' });
    }

    if (!category_id && category_slug) {
      const [cr] = await pool.query('SELECT id FROM categories WHERE slug = ? LIMIT 1', [category_slug]);
      if (!cr.length) {
        return res.status(400).json({ ok: false, error: 'bad_category_slug' });
      }
      category_id = cr[0].id;
    }
    if (!category_id) {
      return res.status(400).json({ ok: false, error: 'missing_category' });
    }

    price_minor = Number(price_minor);
    if (!Number.isFinite(price_minor) || price_minor <= 0) {
      return res.status(400).json({ ok: false, error: 'bad_price' });
    }

    // Generate unique slug
    if (slug) {
      let uniqueSlug = slug;
      let counter = 1;
      while (true) {
        const [existingRows] = await pool.query('SELECT id FROM listings WHERE slug = ?', [uniqueSlug]);
        if (existingRows.length === 0) {
          slug = uniqueSlug;
          break;
        }
        uniqueSlug = `${slug}-${counter}`;
        counter++;
      }
    }

    const cols = ['category_id', 'title', 'slug', 'description_md', 'price_minor', 'currency', 'condition_grade', 'location_city', 'allow_trade', 'status'];
    const vals = [category_id, title, slug, description_md, price_minor, currency, condition_grade, location_city, !!allow_trade, 'pending_review'];

    if (LISTING_OWNER_COL) {
      cols.unshift(LISTING_OWNER_COL);
      vals.unshift(uid);
    }

    const placeholders = cols.map(_ => '?').join(', ');
    const [ins] = await pool.query(
      `INSERT INTO listings (${cols.join(', ')}) VALUES (${placeholders})`,
      vals
    );
    const listingId = ins.insertId;

    // Handle both images array and image_urls array from frontend
    const imageUrls = Array.isArray(image_urls) && image_urls.length
      ? image_urls
      : (Array.isArray(images) && images.length ? images : []);

    if (imageUrls.length) {
      const rows = imageUrls
        .map((it, idx) => {
          if (typeof it === 'string') return [listingId, it, null, idx];
          if (it && typeof it === 'object') return [listingId, it.file_url, it.thumb_url ?? null, idx];
          return null;
        })
        .filter(Boolean);

      if (rows.length) {
        await pool.query(
          `INSERT INTO listing_images (listing_id, file_url, thumb_url, sort_order) VALUES ?`,
          [rows]
        );
      }
    }

    // Automatic AI moderation for new listings
    try {
      console.log(`🤖 Running automatic AI check for new listing: ${listingId}`);
      const aiResult = await moderateContent(title, description_md || '');

      // Auto-approval logic
      const autoApprovalEnabled = process.env.AI_AUTO_APPROVE_ENABLED === 'true';
      const approveThreshold = parseInt(process.env.AI_AUTO_APPROVE_THRESHOLD) || 85;
      const rejectThreshold = parseInt(process.env.AI_AUTO_REJECT_THRESHOLD) || 20;
      const confidencePercent = Math.round((aiResult.confidence || 0.5) * 100);

      let autoAction = null;
      let finalStatus = 'pending_review'; // Default status

      if (autoApprovalEnabled) {
        if (aiResult.aiSuggestion === 'approve' && confidencePercent >= approveThreshold) {
          autoAction = 'auto_approved';
          finalStatus = 'active';
        } else if (aiResult.aiSuggestion === 'reject' && confidencePercent >= approveThreshold) {
          autoAction = 'auto_rejected';
          finalStatus = 'rejected';
        } else if (confidencePercent < rejectThreshold) {
          autoAction = 'flagged_for_manual_review';
        }
      }

      // Update listing with AI result and final status
      await pool.query(
        'UPDATE listings SET ai_check_result = ?, ai_check_date = NOW(), ai_flag_reason = ?, status = ? WHERE id = ?',
        [JSON.stringify({...aiResult, autoAction, confidencePercent}), aiResult.flagReason, finalStatus, listingId]
      );

      console.log(`✅ AI check completed for listing ${listingId}:`, {
        suggestion: aiResult.aiSuggestion,
        confidence: `${confidencePercent}%`,
        autoAction,
        finalStatus
      });

    } catch (aiError) {
      console.error(`❌ AI check failed for listing ${listingId}:`, aiError.message);
      // Don't fail the listing creation, just log the error
    }

    res.json({ ok: true, id: listingId });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------
 * LIST ALL — GET /api/listings (PUBLIC)
 * ------------------------------------------------- */
r.get('/', async (req, res, next) => {
  try {
    const {
      limit = '24',
      offset = '0',
      category = '',
      city = '',
      sort = 'newest'
    } = req.query;

    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 24, 1), 50);
    const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);

    const sortSql = (() => {
      if (sort === 'price_asc') return 'l.price_minor ASC';
      if (sort === 'price_desc') return 'l.price_minor DESC';
      if (sort === 'popular' && LISTING_OWNER_COL) return 'COALESCE(u.sales_count, 0) DESC, l.created_at DESC';
      return 'l.created_at DESC';
    })();

    let whereClauses = ["l.status = 'active'"];
    let params = [];

    if (category) {
      whereClauses.push('c.slug = ?');
      params.push(category);
    }

    if (city) {
      whereClauses.push('l.location_city LIKE ?');
      params.push(`%${city}%`);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const ownerSelect = buildOwnerSelect();
    const ownerJoin = buildOwnerJoin();

    const sql = `
      SELECT
        l.id, l.slug, l.title, l.price_minor, l.currency, l.location_city,
        l.created_at, l.status, l.view_count, c.slug AS category_slug,
        (
          SELECT COALESCE(li.thumb_url, li.file_url)
          FROM listing_images li
          WHERE li.listing_id = l.id
          ORDER BY li.sort_order ASC, li.id ASC
          LIMIT 1
        ) AS cover_url
        ${ownerSelect ? ',' + ownerSelect : ''}
      FROM listings l
      LEFT JOIN categories c ON c.id = l.category_id
      ${ownerJoin}
      ${whereClause}
      ORDER BY ${sortSql}
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(sql, [...params, limitNum, offsetNum]);

    const nextOffset = rows.length === limitNum ? offsetNum + limitNum : null;

    res.json({
      ok: true,
      items: rows,
      paging: {
        limit: limitNum,
        offset: offsetNum,
        next_offset: nextOffset
      }
    });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------
 * SEARCH — GET /api/listings/search (PUBLIC)
 * ------------------------------------------------- */
// GET /my - Get current user's listings
r.get('/my', authRequired, async (req, res, next) => {
  try {
    if (!LISTING_OWNER_COL) {
      return res.status(400).json({ ok: false, error: 'owner_column_not_configured' });
    }

    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const size = Math.min(100, Math.max(1, parseInt(req.query.size) || 24));
    const limitNum = size;
    const offsetNum = (page - 1) * size;

    const ownerSelect = buildOwnerSelect('u');
    const ownerJoin = buildOwnerJoin();

    // Get user's listings
    const sql = `
      SELECT
        l.id, l.slug, l.title, l.price_minor, l.currency,
        l.location_city, l.created_at, l.status, l.view_count,
        c.slug AS category_slug,
        (
          SELECT COALESCE(li.thumb_url, li.file_url)
          FROM listing_images li
          WHERE li.listing_id = l.id
          ORDER BY li.sort_order ASC, li.id ASC
          LIMIT 1
        ) AS cover_url,
        ${ownerSelect}
      FROM listings l
      JOIN categories c ON c.id = l.category_id
      ${ownerJoin}
      WHERE l.${LISTING_OWNER_COL} = ?
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [items] = await pool.query(sql, [userId, limitNum, offsetNum]);

    // Get total count for pagination
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM listings l WHERE l.${LISTING_OWNER_COL} = ?`,
      [userId]
    );
    const total = countResult[0]?.total || 0;

    res.json({
      ok: true,
      items,
      paging: {
        page,
        size: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
        has_next: offsetNum + limitNum < total
      }
    });

  } catch (err) {
    console.error('GET /:id error:', err);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

r.get('/search', authOptional, async (req, res, next) => {
  try {
    const {
      q: qRaw = '',
      cat: catSlug = '',
      category: categoryId = '',
      city = '',
      trade = '',
      verified = '',
      sort: sortRaw = 'newest',
      limit = '24',
      offset = '0',
      status = '',
      seller_id = '',
      price_min = '',
      price_max = '',
      condition = ''
    } = req.query;

    const q = qRaw.toString().trim();
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 24, 1), 50);
    const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);

    const sortSql = (() => {
      if (sortRaw === 'price_asc') return 'l.price_minor ASC';
      if (sortRaw === 'price_desc') return 'l.price_minor DESC';
      if (sortRaw === 'popular' && LISTING_OWNER_COL) return 'COALESCE(u.sales_count, 0) DESC, l.created_at DESC';
      return 'l.created_at DESC';
    })();

    const where = [];
    const params = [];

    if (catSlug) { where.push('c.slug = ?'); params.push(catSlug); }
    if (categoryId) { where.push('l.category_id = ?'); params.push(parseInt(categoryId, 10)); }
    if (city) { where.push('l.location_city = ?'); params.push(city); }

    // Fiyat filtreleri
    if (price_min) {
      const minPrice = parseFloat(price_min) * 100; // TL to kuruş
      if (!isNaN(minPrice)) {
        where.push('l.price_minor >= ?');
        params.push(minPrice);
      }
    }
    if (price_max) {
      const maxPrice = parseFloat(price_max) * 100; // TL to kuruş
      if (!isNaN(maxPrice)) {
        where.push('l.price_minor <= ?');
        params.push(maxPrice);
      }
    }

    // Durum filtresi (eğer listings tablosunda condition kolonu varsa)
    if (condition && ['new', 'used'].includes(condition)) {
      where.push('l.condition = ?');
      params.push(condition);
    }
    if (['1', 'true'].includes(trade.toLowerCase())) { where.push('l.allow_trade = 1'); }
    if (status) {
      where.push('l.status = ?');
      params.push(status);
    } else {
      // Public aramalarda sadece active ilanları göster
      // Seller_id ile kendi ilanlarını ararsa tüm statusları göster
      if (!seller_id) {
        where.push('l.status = ?');
        params.push('active');
      }
    }
    if (seller_id) { where.push(`l.${LISTING_OWNER_COL} = ?`); params.push(seller_id); }

    if (['1', 'true'].includes(verified.toLowerCase())) {
      const w = buildOwnerVerifiedWhere();
      if (w) where.push(w);
    }

    if (q) {
      if (HAS_FULLTEXT_INDEX) {
        where.push('(MATCH(l.title, l.description_md) AGAINST (? IN NATURAL LANGUAGE MODE))');
        params.push(q);
      } else {
        where.push('(l.title LIKE ? OR l.description_md LIKE ?)');
        params.push(`%${q}%`, `%${q}%`);
      }
    }

    const ownerSelect = buildOwnerSelect('u');
    const ownerJoin = buildOwnerJoin();

    const sql = `
      SELECT
        l.id, l.slug, l.title, l.price_minor, l.currency,
        l.location_city, l.created_at, l.status, l.view_count,
        c.slug AS category_slug,
        (
          SELECT COALESCE(li.thumb_url, li.file_url)
          FROM listing_images li
          WHERE li.listing_id = l.id
          ORDER BY li.sort_order ASC, li.id ASC
          LIMIT 1
        ) AS cover_url,
        ${ownerSelect}
      FROM listings l
      JOIN categories c ON c.id = l.category_id
      ${ownerJoin}
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY ${sortSql}
      LIMIT ? OFFSET ?
    `;

    const [items] = await pool.query(sql, [...params, limitNum, offsetNum]);

    res.json({
      ok: true,
      items,
      paging: {
        limit: limitNum,
        offset: offsetNum,
        next_offset: items.length === limitNum ? offsetNum + limitNum : null
      }
    });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------
 * READ detail — GET /api/listings/:id (PUBLIC + owner_public)
 * ------------------------------------------------- */
r.get('/:id', authOptional, async (req, res, next) => {
  try {
    const idParam = req.params.id;
    let whereClause, whereValue;

    console.log('GET listing detail - param:', idParam);

    // Check if it's a numeric ID or a slug
    const numId = Number(idParam);
    if (Number.isFinite(numId) && numId > 0) {
      // It's a numeric ID
      whereClause = 'l.id = ?';
      whereValue = numId;
      console.log('Using ID:', whereValue);
    } else {
      // It's a slug
      whereClause = 'l.slug = ?';
      whereValue = idParam;
      console.log('Using slug:', whereValue);
    }

    const ownerJoin = buildOwnerJoin();
    const ownerSelect = buildOwnerSelect('u');

    const [rows] = await pool.query(
      `
      SELECT
        l.id, l.${LISTING_OWNER_COL ?? 'id'} AS _owner_ref, l.title, l.slug, l.description_md,
        l.price_minor, l.currency, l.condition_grade, l.location_city,
        l.allow_trade, l.created_at, l.updated_at, l.view_count,
        c.slug AS category_slug,
        ${ownerSelect},
        ${LISTING_OWNER_COL ? 'u.username AS owner_username,' : 'NULL AS owner_username,'}
        NULL AS owner_city,
        ${LISTING_OWNER_COL ? 'DATE(u.created_at) AS owner_member_since,' : 'NULL AS owner_member_since,'}
        ${LISTING_OWNER_COL ? 'u.avatar_url AS owner_avatar_url' : 'NULL AS owner_avatar_url'}
      FROM listings l
      JOIN categories c ON c.id = l.category_id
      ${ownerJoin}
      WHERE ${whereClause}
      LIMIT 1
      `,
      [whereValue]
    );

    console.log('Query result - rows found:', rows.length);

    if (!rows.length) {
      console.log('No listing found for:', whereValue);
      return res.status(404).json({ ok: false, error: 'not_found' });
    }

    console.log('Found listing:', rows[0].title);
    const row = rows[0];

    // Increment view count (don't count owner's own views)
    const viewerId = req.user?.id ?? null;
    const is_owner = !!(LISTING_OWNER_COL && viewerId && viewerId === row._owner_ref);
    if (!is_owner) {
      // Increment and update the view count in the response
      await pool.query('UPDATE listings SET view_count = view_count + 1 WHERE id = ?', [row.id]);
      row.view_count = (row.view_count || 0) + 1;
    }

    const [imgs] = await pool.query(
      `SELECT id, file_url, thumb_url, file_name, thumb_name
       FROM listing_images
       WHERE listing_id = ?
       ORDER BY sort_order ASC, id ASC`,
      [row.id]
    );
    const images = imgs.map(im => ({
      id: im.id,
      file_url: im.file_url,
      thumb_url: im.thumb_url,
      file_name: im.file_name,
      thumb_name: im.thumb_name
    }));

    // viewerId and is_owner already declared above for view count tracking

    const owner_public = LISTING_OWNER_COL ? {
      id: row.owner_id,
      display_name: row.owner_display_name,
      username: row.owner_username,
      verified: !!row.owner_verified,
      sales_count: row.owner_sales_count ?? 0,
      rating_avg: row.owner_rating_avg ?? null,
      city: row.owner_city || row.location_city || null,
      member_since: row.owner_member_since,
      avatar_url: row.owner_logo_url || row.owner_avatar_url || null,
      business_name: row.owner_business_name,
      shop_id: row.owner_shop_id
    } : null;

    // Images are now loaded from database via the initial query

    const data = {
      id: row.id,
      category_slug: row.category_slug,
      title: row.title,
      slug: row.slug,
      description_md: row.description_md,
      price_minor: row.price_minor,
      currency: row.currency,
      condition_grade: row.condition_grade,
      location_city: row.location_city,
      allow_trade: !!row.allow_trade,
      created_at: row.created_at,
      updated_at: row.updated_at,
      images,
      owner_public,
      is_owner
    };

    res.json({ ok: true, listing: data });
  } catch (err) {
    console.error('GET listing detail error:', err);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

/* -------------------------------------------------
 * UPDATE listing — PUT /api/listings/:id (AUTH)
 * ------------------------------------------------- */
r.put('/:id', authRequired, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if listing exists and belongs to user
    const ownerCol = LISTING_OWNER_COL || 'seller_id';
    const [rows] = await pool.query(
      `SELECT id FROM listings WHERE id = ? AND ${ownerCol} = ?`,
      [id, userId]
    );

    if (!rows.length) {
      return res.status(404).json({ ok: false, error: 'listing_not_found_or_not_owner' });
    }

    let {
      category_id = null,
      category_slug = null,
      title,
      slug = null,
      description_md = null,
      price_minor,
      currency = 'TRY',
      condition_grade = 'good',
      location_city = null,
      allow_trade = false,
      images = [],
      image_urls = []
    } = req.body || {};

    if (!title) {
      return res.status(400).json({ ok: false, error: 'missing_title' });
    }

    if (!category_id && category_slug) {
      const [cr] = await pool.query('SELECT id FROM categories WHERE slug = ? LIMIT 1', [category_slug]);
      if (!cr.length) {
        return res.status(400).json({ ok: false, error: 'bad_category_slug' });
      }
      category_id = cr[0].id;
    }
    if (!category_id) {
      return res.status(400).json({ ok: false, error: 'missing_category' });
    }

    price_minor = Number(price_minor);
    if (!Number.isFinite(price_minor) || price_minor <= 0) {
      return res.status(400).json({ ok: false, error: 'bad_price' });
    }

    // Generate unique slug if slug is being updated
    if (slug) {
      let uniqueSlug = slug;
      let counter = 1;
      while (true) {
        const [existingRows] = await pool.query('SELECT id FROM listings WHERE slug = ? AND id != ?', [uniqueSlug, id]);
        if (existingRows.length === 0) {
          slug = uniqueSlug;
          break;
        }
        uniqueSlug = `${slug}-${counter}`;
        counter++;
      }
    }

    // Update listing
    await pool.query(
      `UPDATE listings SET
        category_id = ?, title = ?, slug = ?, description_md = ?,
        price_minor = ?, currency = ?, condition_grade = ?,
        location_city = ?, allow_trade = ?, updated_at = NOW()
       WHERE id = ?`,
      [category_id, title, slug, description_md, price_minor, currency, condition_grade, location_city, !!allow_trade, id]
    );

    // Handle images update
    const imageUrls = Array.isArray(image_urls) && image_urls.length
      ? image_urls
      : (Array.isArray(images) && images.length ? images : []);

    if (imageUrls.length) {
      // Delete existing images
      await pool.query('DELETE FROM listing_images WHERE listing_id = ?', [id]);

      // Insert new images
      const rows = imageUrls
        .map((it, idx) => {
          if (typeof it === 'string') return [id, it, null, idx];
          if (it && typeof it === 'object') return [id, it.file_url, it.thumb_url ?? null, idx];
          return null;
        })
        .filter(Boolean);

      if (rows.length) {
        await pool.query(
          `INSERT INTO listing_images (listing_id, file_url, thumb_url, sort_order) VALUES ?`,
          [rows]
        );
      }
    }

    res.json({ ok: true, id });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------
 * DELETE listing — DELETE /api/listings/:id (AUTH)
 * ------------------------------------------------- */
r.delete('/:id', authRequired, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if listing exists and belongs to user
    const ownerCol = LISTING_OWNER_COL || 'seller_id';
    const [rows] = await pool.query(
      `SELECT id FROM listings WHERE id = ? AND ${ownerCol} = ?`,
      [id, userId]
    );

    if (!rows.length) {
      return res.status(404).json({ ok: false, error: 'listing_not_found_or_not_owner' });
    }

    // Delete associated images first
    await pool.query('DELETE FROM listing_images WHERE listing_id = ?', [id]);

    // Delete the listing
    await pool.query('DELETE FROM listings WHERE id = ?', [id]);

    res.json({ ok: true, message: 'listing_deleted' });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------
 * UPDATE listing status — PUT /api/listings/:id/status (AUTH)
 * ------------------------------------------------- */
r.put('/:id/status', authRequired, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    // Validate status
    const validStatuses = ['draft', 'pending_review', 'active', 'rejected', 'sold', 'paused', 'deleted', 'reserved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ ok: false, error: 'invalid_status' });
    }

    // Check if listing exists and belongs to user
    const ownerCol = LISTING_OWNER_COL || 'seller_id';
    const [rows] = await pool.query(
      `SELECT id FROM listings WHERE id = ? AND ${ownerCol} = ?`,
      [id, userId]
    );

    if (!rows.length) {
      return res.status(404).json({ ok: false, error: 'listing_not_found_or_not_owner' });
    }

    // Update status
    await pool.query(
      'UPDATE listings SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, id]
    );

    res.json({ ok: true, status });
  } catch (err) {
    next(err);
  }
});

module.exports = r;