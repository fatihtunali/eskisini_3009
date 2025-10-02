const express = require('express');
const { authRequired } = require('../../mw/auth.js');
const { pool } = require('../../db.js');

const router = express.Router();

// KVKK rıza metni getirme
router.get('/consent-text', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT content, version, created_at 
      FROM kvkk_consent_texts 
      WHERE is_active = 1 
      ORDER BY version DESC 
      LIMIT 1
    `);
    
    if (rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'consent_text_not_found'
      });
    }

    res.json({
      ok: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('KVKK consent text error:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error'
    });
  }
});

// Kullanıcı rızasını kaydetme
router.post('/give-consent', authRequired, async (req, res) => {
  try {
    const { consent_type, kvkk_version } = req.body;
    const user_id = req.user.id;

    if (!consent_type || !kvkk_version) {
      return res.status(400).json({
        ok: false,
        error: 'missing_required_fields'
      });
    }

    // Mevcut rızayı kontrol et
    const [existing] = await pool.execute(`
      SELECT id FROM user_consents 
      WHERE user_id = ? AND consent_type = ?
    `, [user_id, consent_type]);

    if (existing.length > 0) {
      // Güncelle
      await pool.execute(`
        UPDATE user_consents 
        SET granted_at = NOW(), kvkk_version = ?, is_active = 1
        WHERE user_id = ? AND consent_type = ?
      `, [kvkk_version, user_id, consent_type]);
    } else {
      // Yeni kayıt
      await pool.execute(`
        INSERT INTO user_consents (user_id, consent_type, granted_at, kvkk_version, is_active)
        VALUES (?, ?, NOW(), ?, 1)
      `, [user_id, consent_type, kvkk_version]);
    }

    res.json({
      ok: true,
      message: 'consent_saved'
    });
  } catch (error) {
    console.error('KVKK consent save error:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error'
    });
  }
});

// Kullanıcı rızasını geri çekme
router.post('/withdraw-consent', authRequired, async (req, res) => {
  try {
    const { consent_type } = req.body;
    const user_id = req.user.id;

    await pool.execute(`
      UPDATE user_consents 
      SET is_active = 0, withdrawn_at = NOW()
      WHERE user_id = ? AND consent_type = ?
    `, [user_id, consent_type]);

    res.json({
      ok: true,
      message: 'consent_withdrawn'
    });
  } catch (error) {
    console.error('KVKK consent withdraw error:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error'
    });
  }
});

// Kullanıcının verilerini indirme (KVKK m.11)
router.get('/export-data', authRequired, async (req, res) => {
  try {
    const user_id = req.user.id;
    
    // Kullanıcı verileri
    const [userData] = await pool.execute(`
      SELECT u.*, up.* 
      FROM users u 
      LEFT JOIN user_profiles up ON u.id = up.user_id 
      WHERE u.id = ?
    `, [user_id]);

    // Kullanıcının ilanları
    const [listings] = await pool.execute(`
      SELECT * FROM listings WHERE seller_id = ?
    `, [user_id]);

    // İşlemler
    const [transactions] = await pool.execute(`
      SELECT * FROM transactions 
      WHERE buyer_id = ? OR seller_id = ?
    `, [user_id, user_id]);

    // Mesajlar
    const [messages] = await pool.execute(`
      SELECT * FROM messages 
      WHERE sender_id = ? OR recipient_id = ?
    `, [user_id, user_id]);

    const exportData = {
      user_data: userData[0],
      listings: listings,
      transactions: transactions,
      messages: messages,
      export_date: new Date().toISOString()
    };

    // İndirme kaydı tut
    await pool.execute(`
      INSERT INTO data_requests (user_id, request_type, status, processed_at)
      VALUES (?, 'export', 'completed', NOW())
    `, [user_id]);

    res.json({
      ok: true,
      data: exportData
    });
  } catch (error) {
    console.error('Data export error:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error'
    });
  }
});

// Hesap silme talebi (KVKK m.7 - Unutulma hakkı)
router.post('/delete-account', authRequired, async (req, res) => {
  try {
    const user_id = req.user.id;

    // Aktif işlemleri kontrol et
    const [activeTransactions] = await pool.execute(`
      SELECT COUNT(*) as count FROM transactions 
      WHERE (buyer_id = ? OR seller_id = ?) 
      AND status IN ('pending', 'processing', 'shipped')
    `, [user_id, user_id]);

    if (activeTransactions[0].count > 0) {
      return res.status(400).json({
        ok: false,
        error: 'active_transactions_exist',
        message: 'Aktif işlemleriniz tamamlanmadan hesabınızı silemezsiniz'
      });
    }

    // Silme talebini kaydet
    await pool.execute(`
      INSERT INTO data_requests (user_id, request_type, status, created_at)
      VALUES (?, 'deletion', 'pending', NOW())
    `, [user_id]);

    res.json({
      ok: true,
      message: 'deletion_request_submitted',
      info: 'Hesap silme talebiniz kaydedildi. 30 gün içinde işleme alınacaktır.'
    });
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error'
    });
  }
});

// Kullanıcının rıza durumlarını getir
router.get('/my-consents', authRequired, async (req, res) => {
  try {
    const user_id = req.user.id;
    
    const [consents] = await pool.execute(`
      SELECT consent_type, granted_at, withdrawn_at, kvkk_version, is_active
      FROM user_consents 
      WHERE user_id = ?
      ORDER BY granted_at DESC
    `, [user_id]);

    res.json({
      ok: true,
      data: consents
    });
  } catch (error) {
    console.error('Get consents error:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error'
    });
  }
});

module.exports = router;