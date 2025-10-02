const {pool} = require('../backend/db.js');

(async () => {
  try {
    console.log('=== DATABASE ANALYSIS ===\n');

    // Users table
    const [users] = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log('👥 USERS: ' + users[0].count + ' records');

    // Listings table
    const [listings] = await pool.query('SELECT COUNT(*) as count FROM listings');
    console.log('📦 LISTINGS: ' + listings[0].count + ' records');

    // Seller profiles
    const [sellers] = await pool.query('SELECT COUNT(*) as count FROM seller_profiles');
    console.log('🏪 SELLER_PROFILES: ' + sellers[0].count + ' records');

    // Categories
    const [categories] = await pool.query('SELECT COUNT(*) as count FROM categories');
    console.log('📂 CATEGORIES: ' + categories[0].count + ' records');

    // Orders
    const [orders] = await pool.query('SELECT COUNT(*) as count FROM orders');
    console.log('🛒 ORDERS: ' + orders[0].count + ' records');

    // Key relationships
    console.log('\n=== KEY RELATIONSHIPS ===');

    const [withLogos] = await pool.query('SELECT COUNT(*) as count FROM seller_profiles WHERE logo_url IS NOT NULL');
    console.log('🖼️  Sellers with logos: ' + withLogos[0].count);

    const [withBusinessName] = await pool.query('SELECT COUNT(*) as count FROM seller_profiles WHERE business_name IS NOT NULL');
    console.log('🏢 Sellers with business names: ' + withBusinessName[0].count);

    const [activeListings] = await pool.query("SELECT COUNT(*) as count FROM listings WHERE status = 'active'");
    console.log('✅ Active listings: ' + activeListings[0].count);

    console.log('\n=== SELLER PROFILES SAMPLE ===');
    const [sampleSellers] = await pool.query('SELECT id, business_name, logo_url FROM seller_profiles WHERE logo_url IS NOT NULL LIMIT 5');
    sampleSellers.forEach(s => {
      console.log(`ID ${s.id}: ${s.business_name || 'No business name'} | Logo: ${s.logo_url ? 'Yes' : 'No'}`);
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
})();