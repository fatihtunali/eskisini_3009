// Test Database Helper
// Provides clean database connection and cleanup utilities for tests

const mysql = require('mysql2/promise');

let testPool = null;

// Create test database connection
async function getTestPool() {
  if (testPool) return testPool;

  const ssl = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined;

  testPool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS || process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    ssl
  });

  return testPool;
}

// Clean up test data after tests
async function cleanupTestData() {
  const pool = await getTestPool();

  // Clean up in reverse dependency order
  try {
    // Clean up test users (those with email starting with 'test' or ID >= 9000)
    // First get test user IDs
    const [testUsers] = await pool.query(
      `SELECT id FROM users WHERE id >= 9000 OR email LIKE 'test%@test.com'`
    );
    const testUserIds = testUsers.map(u => u.id);

    if (testUserIds.length > 0) {
      // Delete order items for test users' orders (orders have buyer_id and seller_id, not user_id)
      await pool.query(
        `DELETE oi FROM order_items oi
         INNER JOIN orders o ON oi.order_id = o.id
         WHERE o.buyer_id IN (?) OR o.seller_id IN (?)`,
        [testUserIds, testUserIds]
      );

      // Delete orders (check both buyer_id and seller_id)
      await pool.query(
        `DELETE FROM orders WHERE buyer_id IN (?) OR seller_id IN (?)`,
        [testUserIds, testUserIds]
      );

      // Delete cart items
      await pool.query(
        `DELETE ci FROM cart_items ci
         INNER JOIN carts c ON ci.cart_id = c.id
         WHERE c.user_id IN (?)`,
        [testUserIds]
      );

      // Delete carts
      await pool.query(`DELETE FROM carts WHERE user_id IN (?)`, [testUserIds]);

      // Delete listings
      await pool.query(`DELETE FROM listings WHERE seller_id IN (?)`, [testUserIds]);

      // Delete user addresses
      await pool.query(`DELETE FROM user_addresses WHERE user_id IN (?)`, [testUserIds]);

      // Delete users
      await pool.query(`DELETE FROM users WHERE id IN (?)`, [testUserIds]);
    }

    console.log('✅ Test data cleanup completed');
  } catch (error) {
    console.error('❌ Cleanup error:', error.message);
  }
}

// Create test user
async function createTestUser(data = {}) {
  const pool = await getTestPool();
  const bcrypt = require('bcryptjs');

  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 10000);

  // Generate valid Turkish phone number in E.164 format: +90 5XX XXX XX XX
  // Turkish mobile numbers: +90 5XX (532, 533, 534, 535, 536, 537, 538, 539, 541, 542, 543, 544, 545, 546, 547, 548, 549, 551, etc.)
  const validPrefixes = ['532', '533', '534', '535', '536', '537', '538', '539', '541', '542', '543', '544', '545'];
  const randomPrefix = validPrefixes[Math.floor(Math.random() * validPrefixes.length)];
  const randomDigits = Math.floor(Math.random() * 10000000).toString().padStart(7, '0'); // 7 random digits
  const validPhone = `+90${randomPrefix}${randomDigits}`;

  const userData = {
    email: data.email || `test${timestamp}${randomSuffix}@test.com`,
    password_hash: await bcrypt.hash(data.password || 'Test123!', 10),
    full_name: data.full_name || 'Test User',
    username: data.username || `testuser${timestamp}${randomSuffix}`,
    phone_e164: data.phone_e164 || validPhone, // Valid Turkish phone in E.164 format
    id: data.id // Don't auto-generate ID, let database auto-increment
  };

  try {
    // If no ID provided, let database auto-increment
    if (userData.id) {
      const [result] = await pool.query(
        'INSERT INTO users (id, email, password_hash, full_name, username, phone_e164) VALUES (?, ?, ?, ?, ?, ?)',
        [userData.id, userData.email, userData.password_hash, userData.full_name, userData.username, userData.phone_e164]
      );
      return { ...userData, insertId: result.insertId };
    } else {
      const [result] = await pool.query(
        'INSERT INTO users (email, password_hash, full_name, username, phone_e164) VALUES (?, ?, ?, ?, ?)',
        [userData.email, userData.password_hash, userData.full_name, userData.username, userData.phone_e164]
      );
      userData.id = result.insertId;
      return { ...userData, insertId: result.insertId };
    }
  } catch (error) {
    // If permission denied, skip tests that require creating users
    if (error.message.includes('Access denied')) {
      console.warn('⚠️ Database write access denied - skipping tests that create data');
      throw new Error('SKIP_TEST: Database write access denied');
    }
    // If duplicate ID, retry with database auto-increment
    if (error.message.includes('Duplicate entry') && error.message.includes('PRIMARY')) {
      console.warn('⚠️ Duplicate ID detected, retrying with auto-increment...');
      const [result] = await pool.query(
        'INSERT INTO users (email, password_hash, full_name, username, phone_e164) VALUES (?, ?, ?, ?, ?)',
        [userData.email, userData.password_hash, userData.full_name, userData.username, userData.phone_e164]
      );
      userData.id = result.insertId;
      return { ...userData, insertId: result.insertId };
    }
    throw error;
  }
}

// Create test listing
async function createTestListing(sellerId, data = {}) {
  const pool = await getTestPool();

  const listingData = {
    seller_id: sellerId,
    title: data.title || 'Test Product',
    description_md: data.description_md || data.description || 'Test Description',
    price_minor: data.price_minor || 10000,
    currency: data.currency || 'TRY',
    category_id: data.category_id || 1,
    condition_grade: data.condition_grade || data.condition || 'new',
    status: data.status || 'active',
    slug: data.slug || `test-product-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  };

  const [result] = await pool.query(
    `INSERT INTO listings (seller_id, title, description_md, price_minor, currency, category_id, condition_grade, status, slug)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      listingData.seller_id,
      listingData.title,
      listingData.description_md,
      listingData.price_minor,
      listingData.currency,
      listingData.category_id,
      listingData.condition_grade,
      listingData.status,
      listingData.slug
    ]
  );

  return { ...listingData, id: result.insertId };
}

// Create test cart
async function createTestCart(userId) {
  const pool = await getTestPool();

  const [result] = await pool.query(
    'INSERT INTO carts (user_id) VALUES (?)',
    [userId]
  );

  return { id: result.insertId, user_id: userId };
}

// Add item to cart
async function addCartItem(cartId, listingId, quantity = 1) {
  const pool = await getTestPool();

  const [listing] = await pool.query(
    'SELECT price_minor FROM listings WHERE id = ?',
    [listingId]
  );

  if (!listing.length) {
    throw new Error('Listing not found');
  }

  const [result] = await pool.query(
    'INSERT INTO cart_items (cart_id, listing_id, quantity, unit_price_minor) VALUES (?, ?, ?, ?)',
    [cartId, listingId, quantity, listing[0].price_minor]
  );

  return { id: result.insertId, cart_id: cartId, listing_id: listingId, quantity };
}

// Close test database connection
async function closeTestDb() {
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
}

module.exports = {
  getTestPool,
  cleanupTestData,
  createTestUser,
  createTestListing,
  createTestCart,
  addCartItem,
  closeTestDb
};