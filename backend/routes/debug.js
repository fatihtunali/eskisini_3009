const { Router } = require('express');
const { pool } = require('../db.js');
const { authRequired } = require('../mw/auth.js');

const router = Router();

// Debug endpoint to check current database state
router.get('/database-state', async (req, res) => {
  try {
    let output = '';

    output += '='.repeat(60) + '\n';
    output += 'CURRENT DATABASE STATE - ' + new Date().toISOString() + '\n';
    output += '='.repeat(60) + '\n\n';

    // 1. USERS
    output += '1. USERS:\n';
    output += '-'.repeat(30) + '\n';
    const [users] = await pool.execute('SELECT id, username, email, full_name, status FROM users ORDER BY id');
    users.forEach(user => {
      output += `ID: ${user.id} | ${user.username} | ${user.full_name} | ${user.email}\n`;
    });

    // 2. SELLER_PROFILES
    output += '\n2. SELLER_PROFILES:\n';
    output += '-'.repeat(30) + '\n';
    const [sellers] = await pool.execute('SELECT user_id, display_name, city, seller_type, total_sales, rating_avg FROM seller_profiles ORDER BY user_id');
    if (sellers.length === 0) {
      output += 'NO SELLER PROFILES FOUND!\n';
    } else {
      sellers.forEach(seller => {
        output += `User ID: ${seller.user_id} | ${seller.display_name} | ${seller.city} | Type: ${seller.seller_type}\n`;
      });
    }

    // 3. USER-SELLER MATCHING
    output += '\n3. USER-SELLER MATCHING:\n';
    output += '-'.repeat(30) + '\n';
    const [matching] = await pool.execute(`
      SELECT u.id, u.username, u.full_name, sp.display_name, sp.city
      FROM users u
      LEFT JOIN seller_profiles sp ON u.id = sp.user_id
      WHERE u.username IN ('fatihtunali', 'dilertunali')
      ORDER BY u.id
    `);

    matching.forEach(row => {
      output += `${row.username} (ID: ${row.id}): ${row.full_name}\n`;
      if (row.display_name) {
        output += `  -> Shop: ${row.display_name} (${row.city})\n`;
      } else {
        output += `  -> NO SHOP\n`;
      }
    });

    res.json({
      ok: true,
      report: output,
      raw_data: {
        users,
        sellers,
        matching
      }
    });

  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// Test my-profile endpoint for dilertunali
router.get('/test-seller-profile/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    console.log(`Testing seller profile for user ID: ${userId}`);

    const [rows] = await pool.execute(
      `SELECT sp.*, u.full_name, u.email FROM seller_profiles sp
       JOIN users u ON sp.user_id = u.id
       WHERE sp.user_id = ?`,
      [userId]
    );

    console.log(`Query result for user ${userId}:`, rows);

    if (rows.length === 0) {
      return res.json({
        ok: true,
        hasShop: false,
        message: `No seller profile found for user ID ${userId}`,
        debug: {
          userId,
          queryExecuted: true,
          rowsFound: 0
        }
      });
    }

    const seller = rows[0];
    res.json({
      ok: true,
      hasShop: true,
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
        total_sales: seller.total_sales,
        rating_avg: seller.rating_avg,
        rating_count: seller.rating_count,
        is_verified: seller.is_verified,
        full_name: seller.full_name,
        email: seller.email
      },
      debug: {
        userId,
        queryExecuted: true,
        rowsFound: rows.length
      }
    });

  } catch (error) {
    console.error('Test seller profile error:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// Copy of my-profile endpoint for testing
router.get('/my-profile-test', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('My-profile test for user ID:', userId);

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
        description: seller.description,
        city: seller.city,
        phone: seller.phone,
        website: seller.website,
        seller_type: seller.seller_type,
        max_listings: seller.max_listings,
        can_boost: seller.can_boost,
        total_sales: seller.total_sales,
        rating_avg: seller.rating_avg,
        rating_count: seller.rating_count,
        is_verified: seller.is_verified,
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

// Test authentication middleware
router.get('/test-auth', authRequired, async (req, res) => {
  try {
    console.log('Auth test - req.user:', req.user);

    res.json({
      ok: true,
      message: 'Authentication successful',
      user: req.user,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Auth test error:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// Setup missing database tables
router.post('/setup-tables', async (req, res) => {
  try {
    console.log('Setting up missing database tables...');

    // 1. Add missing columns to seller_profiles
    const addColumns = [
      `ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS shop_status ENUM('active', 'paused', 'closed') DEFAULT 'active'`,
      `ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500) NULL`,
      `ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS banner_url VARCHAR(500) NULL`
    ];

    for (const query of addColumns) {
      try {
        await pool.execute(query);
        console.log('✅ Column added/exists');
      } catch (error) {
        if (!error.message.includes('Duplicate column')) {
          console.log('⚠️ Column issue:', error.message);
        }
      }
    }

    // 2. Create shop_statistics table with sample data
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS shop_statistics (
        id INT PRIMARY KEY AUTO_INCREMENT,
        shop_id INT NOT NULL,
        stat_date DATE NOT NULL,
        views_count INT DEFAULT 0,
        contact_clicks INT DEFAULT 0,
        listing_views INT DEFAULT 0,
        whatsapp_clicks INT DEFAULT 0,
        phone_clicks INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_shop_stats (shop_id, stat_date)
      )
    `);

    // 3. Create shop_reviews table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS shop_reviews (
        id INT PRIMARY KEY AUTO_INCREMENT,
        shop_id INT NOT NULL,
        reviewer_id INT NOT NULL,
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        review_text TEXT NULL,
        is_verified BOOLEAN DEFAULT FALSE,
        is_approved BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_shop_reviews (shop_id, is_approved)
      )
    `);

    // 4. Insert sample data for ModaPoint Ankara (seller_profile id=5, user_id=4)
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Sample statistics
    await pool.execute(`
      INSERT IGNORE INTO shop_statistics (shop_id, stat_date, views_count, contact_clicks, listing_views)
      VALUES
      (5, ?, 156, 23, 89),
      (5, ?, 134, 19, 67)
    `, [today, yesterday]);

    // Sample reviews
    await pool.execute(`
      INSERT IGNORE INTO shop_reviews (shop_id, reviewer_id, rating, review_text, is_verified)
      VALUES
      (5, 6, 5, 'Harika bir mağaza, ürün kalitesi çok iyi!', TRUE),
      (5, 7, 4, 'Hızlı teslimat, güvenilir satıcı.', TRUE),
      (5, 8, 5, 'Çok profesyonel hizmet, teşekkürler!', TRUE)
    `);

    // 5. Update seller_profiles with new features
    await pool.execute(`
      UPDATE seller_profiles SET
        shop_status = 'active',
        is_featured = TRUE
      WHERE user_id = 4
    `);

    res.json({
      ok: true,
      message: 'Database tables and sample data created successfully'
    });

  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

module.exports = router;