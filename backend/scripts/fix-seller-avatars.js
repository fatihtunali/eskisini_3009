// Script to fix seller profile avatars with placeholder images
const { pool } = require('../db.js');

async function fixSellerAvatars() {
  try {
    console.log('Fixing seller profile avatars...');

    // Update seller profiles to use local placeholder or remove broken Cloudinary URLs
    await pool.query(`
      UPDATE seller_profiles
      SET logo_url = '/assets/placeholder.png'
      WHERE logo_url LIKE '%cloudinary%'
      AND logo_url NOT LIKE '%/placeholder%'
    `);

    console.log('✅ Updated seller profile logos to use local placeholder');

    // Update user avatars to use local placeholder or remove broken Cloudinary URLs
    await pool.query(`
      UPDATE users
      SET avatar_url = NULL
      WHERE avatar_url LIKE '%cloudinary%'
      AND avatar_url NOT LIKE '%/placeholder%'
    `);

    console.log('✅ Cleared broken user avatar URLs');

    // Show updated sellers
    const [sellers] = await pool.query(`
      SELECT
        sp.user_id,
        sp.display_name,
        sp.logo_url,
        u.avatar_url
      FROM seller_profiles sp
      JOIN users u ON sp.user_id = u.id
      LIMIT 10
    `);

    console.log('\n📋 Updated seller profiles:');
    sellers.forEach(seller => {
      console.log(`  - ${seller.display_name} (ID: ${seller.user_id})`);
      console.log(`    Logo: ${seller.logo_url || 'None'}`);
      console.log(`    Avatar: ${seller.avatar_url || 'None'}`);
    });

    console.log('\n✅ Seller avatars fixed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing seller avatars:', error.message);
    process.exit(1);
  }
}

fixSellerAvatars();