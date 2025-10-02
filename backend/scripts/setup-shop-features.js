// Setup additional shop features database tables and columns
const { pool } = require('../db.js');

async function setupShopFeatures() {
  try {
    console.log('Setting up shop features database...');

    // 1. Seller_profiles tablosuna yeni kolonlar ekle
    console.log('Adding new columns to seller_profiles...');

    const addColumnsQueries = [
      // Shop status management (only if doesn't exist)
      {
        query: `ALTER TABLE seller_profiles ADD COLUMN shop_status ENUM('active', 'paused', 'closed') DEFAULT 'active'`,
        name: 'shop_status'
      },
      // Featured status
      {
        query: `ALTER TABLE seller_profiles ADD COLUMN is_featured BOOLEAN DEFAULT FALSE`,
        name: 'is_featured'
      },
      // Additional contact info
      {
        query: `ALTER TABLE seller_profiles ADD COLUMN whatsapp_phone VARCHAR(20) NULL`,
        name: 'whatsapp_phone'
      },
      {
        query: `ALTER TABLE seller_profiles ADD COLUMN instagram_handle VARCHAR(100) NULL`,
        name: 'instagram_handle'
      },
      // Business hours
      {
        query: `ALTER TABLE seller_profiles ADD COLUMN business_hours JSON NULL`,
        name: 'business_hours'
      }
    ];

    for (const columnDef of addColumnsQueries) {
      try {
        await pool.execute(columnDef.query);
        console.log(`✅ Column ${columnDef.name} added successfully`);
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`⚠️ Column ${columnDef.name} already exists, skipping`);
        } else {
          console.error(`❌ Error adding column ${columnDef.name}:`, error.message);
        }
      }
    }

    // 2. Shop media table oluştur
    console.log('Creating shop_media table...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS shop_media (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        shop_id BIGINT UNSIGNED NOT NULL,
        media_type ENUM('logo', 'banner', 'gallery') NOT NULL,
        file_url VARCHAR(500) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_size INT NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (shop_id) REFERENCES seller_profiles(id) ON DELETE CASCADE,
        INDEX idx_shop_media_type (shop_id, media_type)
      )
    `);

    // 3. Shop statistics table oluştur
    console.log('Creating shop_statistics table...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS shop_statistics (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        shop_id BIGINT UNSIGNED NOT NULL,
        stat_date DATE NOT NULL,
        views_count INT DEFAULT 0,
        contact_clicks INT DEFAULT 0,
        listing_views INT DEFAULT 0,
        whatsapp_clicks INT DEFAULT 0,
        phone_clicks INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (shop_id) REFERENCES seller_profiles(id) ON DELETE CASCADE,
        UNIQUE KEY unique_shop_date (shop_id, stat_date),
        INDEX idx_shop_stats_date (shop_id, stat_date)
      )
    `);

    // 4. Shop reviews table oluştur
    console.log('Creating shop_reviews table...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS shop_reviews (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        shop_id BIGINT UNSIGNED NOT NULL,
        reviewer_id BIGINT UNSIGNED NOT NULL,
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        review_text TEXT NULL,
        is_verified BOOLEAN DEFAULT FALSE,
        is_approved BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (shop_id) REFERENCES seller_profiles(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_shop_reviews (shop_id, is_approved),
        INDEX idx_reviewer_reviews (reviewer_id)
      )
    `);

    // 5. Mevcut shop'lara sample data ekle
    console.log('Adding sample data to existing shops...');

    // ModaPoint Ankara'ya sample data
    await pool.execute(`
      UPDATE seller_profiles
      SET
        shop_status = 'active',
        is_featured = TRUE,
        business_hours = '{"monday": "09:00-18:00", "tuesday": "09:00-18:00", "wednesday": "09:00-18:00", "thursday": "09:00-18:00", "friday": "09:00-18:00", "saturday": "10:00-17:00", "sunday": "closed"}'
      WHERE user_id = 4 AND display_name = 'ModaPoint Ankara'
    `);

    // TechStore İstanbul'a sample data
    await pool.execute(`
      UPDATE seller_profiles
      SET
        shop_status = 'active',
        is_featured = TRUE,
        business_hours = '{"monday": "10:00-19:00", "tuesday": "10:00-19:00", "wednesday": "10:00-19:00", "thursday": "10:00-19:00", "friday": "10:00-19:00", "saturday": "10:00-18:00", "sunday": "12:00-17:00"}'
      WHERE user_id = 3 AND display_name = 'TechStore İstanbul'
    `);

    // Sample reviews ekle
    await pool.execute(`
      INSERT IGNORE INTO shop_reviews (shop_id, reviewer_id, rating, review_text, is_verified)
      VALUES
      (5, 6, 5, 'Harika bir mağaza, ürün kalitesi çok iyi!', TRUE),
      (5, 7, 4, 'Hızlı teslimat, güvenilir satıcı.', TRUE),
      (4, 8, 5, 'Çok profesyonel hizmet, teşekkürler!', TRUE)
    `);

    // Sample statistics ekle
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    await pool.execute(`
      INSERT IGNORE INTO shop_statistics (shop_id, stat_date, views_count, contact_clicks, listing_views)
      VALUES
      (5, ?, 156, 23, 89),
      (5, ?, 134, 19, 67),
      (4, ?, 98, 15, 45),
      (4, ?, 112, 18, 52)
    `, [today, yesterday, today, yesterday]);

    console.log('✅ Shop features database setup completed!');

    // Verification
    const [tables] = await pool.execute("SHOW TABLES LIKE 'shop_%'");
    console.log('Created tables:', tables.map(t => Object.values(t)[0]));

  } catch (error) {
    console.error('❌ Setup error:', error);
  } finally {
    await pool.end();
  }
}

setupShopFeatures();