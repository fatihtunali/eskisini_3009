// backend/db.js
const mysql = require('mysql2/promise');
require('dotenv/config');

const {
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASS,
  DB_NAME,
  DB_SSL
} = process.env;

const ssl = DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined;

const pool = mysql.createPool({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // ÖNEMLİ: charset => 'utf8mb4' (collation'ı tablo/DB belirler)
  charset: 'utf8mb4',
  ssl,
  // Connection timeout and keepalive settings
  connectTimeout: 60000, // 60 seconds
  acquireTimeout: 60000, // 60 seconds
  timeout: 60000, // 60 seconds
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// db is an alias for pool for compatibility
const db = pool;

async function pingDb(){
  const conn = await pool.getConnection();
  try {
    await conn.ping();
    console.log(
      '[DB] connected:',
      `${DB_HOST}:${DB_PORT}/${DB_NAME}`,
      '| ssl=', (DB_SSL === 'true' ? 'on' : 'off')
    );
  } finally {
    conn.release();
  }
}

module.exports = {
  pool,
  db,
  pingDb
};

// Also export pool as default for backward compatibility
module.exports.default = pool;
