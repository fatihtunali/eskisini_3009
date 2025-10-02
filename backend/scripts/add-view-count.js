// Script to add view_count column to listings table
const { pool } = require('../db.js');

async function addViewCount() {
  try {
    console.log('Adding view_count column to listings table...');

    // Add view_count column
    await pool.query(`
      ALTER TABLE listings
      ADD COLUMN view_count INT UNSIGNED DEFAULT 0 NOT NULL
    `);
    console.log('✅ view_count column added successfully');

    // Add index for performance
    await pool.query(`
      CREATE INDEX idx_listings_view_count ON listings(view_count DESC)
    `);
    console.log('✅ Index created successfully');

    // Initialize existing listings
    await pool.query(`
      UPDATE listings SET view_count = 0 WHERE view_count IS NULL
    `);
    console.log('✅ Existing listings initialized with 0 views');

    console.log('✅ View count migration completed successfully!');
    process.exit(0);
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️ view_count column already exists, skipping...');
      process.exit(0);
    } else if (error.code === 'ER_DUP_KEYNAME') {
      console.log('ℹ️ Index already exists, skipping...');
    } else {
      console.error('❌ Error adding view_count:', error.message);
      process.exit(1);
    }
  }
}

addViewCount();