// backend/routes/trade.js
const { Router } = require('express');
const { pool } = require('../db.js');
const { authRequired } = require('../mw/auth.js');
const notificationService = require('../services/notifications.js');

const r = Router();

/**
 * NOTLAR
 * - Global exclusivity YOK: aynı ilanda farklı kullanıcılar eşzamanlı "pending" teklif açabilir.
 * - Sadece aynı kullanıcının aynı ilanda ikinci "pending" teklifi INSERT edilmez (kullanıcı bazlı kısıt).
 * - Satıcı, gelen teklifleri /offer/:id/accept veya /offer/:id/reject ile yönetir.
 * - Teklif sahibi pending durumdaki teklifini /offer/:id/withdraw ile geri çekebilir.
 */

/** Teklif oluştur */
r.post('/offer', authRequired, async (req, res) => {
  try {
    const uid = req.user.id;
    const listing_id = Number(req.body?.listing_id || 0);
    const offered_text = (req.body?.offered_text || '').toString().trim() || null;
    const cash_adjust_minor = Number(req.body?.cash_adjust_minor || 0);

    if (!listing_id) {
      return res.status(400).json({ ok:false, error:'bad_listing_id' });
    }
    if (!Number.isFinite(cash_adjust_minor)) {
      return res.status(400).json({ ok:false, error:'bad_cash' });
    }

    // İlanı al
    const [[l]] = await pool.query(
      `SELECT id, seller_id, status FROM listings WHERE id=? LIMIT 1`,
      [listing_id]
    );
    if (!l) return res.status(404).json({ ok:false, error:'listing_not_found' });
    if (l.status !== 'active') return res.status(409).json({ ok:false, error:'listing_not_active' });
    if (l.seller_id === uid) return res.status(400).json({ ok:false, error:'cant_offer_own_listing' });

    // Aynı kullanıcı -> aynı ilanda halihazırda pending teklifi varsa yenisini açma
    const [[exists]] = await pool.query(
      `SELECT id FROM trade_offers
        WHERE listing_id=? AND offerer_id=? AND status='pending'
        LIMIT 1`,
      [listing_id, uid]
    );
    if (exists) {
      return res.status(409).json({ ok:false, error:'offer_already_pending', offer_id: exists.id });
    }

    // INSERT (seller_id tabloya yazmıyoruz; join ile l.seller_id alınır)
    const [ins] = await pool.query(
      `INSERT INTO trade_offers
         (listing_id, offerer_id, offered_text, cash_adjust_minor, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', NOW(), NOW())`,
      [listing_id, uid, offered_text, cash_adjust_minor]
    );

    // Get offerer info for notification
    const [[offerer]] = await pool.query(
      `SELECT full_name, username FROM users WHERE id = ?`,
      [uid]
    );

    const [[listing]] = await pool.query(
      `SELECT title FROM listings WHERE id = ?`,
      [listing_id]
    );

    // Send notification to seller
    try {
      await notificationService.sendTradeOfferNotification(l.seller_id, {
        tradeId: ins.insertId,
        senderName: offerer?.full_name || offerer?.username || 'Bir kullanıcı',
        listingTitle: listing?.title || 'İlan'
      });
    } catch (notifError) {
      console.error('Failed to send trade offer notification:', notifError);
      // Don't fail the request if notification fails
    }

    return res.json({ ok:true, id: ins.insertId });
  } catch (e) {
    console.error('POST /trade/offer error =>', e);
    return res.status(500).json({ ok:false, error:'server_error' });
  }
});

/** Benim tekliflerim (gönderdiğim / aldığım) */
r.get('/my', authRequired, async (req, res) => {
  const uid = req.user.id;
  const role = (req.query.role || 'sent'); // 'sent' | 'received'

  if (role === 'received') {
    // Satıcı olduğum ilanlara gelen teklifler
    const [rows] = await pool.query(
      `SELECT o.id, o.listing_id, o.offerer_id, o.offered_text, o.cash_adjust_minor, o.status, o.created_at, o.updated_at,
              l.title, l.price_minor, l.currency,
              u.full_name AS offerer_name,
              ts.id as trade_session_id
         FROM trade_offers o
         JOIN listings l ON l.id = o.listing_id
         JOIN users    u ON u.id = o.offerer_id
         LEFT JOIN trade_sessions ts ON ts.trade_offer_id = o.id
        WHERE l.seller_id = ?
        ORDER BY o.created_at DESC
        LIMIT 200`,
      [uid]
    );
    return res.json({ ok:true, items: rows, role: 'received' });
  }

  // Gönderdiğim teklifler
  const [rows] = await pool.query(
    `SELECT o.id, o.listing_id, o.offerer_id, o.offered_text, o.cash_adjust_minor, o.status, o.created_at, o.updated_at,
            l.title, l.price_minor, l.currency,
            s.full_name AS seller_name,
            ts.id as trade_session_id
       FROM trade_offers o
       JOIN listings l ON l.id = o.listing_id
       JOIN users    s ON s.id = l.seller_id
       LEFT JOIN trade_sessions ts ON ts.trade_offer_id = o.id
      WHERE o.offerer_id = ?
      ORDER BY o.created_at DESC
      LIMIT 200`,
    [uid]
  );
  return res.json({ ok:true, items: rows, role: 'sent' });
});

/** (Satıcı) Bir ilandaki tüm teklifleri getir */
r.get('/listing/:listing_id/offers', authRequired, async (req, res) => {
  const uid = req.user.id;
  const listing_id = Number(req.params.listing_id || 0);
  if (!listing_id) return res.status(400).json({ ok:false, error:'bad_listing_id' });

  const [[l]] = await pool.query(
    `SELECT id, seller_id FROM listings WHERE id=? LIMIT 1`,
    [listing_id]
  );
  if (!l) return res.status(404).json({ ok:false, error:'listing_not_found' });
  if (l.seller_id !== uid) return res.status(403).json({ ok:false, error:'forbidden' });

  const [rows] = await pool.query(
    `SELECT o.id, o.offerer_id, o.offered_text, o.cash_adjust_minor, o.status, o.created_at, o.updated_at,
            u.full_name AS offerer_name
       FROM trade_offers o
       JOIN users u ON u.id = o.offerer_id
      WHERE o.listing_id = ?
      ORDER BY o.created_at DESC`,
    [listing_id]
  );

  return res.json({ ok:true, listing_id, offers: rows });
});

/** (Satıcı) Teklifi KABUL ET */
r.post('/offer/:id/accept', authRequired, async (req, res) => {
  const uid = req.user.id;
  const offerId = Number(req.params.id || 0);
  if (!offerId) return res.status(400).json({ ok:false, error:'bad_offer_id' });

  // Teklifi ve ilgili ilanı al
  const [[o]] = await pool.query(
    `SELECT o.id, o.status, o.listing_id, l.seller_id
       FROM trade_offers o
       JOIN listings l ON l.id = o.listing_id
      WHERE o.id = ?
      LIMIT 1`,
    [offerId]
  );
  if (!o) return res.status(404).json({ ok:false, error:'offer_not_found' });
  if (o.seller_id !== uid) return res.status(403).json({ ok:false, error:'forbidden' });
  if (o.status !== 'pending') return res.status(409).json({ ok:false, error:'not_pending' });

  // Transaction başlat - tüm işlemler başarılı olmalı
  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    // 1. Teklifi kabul et
    await connection.query(
      `UPDATE trade_offers
          SET status='accepted', updated_at=NOW()
        WHERE id=? AND status='pending'`,
      [offerId]
    );

    // 2. İlanı "reserved" duruma getir (artık başka alıcı alamaz)
    await connection.query(
      `UPDATE listings
          SET status='reserved', updated_at=NOW()
        WHERE id=? AND status='active'`,
      [o.listing_id]
    );

    // 3. Aynı ilandaki diğer pending teklifleri otomatik reddet
    await connection.query(
      `UPDATE trade_offers
          SET status='rejected', updated_at=NOW()
        WHERE listing_id=? AND id!=? AND status='pending'`,
      [o.listing_id, offerId]
    );

    // 4. Takas kaydı oluştur (trade_sessions tablosu)
    const [tradeSession] = await connection.query(
      `INSERT INTO trade_sessions
         (listing_id, seller_id, buyer_id, trade_offer_id, status, created_at, updated_at)
       VALUES (?, ?, (SELECT offerer_id FROM trade_offers WHERE id=?), ?, 'coordination', NOW(), NOW())`,
      [o.listing_id, o.seller_id, offerId, offerId]
    );

    await connection.commit();
    connection.release();

    // Get details for notification
    const [[tradeDetails]] = await pool.query(`
      SELECT o.offerer_id, l.title as listing_title, u.full_name, u.username
      FROM trade_offers o
      JOIN listings l ON o.listing_id = l.id
      JOIN users u ON o.offerer_id = u.id
      WHERE o.id = ?
    `, [offerId]);

    // Send notification to offer maker (async, don't block response)
    if (tradeDetails) {
      setImmediate(async () => {
        try {
          await notificationService.createNotification({
            userId: tradeDetails.offerer_id,
            type: 'trade_offer',
            title: 'Takas Teklifi Kabul Edildi! 🎉',
            body: `"${tradeDetails.listing_title}" için verdiğiniz takas teklifi kabul edildi!`,
            data: {
              tradeId: offerId,
              tradeSessionId: tradeSession.insertId,
              listingTitle: tradeDetails.listing_title,
              status: 'accepted',
              action_url: `/trade-session.html?sessionId=${tradeSession.insertId}`
            }
          });
        } catch (notifError) {
          console.error('Failed to send trade acceptance notification:', notifError);
        }
      });
    }

    return res.json({
      ok: true,
      offer_id: offerId,
      status: 'accepted',
      trade_session_id: tradeSession.insertId,
      message: 'Takas kabul edildi! Koordinasyon aşamasına geçildi.'
    });

  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Trade accept transaction failed:', error);
    return res.status(500).json({ ok: false, error: 'accept_transaction_failed' });
  }
});

/** (Satıcı) Teklifi REDDET */
r.post('/offer/:id/reject', authRequired, async (req, res) => {
  const uid = req.user.id;
  const offerId = Number(req.params.id || 0);
  if (!offerId) return res.status(400).json({ ok:false, error:'bad_offer_id' });

  const [[o]] = await pool.query(
    `SELECT o.id, o.status, o.listing_id, l.seller_id
       FROM trade_offers o
       JOIN listings l ON l.id = o.listing_id
      WHERE o.id = ?
      LIMIT 1`,
    [offerId]
  );
  if (!o) return res.status(404).json({ ok:false, error:'offer_not_found' });
  if (o.seller_id !== uid) return res.status(403).json({ ok:false, error:'forbidden' });
  if (o.status !== 'pending') return res.status(409).json({ ok:false, error:'not_pending' });

  await pool.query(
    `UPDATE trade_offers
        SET status='rejected', updated_at=NOW()
      WHERE id=? AND status='pending'`,
    [offerId]
  );

  // Get details for notification
  const [[tradeDetails]] = await pool.query(`
    SELECT o.offerer_id, l.title as listing_title
    FROM trade_offers o
    JOIN listings l ON o.listing_id = l.id
    WHERE o.id = ?
  `, [offerId]);

  // Send notification to offer maker (async, don't block response)
  if (tradeDetails) {
    setImmediate(async () => {
      try {
        await notificationService.createNotification({
          userId: tradeDetails.offerer_id,
          type: 'trade_offer',
          title: 'Takas Teklifi Reddedildi',
          body: `"${tradeDetails.listing_title}" için verdiğiniz takas teklifi reddedildi.`,
          data: {
            tradeId: offerId,
            listingTitle: tradeDetails.listing_title,
            status: 'rejected',
            action_url: `/profile.html?tab=trades`
          }
        });
      } catch (notifError) {
        console.error('Failed to send trade rejection notification:', notifError);
      }
    });
  }

  return res.json({ ok:true, offer_id: offerId, status:'rejected' });
});

/** (Teklif Sahibi) Teklifi GERİ ÇEK (withdraw) */
r.post('/offer/:id/withdraw', authRequired, async (req, res) => {
  const uid = req.user.id;
  const offerId = Number(req.params.id || 0);
  if (!offerId) return res.status(400).json({ ok:false, error:'bad_offer_id' });

  const [[o]] = await pool.query(
    `SELECT id, offerer_id, status FROM trade_offers WHERE id=? LIMIT 1`,
    [offerId]
  );
  if (!o) return res.status(404).json({ ok:false, error:'offer_not_found' });
  if (o.offerer_id !== uid) return res.status(403).json({ ok:false, error:'forbidden' });
  if (o.status !== 'pending') return res.status(409).json({ ok:false, error:'not_pending' });

  await pool.query(
    `UPDATE trade_offers
        SET status='withdrawn', updated_at=NOW()
      WHERE id=? AND status='pending'`,
    [offerId]
  );

  return res.json({ ok:true, offer_id: offerId, status:'withdrawn' });
});

/** Trade Sessions - Takas Koordinasyon API'leri */

// Kullanıcının aktif takas session'larını getir
r.get('/sessions/my', authRequired, async (req, res) => {
  try {
    const uid = req.user.id;
    const role = req.query.role || 'all'; // 'seller', 'buyer', 'all'

    let whereClause = '';
    let params = [];

    if (role === 'seller') {
      whereClause = 'WHERE ts.seller_id = ?';
      params = [uid];
    } else if (role === 'buyer') {
      whereClause = 'WHERE ts.buyer_id = ?';
      params = [uid];
    } else {
      whereClause = 'WHERE ts.seller_id = ? OR ts.buyer_id = ?';
      params = [uid, uid];
    }

    const [rows] = await pool.query(
      `SELECT ts.*,
              l.title as listing_title, l.price_minor, l.currency,
              seller.full_name as seller_name,
              buyer.full_name as buyer_name,
              to_offer.offered_text, to_offer.cash_adjust_minor
       FROM trade_sessions ts
       JOIN listings l ON l.id = ts.listing_id
       JOIN users seller ON seller.id = ts.seller_id
       JOIN users buyer ON buyer.id = ts.buyer_id
       JOIN trade_offers to_offer ON to_offer.id = ts.trade_offer_id
       ${whereClause}
       ORDER BY ts.updated_at DESC
       LIMIT 50`,
      params
    );

    // Her session için kullanıcının rolünü belirle
    const sessions = rows.map(session => ({
      ...session,
      user_role: session.seller_id === uid ? 'seller' : 'buyer',
      other_party_name: session.seller_id === uid ? session.buyer_name : session.seller_name,
      other_party_id: session.seller_id === uid ? session.buyer_id : session.seller_id
    }));

    return res.json({ ok: true, sessions });
  } catch (e) {
    console.error('GET /trade/sessions/my error =>', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Belirli bir trade session detayını getir
r.get('/sessions/:id', authRequired, async (req, res) => {
  try {
    const uid = req.user.id;
    const sessionId = Number(req.params.id || 0);

    if (!sessionId) {
      return res.status(400).json({ ok: false, error: 'bad_session_id' });
    }

    const [[session]] = await pool.query(
      `SELECT ts.*,
              l.title as listing_title, l.description_md as listing_description,
              l.price_minor, l.currency, li.file_url as cover_url,
              seller.full_name as seller_name, seller.phone_e164 as seller_phone,
              buyer.full_name as buyer_name, buyer.phone_e164 as buyer_phone,
              to_offer.offered_text, to_offer.cash_adjust_minor
       FROM trade_sessions ts
       JOIN listings l ON l.id = ts.listing_id
       LEFT JOIN listing_images li ON li.listing_id = l.id AND li.id = (
         SELECT id FROM listing_images li2 WHERE li2.listing_id = l.id ORDER BY sort_order, id LIMIT 1
       )
       JOIN users seller ON seller.id = ts.seller_id
       JOIN users buyer ON buyer.id = ts.buyer_id
       JOIN trade_offers to_offer ON to_offer.id = ts.trade_offer_id
       WHERE ts.id = ? AND (ts.seller_id = ? OR ts.buyer_id = ?)
       LIMIT 1`,
      [sessionId, uid, uid]
    );

    if (!session) {
      return res.status(404).json({ ok: false, error: 'session_not_found' });
    }

    // Kullanıcının rolünü belirle
    session.user_role = session.seller_id === uid ? 'seller' : 'buyer';
    session.other_party_name = session.seller_id === uid ? session.buyer_name : session.seller_name;
    session.other_party_id = session.seller_id === uid ? session.buyer_id : session.seller_id;
    session.other_party_phone = session.seller_id === uid ? session.buyer_phone : session.seller_phone;

    return res.json({ ok: true, session });
  } catch (e) {
    console.error('GET /trade/sessions/:id error =>', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Buluşma detaylarını güncelle
r.put('/sessions/:id/meeting', authRequired, async (req, res) => {
  try {
    const uid = req.user.id;
    const sessionId = Number(req.params.id || 0);
    const { meeting_type, meeting_address, meeting_date, meeting_notes } = req.body;

    if (!sessionId) {
      return res.status(400).json({ ok: false, error: 'bad_session_id' });
    }

    // Session'ın varlığını ve kullanıcının yetkisini kontrol et
    const [[session]] = await pool.query(
      `SELECT id, seller_id, buyer_id, status FROM trade_sessions
       WHERE id = ? AND (seller_id = ? OR buyer_id = ?)
       LIMIT 1`,
      [sessionId, uid, uid]
    );

    if (!session) {
      return res.status(404).json({ ok: false, error: 'session_not_found' });
    }

    if (session.status === 'completed' || session.status === 'cancelled') {
      return res.status(409).json({ ok: false, error: 'session_closed' });
    }

    // Buluşma bilgilerini güncelle
    await pool.query(
      `UPDATE trade_sessions
       SET meeting_type = ?, meeting_address = ?, meeting_date = ?,
           meeting_notes = ?, status = 'meeting_arranged', updated_at = NOW()
       WHERE id = ?`,
      [meeting_type, meeting_address, meeting_date, meeting_notes, sessionId]
    );

    return res.json({ ok: true, message: 'Buluşma detayları güncellendi' });
  } catch (e) {
    console.error('PUT /trade/sessions/:id/meeting error =>', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Takas tamamlandı onayı
r.post('/sessions/:id/confirm', authRequired, async (req, res) => {
  try {
    const uid = req.user.id;
    const sessionId = Number(req.params.id || 0);

    if (!sessionId) {
      return res.status(400).json({ ok: false, error: 'bad_session_id' });
    }

    // Session'ı al
    const [[session]] = await pool.query(
      `SELECT id, seller_id, buyer_id, status, seller_confirmed, buyer_confirmed, listing_id
       FROM trade_sessions
       WHERE id = ? AND (seller_id = ? OR buyer_id = ?)
       LIMIT 1`,
      [sessionId, uid, uid]
    );

    if (!session) {
      return res.status(404).json({ ok: false, error: 'session_not_found' });
    }

    if (session.status === 'completed' || session.status === 'cancelled') {
      return res.status(409).json({ ok: false, error: 'session_closed' });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const isSeller = session.seller_id === uid;
      const confirmField = isSeller ? 'seller_confirmed' : 'buyer_confirmed';
      const otherConfirmField = isSeller ? 'buyer_confirmed' : 'seller_confirmed';

      // Kullanıcının onayını güncelle
      await connection.query(
        `UPDATE trade_sessions
         SET ${confirmField} = TRUE, updated_at = NOW()
         WHERE id = ?`,
        [sessionId]
      );

      // Diğer tarafın onayını kontrol et
      const [[updated]] = await connection.query(
        `SELECT ${otherConfirmField} as other_confirmed FROM trade_sessions WHERE id = ?`,
        [sessionId]
      );

      // Her iki taraf da onayladıysa takas tamamlandı
      if (updated.other_confirmed) {
        await connection.query(
          `UPDATE trade_sessions
           SET status = 'completed', completed_at = NOW(), updated_at = NOW()
           WHERE id = ?`,
          [sessionId]
        );

        // İlanı "traded" duruma getir
        await connection.query(
          `UPDATE listings
           SET status = 'traded', updated_at = NOW()
           WHERE id = ?`,
          [session.listing_id]
        );
      }

      await connection.commit();
      connection.release();

      const message = updated.other_confirmed
        ? 'Takas tamamlandı! 🎉'
        : 'Onayınız alındı. Diğer tarafın onayı bekleniyor...';

      return res.json({
        ok: true,
        completed: !!updated.other_confirmed,
        message
      });

    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }

  } catch (e) {
    console.error('POST /trade/sessions/:id/confirm error =>', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Kargo bilgilerini güncelle
r.put('/sessions/:id/shipping', authRequired, async (req, res) => {
  try {
    const uid = req.user.id;
    const sessionId = Number(req.params.id || 0);
    const {
      meeting_type,
      shipping_address,
      cargo_company,
      notes
    } = req.body;

    if (!sessionId) {
      return res.status(400).json({ ok: false, error: 'bad_session_id' });
    }

    if (meeting_type === 'cargo' && (!shipping_address || !cargo_company)) {
      return res.status(400).json({
        ok: false,
        error: 'Kargo için adres ve kargo firması gerekli'
      });
    }

    // Session'ın varlığını ve kullanıcının yetkisini kontrol et
    const [[session]] = await pool.query(
      `SELECT id, seller_id, buyer_id, status FROM trade_sessions
       WHERE id = ? AND (seller_id = ? OR buyer_id = ?)
       LIMIT 1`,
      [sessionId, uid, uid]
    );

    if (!session) {
      return res.status(404).json({ ok: false, error: 'session_not_found' });
    }

    if (session.status === 'completed' || session.status === 'cancelled') {
      return res.status(409).json({ ok: false, error: 'session_closed' });
    }

    // Kullanıcının rolüne göre uygun alanları güncelle
    const isSeller = session.seller_id === uid;
    const addressField = isSeller ? 'seller_shipping_address' : 'buyer_shipping_address';
    const cargoField = isSeller ? 'seller_cargo_company' : 'buyer_cargo_company';

    if (meeting_type === 'cargo') {
      await pool.query(
        `UPDATE trade_sessions
         SET meeting_type = ?, ${addressField} = ?, ${cargoField} = ?,
             meeting_notes = ?, status = 'shipping_arranged', updated_at = NOW()
         WHERE id = ?`,
        [meeting_type, shipping_address, cargo_company, notes, sessionId]
      );
    } else {
      // Yüz yüze buluşma
      await pool.query(
        `UPDATE trade_sessions
         SET meeting_type = ?, meeting_address = ?,
             meeting_notes = ?, status = 'meeting_arranged', updated_at = NOW()
         WHERE id = ?`,
        [meeting_type, shipping_address, notes, sessionId]
      );
    }

    return res.json({
      ok: true,
      message: meeting_type === 'cargo' ? 'Kargo bilgileri güncellendi' : 'Buluşma detayları güncellendi'
    });
  } catch (e) {
    console.error('PUT /trade/sessions/:id/shipping error =>', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Kargo gönderim bilgisi ekle
r.post('/sessions/:id/ship', authRequired, async (req, res) => {
  try {
    const uid = req.user.id;
    const sessionId = Number(req.params.id || 0);
    const { tracking_no, cargo_company } = req.body;

    if (!sessionId || !tracking_no) {
      return res.status(400).json({
        ok: false,
        error: 'Session ID ve takip numarası gerekli'
      });
    }

    // Session'ı al
    const [[session]] = await pool.query(
      `SELECT id, seller_id, buyer_id, status, meeting_type,
              seller_tracking_no, buyer_tracking_no
       FROM trade_sessions
       WHERE id = ? AND (seller_id = ? OR buyer_id = ?)
       LIMIT 1`,
      [sessionId, uid, uid]
    );

    if (!session) {
      return res.status(404).json({ ok: false, error: 'session_not_found' });
    }

    if (session.meeting_type !== 'cargo') {
      return res.status(400).json({ ok: false, error: 'Bu session kargo için değil' });
    }

    if (!['shipping_arranged', 'seller_shipped', 'buyer_shipped'].includes(session.status)) {
      return res.status(409).json({ ok: false, error: 'Yanlış durum için kargo gönderimi' });
    }

    const isSeller = session.seller_id === uid;
    const trackingField = isSeller ? 'seller_tracking_no' : 'buyer_tracking_no';
    const shippedAtField = isSeller ? 'seller_shipped_at' : 'buyer_shipped_at';
    const cargoField = isSeller ? 'seller_cargo_company' : 'buyer_cargo_company';

    // Zaten gönderilmiş mi kontrol et
    const alreadyShipped = isSeller ? session.seller_tracking_no : session.buyer_tracking_no;
    if (alreadyShipped) {
      return res.status(409).json({ ok: false, error: 'Zaten kargo gönderildi' });
    }

    // Durumu hesapla
    const otherShipped = isSeller ? session.buyer_tracking_no : session.seller_tracking_no;
    let newStatus;
    if (otherShipped) {
      newStatus = 'both_shipped';
    } else {
      newStatus = isSeller ? 'seller_shipped' : 'buyer_shipped';
    }

    // Kargo bilgilerini güncelle
    await pool.query(
      `UPDATE trade_sessions
       SET ${trackingField} = ?, ${shippedAtField} = NOW(), ${cargoField} = ?,
           status = ?, updated_at = NOW()
       WHERE id = ?`,
      [tracking_no, cargo_company, newStatus, sessionId]
    );

    return res.json({
      ok: true,
      message: 'Kargo gönderim bilgisi kaydedildi',
      status: newStatus
    });

  } catch (e) {
    console.error('POST /trade/sessions/:id/ship error =>', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

module.exports = r;
