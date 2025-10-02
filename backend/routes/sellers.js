const { Router } = require('express');
const { pool } = require('../db.js');
const { authRequired } = require('../mw/auth.js');

// Cloudinary logo URLs mapping
function getShopLogoUrl(userId, shopName = '') {
  const logoMap = {
    3: 'https://res.cloudinary.com/dwgua2oxy/image/upload/v1758881056/eskisini/upload/shop-techstore-logo.jpg', // TechStore İstanbul
    4: 'https://res.cloudinary.com/dwgua2oxy/image/upload/v1758881057/eskisini/upload/shop-modapoint-logo.png', // ModaPoint Ankara
    5: 'https://res.cloudinary.com/dwgua2oxy/image/upload/v1758881058/eskisini/upload/shop-sportszone-logo.png', // SportsZone (ElektroMart)
    6: 'https://res.cloudinary.com/dwgua2oxy/image/upload/v1758881058/eskisini/upload/shop-homedecor-logo.png' // HomeDecor
  };

  return logoMap[userId] || null;
}

// Note: User avatars are now stored in database (users.avatar_url field)

const router = Router();

// Get featured sellers
router.get('/featured', async (req, res) => {
  try {
    const query = `
      SELECT
        sp.user_id,
        sp.display_name,
        sp.city,
        sp.total_sales,
        sp.rating_avg,
        sp.rating_count,
        sp.is_verified,
        sp.max_listings,
        sp.seller_type,
        u.full_name,
        u.email,
        u.avatar_url,
        COUNT(l.id) as active_listings,
        fs.priority,
        CASE
          WHEN sp.max_listings > 20 OR sp.seller_type = 'shop' THEN TRUE
          ELSE FALSE
        END as is_premium
      FROM seller_profiles sp
      JOIN users u ON sp.user_id = u.id
      JOIN featured_sellers fs ON sp.user_id = fs.user_id
      LEFT JOIN listings l ON sp.user_id = l.seller_id AND l.status = 'active'
      WHERE fs.is_active = TRUE AND fs.end_date > NOW()
      GROUP BY sp.user_id, fs.priority, sp.rating_avg
      ORDER BY fs.priority ASC, sp.rating_avg DESC
      LIMIT 10
    `;

    const [rows] = await pool.execute(query);

    // Add Cloudinary logo URLs to featured sellers and format response
    const sellersWithLogos = rows.map(seller => ({
      user_id: seller.user_id,
      display_name: seller.display_name,
      city: seller.city,
      total_sales: seller.total_sales,
      rating_avg: seller.rating_avg,
      rating_count: seller.rating_count,
      is_verified: seller.is_verified,
      is_premium: Boolean(seller.is_premium),
      avatar_url: seller.avatar_url,
      logo_url: getShopLogoUrl(seller.user_id, seller.display_name),
      active_listings: seller.active_listings,
      seller_type: seller.seller_type,
      full_name: seller.full_name,
      review_count: seller.rating_count // Alias for frontend compatibility
    }));

    res.json(sellersWithLogos);

  } catch (error) {
    console.error('Error fetching featured sellers:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error'
    });
  }
});

// Get current user's seller profile - MUST BE BEFORE /:id route
router.get('/my-profile', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.execute(
      `SELECT sp.*, u.full_name, u.email FROM seller_profiles sp
       JOIN users u ON sp.user_id = u.id
       WHERE sp.user_id = ?`,
      [userId]
    );

    if (rows.length === 0) {
      return res.json({
        ok: true,
        hasShop: false,
        message: 'No seller profile found'
      });
    }

    const seller = rows[0];
    res.json({
      ok: true,
      hasShop: true,
      seller: {
        user_id: seller.user_id,
        display_name: seller.display_name,
        business_name: seller.business_name,
        description: seller.description,
        city: seller.city,
        phone: seller.phone,
        website: seller.website,
        whatsapp_phone: seller.whatsapp_phone,
        instagram_handle: seller.instagram_handle,
        seller_type: seller.seller_type,
        max_listings: seller.max_listings,
        can_boost: seller.can_boost,
        can_use_analytics: seller.can_use_analytics,
        is_featured: seller.is_featured,
        shop_status: seller.shop_status,
        total_sales: seller.total_sales,
        rating_avg: seller.rating_avg,
        rating_count: seller.rating_count,
        is_verified: seller.is_verified,
        logo_url: seller.logo_url,
        banner_url: seller.banner_url,
        full_name: seller.full_name,
        email: seller.email
      }
    });

  } catch (error) {
    console.error('Error fetching seller profile:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error'
    });
  }
});

// Get seller profile by ID (includes both individual and shop sellers)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // First check if user exists and can sell
    const [userRows] = await pool.execute(
      'SELECT id, email, full_name, created_at, can_sell FROM users WHERE id = ? AND can_sell = TRUE',
      [id]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'seller_not_found'
      });
    }

    const user = userRows[0];

    // Check if user has a shop (seller_profiles)
    const [shopRows] = await pool.execute(
      `SELECT
        seller_type, display_name, city, total_sales, rating_avg,
        rating_count, is_verified, max_listings, logo_url
       FROM seller_profiles WHERE user_id = ?`,
      [id]
    );

    // Count active listings
    const [listingRows] = await pool.execute(
      "SELECT COUNT(*) as active_listings FROM listings WHERE seller_id = ? AND status = 'active'",
      [id]
    );

    const hasShop = shopRows.length > 0;
    const shop = hasShop ? shopRows[0] : null;

    const seller = {
      user_id: user.id,
      email: user.email,
      full_name: user.full_name,
      user_since: user.created_at,
      active_listings: listingRows[0].active_listings,
      // Shop-specific fields
      has_shop: hasShop,
      seller_type: hasShop ? shop.seller_type : 'individual',
      display_name: hasShop ? shop.display_name : user.full_name,
      city: hasShop ? shop.city : null,
      total_sales: hasShop ? shop.total_sales : 0,
      rating_avg: hasShop ? shop.rating_avg : null,
      rating_count: hasShop ? shop.rating_count : 0,
      is_verified: hasShop ? shop.is_verified : false,
      max_listings: hasShop ? shop.max_listings : 10,
      logo_url: hasShop ? getShopLogoUrl(user.id, hasShop ? shop.display_name : '') : null
      // avatar_url is now in database (users.avatar_url)
    };

    res.json({
      ok: true,
      seller
    });

  } catch (error) {
    console.error('Error fetching seller:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error'
    });
  }
});

// Get seller reviews
router.get('/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const query = `
      SELECT
        sr.id,
        sr.rating,
        sr.review_text,
        sr.communication_rating,
        sr.speed_rating,
        sr.reliability_rating,
        sr.is_verified,
        sr.created_at,
        u.full_name as reviewer_name
      FROM seller_reviews sr
      JOIN users u ON sr.reviewer_id = u.id
      WHERE sr.seller_id = ?
      ORDER BY sr.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;

    const [rows] = await pool.execute(query, [id]);

    // Get total count
    const [countRows] = await pool.execute(
      'SELECT COUNT(*) as total FROM seller_reviews WHERE seller_id = ?',
      [id]
    );

    res.json({
      ok: true,
      reviews: rows,
      pagination: {
        page,
        limit,
        total: countRows[0].total,
        pages: Math.ceil(countRows[0].total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching seller reviews:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error'
    });
  }
});

// Create or update seller profile (shop setup)
router.post('/seller-profile', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      display_name,
      description,
      city,
      phone,
      website,
      seller_type = 'shop'
    } = req.body;

    // Validation
    if (!display_name || !city) {
      return res.status(400).json({
        ok: false,
        error: 'display_name and city are required'
      });
    }

    // Check if seller profile already exists
    const [existingRows] = await pool.execute(
      'SELECT id FROM seller_profiles WHERE user_id = ?',
      [userId]
    );

    let result;
    if (existingRows.length > 0) {
      // Update existing profile
      result = await pool.execute(
        `UPDATE seller_profiles SET
         display_name = ?, description = ?, city = ?, phone = ?,
         website = ?, seller_type = ?, max_listings = 50, can_boost = 1,
         updated_at = NOW()
         WHERE user_id = ?`,
        [display_name, description, city, phone, website, seller_type, userId]
      );
    } else {
      // Create new profile
      result = await pool.execute(
        `INSERT INTO seller_profiles
         (user_id, display_name, description, city, phone, website, seller_type,
          max_listings, can_boost, can_use_analytics, priority_support, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 50, 1, 1, 1, NOW(), NOW())`,
        [userId, display_name, description, city, phone, website, seller_type]
      );
    }

    // Get the updated seller profile
    const [sellerRows] = await pool.execute(
      `SELECT sp.*, u.full_name, u.email FROM seller_profiles sp
       JOIN users u ON sp.user_id = u.id
       WHERE sp.user_id = ?`,
      [userId]
    );

    const seller = sellerRows[0];

    res.json({
      ok: true,
      message: 'Seller profile created/updated successfully',
      seller: {
        user_id: seller.user_id,
        display_name: seller.display_name,
        description: seller.description,
        city: seller.city,
        phone: seller.phone,
        website: seller.website,
        seller_type: seller.seller_type,
        max_listings: seller.max_listings,
        can_boost: seller.can_boost,
        full_name: seller.full_name,
        email: seller.email
      }
    });

  } catch (error) {
    console.error('Error creating/updating seller profile:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error',
      message: 'Failed to create seller profile'
    });
  }
});

module.exports = router;