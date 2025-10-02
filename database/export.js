const { pool } = require('../backend/db.js');
const fs = require('fs');

(async () => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `database-schema-${timestamp}.sql`;

    console.log('🔍 Starting database schema export...');

    let content = `-- Database Schema Export
-- Generated: ${new Date().toISOString()}
-- Database: eskisini_db

`;

    const [tables] = await pool.query(`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'eskisini_db' ORDER BY TABLE_NAME`);

    console.log(`📊 Found ${tables.length} tables`);

    for (let i = 0; i < tables.length; i++) {
      const tableName = tables[i].TABLE_NAME;
      console.log(`📋 Processing ${i+1}/${tables.length}: ${tableName}`);

      content += `
-- ========================================
-- Table: ${tableName}
-- ========================================

`;

      try {
        // Get CREATE TABLE statement
        const [createResult] = await pool.query('SHOW CREATE TABLE ??', [tableName]);
        if (createResult && createResult[0]) {
          content += createResult[0]['Create Table'] + ';\n\n';
        }

        // Get column info
        const [columns] = await pool.query(`
          SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = 'eskisini_db' AND TABLE_NAME = ?
          ORDER BY ORDINAL_POSITION
        `, [tableName]);

        content += `-- Columns (${columns.length}):\n`;
        columns.forEach(col => {
          content += `--   ${col.COLUMN_NAME}: ${col.DATA_TYPE}`;
          if (col.IS_NULLABLE === 'NO') content += ' NOT NULL';
          if (col.COLUMN_DEFAULT !== null) content += ` DEFAULT ${col.COLUMN_DEFAULT}`;
          if (col.EXTRA) content += ` ${col.EXTRA}`;
          content += '\n';
        });

        // Get record count
        const [countResult] = await pool.query('SELECT COUNT(*) as cnt FROM ??', [tableName]);
        const recordCount = countResult[0]?.cnt || 0;
        content += `-- Records: ${recordCount}\n`;

      } catch (err) {
        content += `-- Error: ${err.message}\n`;
        console.log(`❌ Error with ${tableName}: ${err.message}`);
      }

      content += '\n';
    }

    // Get foreign keys
    try {
      const [fks] = await pool.query(`
        SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = 'eskisini_db' AND REFERENCED_TABLE_NAME IS NOT NULL
        ORDER BY TABLE_NAME
      `);

      if (fks.length > 0) {
        content += `
-- ========================================
-- FOREIGN KEY RELATIONSHIPS (${fks.length})
-- ========================================

`;
        fks.forEach(fk => {
          content += `-- ${fk.TABLE_NAME}.${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}\n`;
        });
      }
    } catch (err) {
      content += `-- Error getting foreign keys: ${err.message}\n`;
    }

    content += `
-- ========================================
-- EXPORT SUMMARY
-- ========================================
-- Total tables: ${tables.length}
-- Export completed: ${new Date().toISOString()}
`;

    fs.writeFileSync(filename, content);

    console.log(`✅ Schema exported to: ${filename}`);
    console.log(`📄 File size: ${(fs.statSync(filename).size / 1024).toFixed(2)} KB`);

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    if (pool) await pool.end();
    process.exit(0);
  }
})();