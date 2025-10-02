const express = require('express');
const { authRequired } = require('../../mw/auth.js');
const { pool } = require('../../db.js');

const router = express.Router();

// Şikayet kategorilerini getir
router.get('/categories', async (req, res) => {
  try {
    const categories = [
      { id: 'product_quality', name: 'Ürün Kalitesi', name_en: 'Product Quality' },
      { id: 'shipping', name: 'Kargo/Teslimat', name_en: 'Shipping/Delivery' },
      { id: 'payment', name: 'Ödeme', name_en: 'Payment' },
      { id: 'seller_behavior', name: 'Satıcı Davranışı', name_en: 'Seller Behavior' },
      { id: 'platform_technical', name: 'Platform Teknik', name_en: 'Platform Technical' },
      { id: 'refund_return', name: 'İade/Değişim', name_en: 'Refund/Return' },
      { id: 'fraud_scam', name: 'Dolandırıcılık', name_en: 'Fraud/Scam' },
      { id: 'privacy_kvkk', name: 'Gizlilik/KVKK', name_en: 'Privacy/GDPR' },
      { id: 'other', name: 'Diğer', name_en: 'Other' }
    ];

    res.json({
      ok: true,
      data: categories
    });
  } catch (error) {
    console.error('Get complaint categories error:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error'
    });
  }
});

// Yeni şikayet oluştur
router.post('/create', authRequired, async (req, res) => {
  try {
    const {
      category,
      subject,
      description,
      transaction_id,
      listing_id,
      urgency_level = 'medium',
      attachments = []
    } = req.body;

    const user_id = req.user.id;

    if (!category || !subject || !description) {
      return res.status(400).json({
        ok: false,
        error: 'missing_required_fields'
      });
    }

    // Şikayet numarası oluştur
    const complaint_number = `COMP-${Date.now()}-${user_id}`;

    // Veritabanına kaydet
    const [result] = await pool.execute(`
      INSERT INTO complaints (
        complaint_number, user_id, category, subject, description,
        transaction_id, listing_id, urgency_level, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', NOW())
    `, [
      complaint_number,
      user_id,
      category,
      subject,
      description,
      transaction_id || null,
      listing_id || null,
      urgency_level
    ]);

    const complaint_id = result.insertId;

    // Ekler varsa kaydet
    if (attachments.length > 0) {
      for (const attachment of attachments) {
        await pool.execute(`
          INSERT INTO complaint_attachments (complaint_id, filename, file_url, uploaded_at)
          VALUES (?, ?, ?, NOW())
        `, [complaint_id, attachment.filename, attachment.url]);
      }
    }

    // E-posta bildirimi gönder (örnek)
    // await sendComplaintNotification(complaint_id, complaint_number);

    res.json({
      ok: true,
      data: {
        complaint_id,
        complaint_number,
        message: 'complaint_created_successfully'
      }
    });
  } catch (error) {
    console.error('Create complaint error:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error'
    });
  }
});

// Kullanıcının şikayetlerini listele
router.get('/my-complaints', authRequired, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE user_id = ?';
    let params = [user_id];

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    const [complaints] = await pool.execute(`
      SELECT 
        id, complaint_number, category, subject, status, 
        urgency_level, created_at, updated_at, admin_response
      FROM complaints 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    // Toplam sayı
    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total FROM complaints ${whereClause}
    `, params);

    res.json({
      ok: true,
      data: complaints,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Get my complaints error:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error'
    });
  }
});

// Şikayet detayını getir
router.get('/:complaint_id', authRequired, async (req, res) => {
  try {
    const { complaint_id } = req.params;
    const user_id = req.user.id;

    const [complaint] = await pool.execute(`
      SELECT * FROM complaints 
      WHERE id = ? AND user_id = ?
    `, [complaint_id, user_id]);

    if (complaint.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'complaint_not_found'
      });
    }

    // Ekler
    const [attachments] = await pool.execute(`
      SELECT filename, file_url, uploaded_at 
      FROM complaint_attachments 
      WHERE complaint_id = ?
    `, [complaint_id]);

    // Şikayet geçmişi/yorumları
    const [history] = await pool.execute(`
      SELECT message, created_by, created_at, is_admin_response
      FROM complaint_history 
      WHERE complaint_id = ?
      ORDER BY created_at ASC
    `, [complaint_id]);

    res.json({
      ok: true,
      data: {
        ...complaint[0],
        attachments,
        history
      }
    });
  } catch (error) {
    console.error('Get complaint detail error:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error'
    });
  }
});

// Şikayete yanıt ekle
router.post('/:complaint_id/reply', authRequired, async (req, res) => {
  try {
    const { complaint_id } = req.params;
    const { message } = req.body;
    const user_id = req.user.id;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'message_required'
      });
    }

    // Şikayetin kullanıcıya ait olduğunu kontrol et
    const [complaint] = await pool.execute(`
      SELECT id, status FROM complaints 
      WHERE id = ? AND user_id = ?
    `, [complaint_id, user_id]);

    if (complaint.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'complaint_not_found'
      });
    }

    if (complaint[0].status === 'closed') {
      return res.status(400).json({
        ok: false,
        error: 'complaint_already_closed'
      });
    }

    // Yanıtı kaydet
    await pool.execute(`
      INSERT INTO complaint_history (complaint_id, message, created_by, is_admin_response, created_at)
      VALUES (?, ?, ?, 0, NOW())
    `, [complaint_id, message.trim(), user_id]);

    // Şikayet durumunu güncelle (varsa)
    await pool.execute(`
      UPDATE complaints 
      SET status = 'user_replied', updated_at = NOW()
      WHERE id = ?
    `, [complaint_id]);

    res.json({
      ok: true,
      message: 'reply_added_successfully'
    });
  } catch (error) {
    console.error('Add complaint reply error:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error'
    });
  }
});

// Şikayeti kapat (kullanıcı tarafından)
router.post('/:complaint_id/close', authRequired, async (req, res) => {
  try {
    const { complaint_id } = req.params;
    const { satisfaction_rating, feedback } = req.body;
    const user_id = req.user.id;

    // Şikayetin kullanıcıya ait olduğunu kontrol et
    const [complaint] = await pool.execute(`
      SELECT id FROM complaints 
      WHERE id = ? AND user_id = ?
    `, [complaint_id, user_id]);

    if (complaint.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'complaint_not_found'
      });
    }

    // Şikayeti kapat
    await pool.execute(`
      UPDATE complaints 
      SET status = 'closed_by_user', 
          satisfaction_rating = ?, 
          user_feedback = ?,
          closed_at = NOW(),
          updated_at = NOW()
      WHERE id = ?
    `, [satisfaction_rating || null, feedback || null, complaint_id]);

    // Kapanış kaydı ekle
    await pool.execute(`
      INSERT INTO complaint_history (complaint_id, message, created_by, is_admin_response, created_at)
      VALUES (?, 'Şikayet kullanıcı tarafından kapatıldı.', ?, 0, NOW())
    `, [complaint_id, user_id]);

    res.json({
      ok: true,
      message: 'complaint_closed_successfully'
    });
  } catch (error) {
    console.error('Close complaint error:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error'
    });
  }
});

// Şikayet istatistikleri (kullanıcı için)
router.get('/stats/my-stats', authRequired, async (req, res) => {
  try {
    const user_id = req.user.id;

    // Durum bazlı sayılar
    const [statusStats] = await pool.execute(`
      SELECT 
        status,
        COUNT(*) as count
      FROM complaints 
      WHERE user_id = ?
      GROUP BY status
    `, [user_id]);

    // Kategori bazlı sayılar
    const [categoryStats] = await pool.execute(`
      SELECT 
        category,
        COUNT(*) as count
      FROM complaints 
      WHERE user_id = ?
      GROUP BY category
    `, [user_id]);

    // Genel istatistikler
    const [generalStats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_complaints,
        AVG(satisfaction_rating) as avg_satisfaction,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count,
        AVG(TIMESTAMPDIFF(HOUR, created_at, closed_at)) as avg_resolution_hours
      FROM complaints 
      WHERE user_id = ?
    `, [user_id]);

    res.json({
      ok: true,
      data: {
        status_breakdown: statusStats,
        category_breakdown: categoryStats,
        general_stats: generalStats[0]
      }
    });
  } catch (error) {
    console.error('Get complaint stats error:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error'
    });
  }
});

module.exports = router;