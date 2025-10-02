// Export current complete database structure and data
const { pool } = require('../db.js');
const fs = require('fs');

async function exportCurrentDatabase() {
  let output = '';

  try {
    console.log('Starting CURRENT database export...');
    output += '='.repeat(80) + '\n';
    output += 'CURRENT DATABASE EXPORT - ' + new Date().toISOString() + '\n';
    output += '='.repeat(80) + '\n\n';

    // 1. USERS TABLE - COMPLETE
    output += '1. USERS TABLE (COMPLETE):\n';
    output += '-'.repeat(50) + '\n';
    const [users] = await pool.execute('SELECT * FROM users ORDER BY id');
    users.forEach(user => {
      output += `ID: ${user.id}\n`;
      output += `  Username: ${user.username}\n`;
      output += `  Email: ${user.email}\n`;
      output += `  Full Name: ${user.full_name}\n`;
      output += `  Phone: ${user.phone_e164 || 'N/A'}\n`;
      output += `  Status: ${user.status}\n`;
      output += `  Can Sell: ${user.can_sell}\n`;
      output += `  Created: ${user.created_at}\n`;
      output += `  Updated: ${user.updated_at}\n`;
      output += `  Current Plan: ${user.current_plan_code || 'N/A'}\n`;
      output += `  Sales Count: ${user.sales_count}\n`;
      output += `  Rating: ${user.rating_avg || 'N/A'}\n`;
      output += `  Avatar: ${user.avatar_url || 'N/A'}\n`;
      output += '\n';
    });

    // 2. SELLER_PROFILES TABLE - COMPLETE
    output += '\n2. SELLER_PROFILES TABLE (COMPLETE):\n';
    output += '-'.repeat(50) + '\n';
    const [sellerProfiles] = await pool.execute('SELECT * FROM seller_profiles ORDER BY user_id');
    if (sellerProfiles.length === 0) {
      output += 'NO SELLER PROFILES FOUND!\n\n';
    } else {
      sellerProfiles.forEach(seller => {
        output += `Profile ID: ${seller.id}\n`;
        output += `  User ID: ${seller.user_id}\n`;
        output += `  Seller Type: ${seller.seller_type}\n`;
        output += `  Display Name: ${seller.display_name}\n`;
        output += `  Business Name: ${seller.business_name || 'N/A'}\n`;
        output += `  Description: ${seller.description || 'N/A'}\n`;
        output += `  City: ${seller.city}\n`;
        output += `  District: ${seller.district || 'N/A'}\n`;
        output += `  Phone: ${seller.phone || 'N/A'}\n`;
        output += `  Website: ${seller.website || 'N/A'}\n`;
        output += `  Total Sales: ${seller.total_sales}\n`;
        output += `  Rating Avg: ${seller.rating_avg}\n`;
        output += `  Rating Count: ${seller.rating_count}\n`;
        output += `  Is Verified: ${seller.is_verified}\n`;
        output += `  Verification Type: ${seller.verification_type || 'N/A'}\n`;
        output += `  Verification Date: ${seller.verification_date || 'N/A'}\n`;
        output += `  Max Listings: ${seller.max_listings}\n`;
        output += `  Can Boost: ${seller.can_boost}\n`;
        output += `  Can Analytics: ${seller.can_use_analytics}\n`;
        output += `  Subscription Status: ${seller.subscription_status}\n`;
        output += `  Created: ${seller.created_at}\n`;
        output += `  Updated: ${seller.updated_at}\n`;
        output += '\n';
      });
    }

    // 3. USER-SELLER EXACT MATCHING
    output += '\n3. USER-SELLER EXACT MATCHING:\n';
    output += '-'.repeat(50) + '\n';
    const [userSeller] = await pool.execute(`
      SELECT
        u.id as user_id,
        u.username,
        u.email,
        u.full_name,
        sp.id as seller_profile_id,
        sp.display_name,
        sp.seller_type,
        sp.city,
        sp.total_sales,
        sp.rating_avg
      FROM users u
      LEFT JOIN seller_profiles sp ON u.id = sp.user_id
      ORDER BY u.id
    `);

    userSeller.forEach(row => {
      output += `User ID ${row.user_id} (${row.username}):\n`;
      output += `  Name: ${row.full_name}\n`;
      output += `  Email: ${row.email}\n`;
      if (row.seller_profile_id) {
        output += `  ✓ HAS SELLER PROFILE (ID: ${row.seller_profile_id})\n`;
        output += `    Shop Name: ${row.display_name}\n`;
        output += `    Type: ${row.seller_type}\n`;
        output += `    Location: ${row.city}\n`;
        output += `    Sales: ${row.total_sales}\n`;
        output += `    Rating: ${row.rating_avg}\n`;
      } else {
        output += `  ✗ NO SELLER PROFILE\n`;
      }
      output += '\n';
    });

    // 4. FEATURED SELLERS
    output += '\n4. FEATURED SELLERS:\n';
    output += '-'.repeat(50) + '\n';
    const [featuredSellers] = await pool.execute(`
      SELECT
        fs.*,
        u.username,
        sp.display_name
      FROM featured_sellers fs
      JOIN users u ON fs.user_id = u.id
      LEFT JOIN seller_profiles sp ON fs.user_id = sp.user_id
      ORDER BY fs.priority
    `);

    if (featuredSellers.length > 0) {
      featuredSellers.forEach(fs => {
        output += `Featured ID: ${fs.id}\n`;
        output += `  User ID: ${fs.user_id} (${fs.username})\n`;
        output += `  Shop Name: ${fs.display_name || 'N/A'}\n`;
        output += `  Type: ${fs.featured_type}\n`;
        output += `  Priority: ${fs.priority}\n`;
        output += `  Start: ${fs.start_date}\n`;
        output += `  End: ${fs.end_date}\n`;
        output += `  Active: ${fs.is_active}\n`;
        output += '\n';
      });
    } else {
      output += 'No featured sellers found.\n\n';
    }

    // 5. LISTINGS COUNT BY USER
    output += '\n5. LISTINGS BY USER:\n';
    output += '-'.repeat(50) + '\n';
    const [listingCounts] = await pool.execute(`
      SELECT
        u.id as user_id,
        u.username,
        sp.display_name,
        COUNT(l.id) as listing_count,
        l.status
      FROM users u
      LEFT JOIN seller_profiles sp ON u.id = sp.user_id
      LEFT JOIN listings l ON u.id = l.seller_id
      GROUP BY u.id, l.status
      ORDER BY u.id, l.status
    `);

    const userListings = {};
    listingCounts.forEach(row => {
      if (!userListings[row.user_id]) {
        userListings[row.user_id] = {
          username: row.username,
          shop_name: row.display_name,
          statuses: {}
        };
      }
      if (row.status && row.listing_count > 0) {
        userListings[row.user_id].statuses[row.status] = row.listing_count;
      }
    });

    Object.keys(userListings).forEach(userId => {
      const user = userListings[userId];
      output += `User ID ${userId} (${user.username}):\n`;
      if (user.shop_name) {
        output += `  Shop: ${user.shop_name}\n`;
      }
      output += `  Listings: ${JSON.stringify(user.statuses)}}\n`;
      output += '\n';
    });

    // 6. DATABASE COUNTS
    output += '\n6. DATABASE SUMMARY:\n';
    output += '-'.repeat(50) + '\n';
    const [userCount] = await pool.execute('SELECT COUNT(*) as count FROM users');
    const [sellerCount] = await pool.execute('SELECT COUNT(*) as count FROM seller_profiles');
    const [listingCount] = await pool.execute('SELECT COUNT(*) as count FROM listings');
    const [featuredCount] = await pool.execute('SELECT COUNT(*) as count FROM featured_sellers WHERE is_active = 1');

    output += `Total Users: ${userCount[0].count}\n`;
    output += `Total Seller Profiles: ${sellerCount[0].count}\n`;
    output += `Total Listings: ${listingCount[0].count}\n`;
    output += `Active Featured Sellers: ${featuredCount[0].count}\n`;

    // 7. AUTHENTICATION CHECK
    output += '\n7. AUTHENTICATION TEST:\n';
    output += '-'.repeat(50) + '\n';
    const [authTest] = await pool.execute('SELECT id, username, email, full_name FROM users WHERE username IN (?, ?)', ['fatihtunali', 'dilertunali']);
    authTest.forEach(user => {
      output += `${user.username} (ID: ${user.id}): ${user.full_name} - ${user.email}\n`;
    });

    // Write to file
    const filename = `current_database_export_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    fs.writeFileSync(filename, output);

    console.log(`✅ CURRENT Database export completed: ${filename}`);
    console.log(`Total users: ${userCount[0].count}`);
    console.log(`Total seller profiles: ${sellerCount[0].count}`);

  } catch (error) {
    console.error('❌ Export error:', error);
  } finally {
    await pool.end();
  }
}

exportCurrentDatabase();