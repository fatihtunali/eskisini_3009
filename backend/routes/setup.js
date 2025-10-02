// backend/routes/setup.js - API endpoint ile veritabanı kurulumu
const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const { pool } = require('../db.js');

const router = express.Router();

// Güvenlik için admin key kontrolü
router.use((req, res, next) => {
  const adminKey = req.headers['x-admin-key'] || req.query.admin_key;
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ 
      ok: false, 
      error: 'Admin key gerekli. Header: x-admin-key veya query: ?admin_key=xxx' 
    });
  }
  next();
});

// Veritabanı kurulumu endpoint'i
router.post('/database', async (req, res) => {
  try {
    console.log('🔄 Veritabanı kurulumu başlatıldı...');
    
    // SQL dosyasını oku
    const sqlFilePath = path.join(__dirname, '../../database/legal_compliance.sql');
    const sqlContent = await fs.readFile(sqlFilePath, 'utf8');
    
    // SQL komutlarını ayır
    const sqlCommands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    const results = [];
    let successCount = 0;
    let skipCount = 0;

    // Her SQL komutunu çalıştır
    for (const command of sqlCommands) {
      try {
        if (command.trim()) {
          await pool.execute(command);
          
          if (command.includes('CREATE TABLE')) {
            const tableName = command.match(/CREATE TABLE (?:IF NOT EXISTS )?(\\w+)/i)?.[1];
            results.push({ type: 'table_created', table: tableName, status: 'success' });
            successCount++;
          } else if (command.includes('INSERT') || command.includes('ALTER')) {
            results.push({ type: 'command_executed', command: command.substring(0, 50) + '...', status: 'success' });
            successCount++;
          }
        }
      } catch (error) {
        if (error.code === 'ER_TABLE_EXISTS_ERROR') {
          results.push({ type: 'table_exists', table: 'existing', status: 'skipped' });
          skipCount++;
        } else if (error.code === 'ER_DUP_KEYNAME') {
          results.push({ type: 'index_exists', status: 'skipped' });
          skipCount++;
        } else {
          results.push({ 
            type: 'error', 
            command: command.substring(0, 50) + '...', 
            error: error.message,
            status: 'failed' 
          });
        }
      }
    }

    // Mevcut tabloları listele
    const [tables] = await pool.execute('SHOW TABLES');
    const legalTables = tables
      .map(table => Object.values(table)[0])
      .filter(tableName => 
        tableName.includes('kvkk') || 
        tableName.includes('consent') || 
        tableName.includes('complaint') || 
        tableName.includes('tax') || 
        tableName.includes('invoice') || 
        tableName.includes('audit') || 
        tableName.includes('security') || 
        tableName.includes('cookie') || 
        tableName.includes('legal') || 
        tableName.includes('data_request')
      );

    res.json({
      ok: true,
      message: 'Veritabanı kurulumu tamamlandı',
      stats: {
        success_count: successCount,
        skip_count: skipCount,
        total_legal_tables: legalTables.length
      },
      legal_tables: legalTables,
      detailed_results: results
    });

  } catch (error) {
    console.error('Veritabanı kurulum hatası:', error);
    res.status(500).json({
      ok: false,
      error: 'database_setup_failed',
      message: error.message
    });
  }
});

// Tablo durumunu kontrol et
router.get('/status', async (req, res) => {
  try {
    const [tables] = await pool.execute('SHOW TABLES');
    const allTables = tables.map(table => Object.values(table)[0]);
    
    const requiredTables = [
      'kvkk_consent_texts',
      'user_consents', 
      'data_requests',
      'tax_reports',
      'invoices',
      'complaints',
      'complaint_attachments',
      'complaint_history',
      'audit_logs',
      'security_events',
      'cookie_consents',
      'legal_document_reads'
    ];

    const existingLegalTables = requiredTables.filter(table => allTables.includes(table));
    const missingTables = requiredTables.filter(table => !allTables.includes(table));

    const isComplete = missingTables.length === 0;

    res.json({
      ok: true,
      database_setup_complete: isComplete,
      total_tables: allTables.length,
      legal_tables_count: existingLegalTables.length,
      existing_legal_tables: existingLegalTables,
      missing_tables: missingTables,
      completion_percentage: Math.round((existingLegalTables.length / requiredTables.length) * 100)
    });

  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'status_check_failed',
      message: error.message
    });
  }
});

// Örnek veri ekleme
router.post('/sample-data', async (req, res) => {
  try {
    const results = [];

    // KVKK rıza metnini ekle
    const [existing] = await pool.execute(
      'SELECT COUNT(*) as count FROM kvkk_consent_texts WHERE version = ?', 
      ['v1.0']
    );

    if (existing[0].count === 0) {
      await pool.execute(`
        INSERT INTO kvkk_consent_texts (content, version, is_active) VALUES 
        ('Kişisel verilerinizin işlenmesi ve korunması konusundaki aydınlatma metnimizi okudum ve kabul ediyorum. Verilerimin platform işleyişi için kullanılmasına onay veriyorum.', 'v1.0', TRUE)
      `);
      results.push({ type: 'kvkk_consent_text', status: 'added' });
    } else {
      results.push({ type: 'kvkk_consent_text', status: 'already_exists' });
    }

    res.json({
      ok: true,
      message: 'Örnek veriler işlendi',
      results: results
    });

  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'sample_data_failed',
      message: error.message
    });
  }
});

module.exports = router;