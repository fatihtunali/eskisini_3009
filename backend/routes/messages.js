// backend/routes/messages.js
const { Router } = require('express');
const { pool } = require('../db.js');
const { authRequired } = require('../mw/auth.js');
const notificationService = require('../services/notifications.js');

const r = Router();

/* ---------- Sabitler ---------- */
const PREVIEW_LEN = 140;

/* ---------- Thread (Conversation) listem ---------- */
/**
 * GET /api/messages/threads
 * Opsiyonel: ?limit=200
 * Not: N+1'i önlemek için son mesaj ve karşı tarafın ismini tek sorguda çekiyoruz.
 */
r.get('/threads', authRequired, async (req, res, next) => {
  try {
    const uid = req.user.id;
    const limitNum = parseInt(req.query.limit ?? '200', 10);
    const limit = Math.min(200, Math.max(1, Number.isFinite(limitNum) ? limitNum : 200));

    const [rows] = await pool.query(
      `
      SELECT
        c.id,
        c.listing_id,
        c.buyer_id,
        c.seller_id,
        c.last_msg_at,
        l.title AS listing_title,
        -- son mesaj gövdesi ve zamanı
        (
          SELECT m.body
          FROM messages m
          WHERE m.conversation_id = c.id
          ORDER BY m.id DESC
          LIMIT 1
        ) AS last_body,
        (
          SELECT m.created_at
          FROM messages m
          WHERE m.conversation_id = c.id
          ORDER BY m.id DESC
          LIMIT 1
        ) AS last_created_at,
        -- karşı tarafın adı
        CASE
          WHEN ? = c.buyer_id THEN u_s.full_name
          ELSE u_b.full_name
        END AS other_user_name,
        -- kapak görseli
        (
          SELECT li.file_url
          FROM listing_images li
          WHERE li.listing_id = c.listing_id
          ORDER BY li.sort_order, li.id
          LIMIT 1
        ) AS cover_url
      FROM conversations c
      LEFT JOIN listings l ON l.id = c.listing_id
      JOIN users u_b ON u_b.id = c.buyer_id
      JOIN users u_s ON u_s.id = c.seller_id
      WHERE c.buyer_id = ? OR c.seller_id = ?
      ORDER BY c.last_msg_at DESC
      LIMIT ?
      `,
      [uid, uid, uid, limit]
    );

    const threads = rows.map(c => ({
      id: c.id,
      listing_id: c.listing_id,
      listing_title: c.listing_title,
      updated_at: c.last_msg_at,
      last_message_preview: (c.last_body || '').slice(0, PREVIEW_LEN),
      other_user_name: c.other_user_name || 'Kullanıcı',
      cover_url: c.cover_url || null,
      last_message_at: c.last_created_at || c.last_msg_at
    }));

    res.json({ ok: true, threads });
  } catch (e) {
    next(e);
  }
});

/* ---------- Bir thread’in mesajları ---------- */
/**
 * GET /api/messages/thread/:id
 */
r.get('/thread/:id', authRequired, async (req, res, next) => {
  try {
    const uid = req.user.id;
    const convoId = Number(req.params.id || 0);
    if (!Number.isFinite(convoId) || convoId <= 0) {
      return res.status(400).json({ ok:false, error:'bad_id' });
    }

    const [[c]] = await pool.query(
      `SELECT buyer_id, seller_id FROM conversations WHERE id=? LIMIT 1`,
      [convoId]
    );
    if (!c || (c.buyer_id !== uid && c.seller_id !== uid)) {
      return res.status(404).json({ ok:false, error:'not_found' });
    }

    const [msgs] = await pool.query(
      `SELECT id, sender_id, body, created_at
         FROM messages
        WHERE conversation_id=?
        ORDER BY id ASC`,
      [convoId]
    );
    res.json({ ok:true, messages: msgs });
  } catch (e) {
    next(e);
  }
});

/* ---------- Mesaj gönder ---------- */
/**
 * POST /api/messages/thread/:id
 * body: { body: string }
 */
r.post('/thread/:id', authRequired, async (req, res, next) => {
  try {
    const uid = req.user.id;
    const convoId = Number(req.params.id || 0);
    const body = String(req.body?.body || '').trim();
    if (!Number.isFinite(convoId) || convoId <= 0) {
      return res.status(400).json({ ok:false, error:'bad_id' });
    }
    if (!body) {
      return res.status(400).json({ ok:false, error:'empty_body' });
    }

    const [[c]] = await pool.query(
      `SELECT buyer_id, seller_id FROM conversations WHERE id=? LIMIT 1`,
      [convoId]
    );
    if (!c || (c.buyer_id !== uid && c.seller_id !== uid)) {
      return res.status(404).json({ ok:false, error:'not_found' });
    }

    await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, body, created_at)
       VALUES (?,?,?, NOW())`,
      [convoId, uid, body]
    );

    await pool.query(
      `UPDATE conversations
          SET last_msg_at = NOW()
        WHERE id = ?`,
      [convoId]
    );

    // Determine recipient (the other person in the conversation)
    const recipientId = c.buyer_id === uid ? c.seller_id : c.buyer_id;

    // Get sender info and conversation details for notification
    const [[senderInfo]] = await pool.query(
      `SELECT full_name, username FROM users WHERE id = ?`,
      [uid]
    );

    const [[convoDetails]] = await pool.query(
      `SELECT c.listing_id, l.title as listing_title
       FROM conversations c
       JOIN listings l ON c.listing_id = l.id
       WHERE c.id = ?`,
      [convoId]
    );

    // Send notification to recipient (async, don't block response)
    setImmediate(async () => {
      try {
        const preview = body.length > 50 ? body.substring(0, 50) + '...' : body;
        await notificationService.sendNewMessageNotification(recipientId, {
          threadId: convoId,
          senderId: uid,
          senderName: senderInfo?.full_name || senderInfo?.username || 'Bir kullanıcı',
          preview: preview,
          listingTitle: convoDetails?.listing_title
        });
      } catch (notifError) {
        console.error('Failed to send new message notification:', notifError);
      }
    });

    res.json({ ok:true });
  } catch (e) {
    next(e);
  }
});

/* ---------- Konuşma başlat (varsa getir) ---------- */
/**
 * POST /api/messages/start
 * body: { listing_id, to_user_id? }
 *
 * KURAL:
 *  - Roller listing’e göre belirlenir.
 *  - Aynı (listing_id, buyer_id, seller_id) için tek konuşma tutulur (uq_conv).
 *  - Varsa ID döner, yoksa oluşturulur.
 *  - “Aktif” ilan üzerinden mesajlaşma kuralı uygulanır.
 *  - Kendi kendine mesaj (buyer_id === seller_id) engellenir.
 */
r.post('/start', authRequired, async (req, res) => {
  const uid = req.user.id;
  const listing_id = Number(req.body?.listing_id || 0);
  const to_user_id = req.body?.to_user_id ? Number(req.body.to_user_id) : null;

  // Either listing_id or to_user_id must be provided
  if ((!Number.isFinite(listing_id) || listing_id <= 0) && (!Number.isFinite(to_user_id) || to_user_id <= 0)) {
    return res.status(400).json({ ok:false, error:'missing_listing_id_or_to_user_id' });
  }

  // Can't message yourself
  if (to_user_id === uid) {
    return res.status(400).json({ ok:false, error:'cannot_message_yourself' });
  }

  try {
    let buyer_id, seller_id, finalListingId = null;

    if (listing_id > 0) {
      // Case 1: Starting conversation with a listing context
      const [[l]] = await pool.query(
        `SELECT id, seller_id, status
           FROM listings
          WHERE id=? AND status='active'
          LIMIT 1`,
        [listing_id]
      );
      if (!l) return res.status(404).json({ ok:false, error:'listing_not_found_or_inactive' });

      finalListingId = listing_id;

      // Determine roles based on listing
      if (uid === l.seller_id) {
        // Seller wants to message someone about their listing
        if (!Number.isFinite(to_user_id) || to_user_id <= 0) {
          return res.status(400).json({ ok:false, error:'missing_to_user_id' });
        }
        buyer_id = to_user_id;
        seller_id = uid;
      } else {
        // Buyer wants to message seller about their listing
        buyer_id = uid;
        seller_id = l.seller_id;
      }
    } else if (to_user_id > 0) {
      // Case 2: Direct message without listing context
      // In this case, we'll create a general conversation
      // We need to determine who is buyer/seller or use a different approach
      buyer_id = uid;
      seller_id = to_user_id;
      finalListingId = null; // No listing context
    } else {
      return res.status(400).json({ ok:false, error:'invalid_parameters' });
    }

    // Prevent self messaging
    if (buyer_id === seller_id) {
      return res.status(409).json({ ok:false, error:'cannot_message_self' });
    }

    // Check if conversation already exists
    let existingQuery, queryParams;
    if (finalListingId) {
      existingQuery = `SELECT id FROM conversations
        WHERE listing_id=? AND buyer_id=? AND seller_id=?
        LIMIT 1`;
      queryParams = [finalListingId, buyer_id, seller_id];
    } else {
      existingQuery = `SELECT id FROM conversations
        WHERE listing_id IS NULL AND
        ((buyer_id=? AND seller_id=?) OR (buyer_id=? AND seller_id=?))
        LIMIT 1`;
      queryParams = [buyer_id, seller_id, seller_id, buyer_id];
    }

    const [[existing]] = await pool.query(existingQuery, queryParams);
    if (existing) {
      return res.json({ ok:true, conversation_id: existing.id, existed: true });
    }

    // Create new conversation
    try {
      const [ins] = await pool.query(
        `INSERT INTO conversations (listing_id, buyer_id, seller_id, last_msg_at, created_at)
         VALUES (?, ?, ?, NOW(), NOW())`,
        [finalListingId, buyer_id, seller_id]
      );
      return res.json({ ok:true, conversation_id: ins.insertId, existed: false });
    } catch (e) {
      if (e?.code === 'ER_DUP_ENTRY') {
        // Race condition, try to find the existing conversation again
        const [[again]] = await pool.query(existingQuery, queryParams);
        if (again) {
          return res.json({ ok:true, conversation_id: again.id, existed: true });
        }
      }
      throw e;
    }
  } catch (err) {
    console.error('[messages:start]', err);
    return res.status(500).json({ ok:false, error:'server_error' });
  }
});

module.exports = r;
