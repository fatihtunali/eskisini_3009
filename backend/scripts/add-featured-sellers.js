// Script to add featured sellers to featured_sellers table
const { pool } = require('../db.js');

async function addFeaturedSellers() {
  try {
    console.log('Adding featured sellers...');

    // First, check if featured_sellers table exists
    const [tables] = await pool.query(`
      SHOW TABLES LIKE 'featured_sellers'
    `);

    if (tables.length === 0) {
      console.log('Creating featured_sellers table...');
      await pool.query(`
        CREATE TABLE featured_sellers (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          priority INT DEFAULT 0,
          is_active BOOLEAN DEFAULT TRUE,
          start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          end_date DATETIME DEFAULT (CURRENT_TIMESTAMP + INTERVAL 30 DAY),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_active_featured (is_active, end_date, priority)
        )
      `);
      console.log('✅ featured_sellers table created');
    }

    // Get sellers with profiles and active listings
    const [sellers] = await pool.query(`
      SELECT
        sp.user_id,
        sp.display_name,
        COUNT(l.id) as active_listings,
        sp.rating_avg
      FROM seller_profiles sp
      LEFT JOIN listings l ON sp.user_id = l.seller_id AND l.status = 'active'
      GROUP BY sp.user_id
      HAVING active_listings > 0
      ORDER BY sp.rating_avg DESC, active_listings DESC
      LIMIT 10
    `);

    if (sellers.length === 0) {
      console.log('⚠️ No sellers with active listings found');
      return;
    }

    console.log(`Found ${sellers.length} sellers with active listings`);

    // Clear existing featured sellers
    await pool.query('DELETE FROM featured_sellers');
    console.log('Cleared existing featured sellers');

    // Add sellers as featured
    for (let i = 0; i < sellers.length; i++) {
      const seller = sellers[i];
      await pool.query(`
        INSERT INTO featured_sellers (user_id, priority, is_active, start_date, end_date)
        VALUES (?, ?, TRUE, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY))
      `, [seller.user_id, i + 1]);

      console.log(`✅ Added featured seller: ${seller.display_name || seller.user_id} (${seller.active_listings} listings, rating: ${seller.rating_avg || 'N/A'})`);
    }

    console.log(`\n✅ Successfully added ${sellers.length} featured sellers!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding featured sellers:', error.message);
    process.exit(1);
  }
}

addFeaturedSellers();