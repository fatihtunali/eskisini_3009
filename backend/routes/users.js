// backend/routes/users.js
const { Router } = require('express');
const { pool } = require('../db.js');
const { authRequired } = require('../mw/auth.js');

const r = Router();

// Basit E.164 normalize (TR pratikleri dahil)
function normalizeE164(raw) {
  if (raw == null) return undefined; // alan gelmemişse undefined dön
  let s = String(raw).trim();
  if (s === '') return null;         // boş string => NULL olarak temizle
  // sadece rakam ve + kalsın
  s = s.replace(/[^\d+]/g, '');
  // 0xxxxxxxxxx -> +90xxxxxxxxxx
  if (/^0\d{10}$/.test(s)) s = '+9' + s;     // +90… olacak
  // 90xxxxxxxxxx -> +90xxxxxxxxxx
  if (/^90\d{10}$/.test(s)) s = '+' + s;
  // +90 5xx … (zaten + ile başlıyorsa olduğu gibi bırak)
  if (!/^\+\d{8,15}$/.test(s)) return null;  // geçersiz => null (400 döndüreceğiz)
  return s;
}

/**
 * Profil getir (opsiyonel; /api/auth/me de var)
 * GET /api/users/profile
 */
r.get('/profile', authRequired, async (req, res) => {
  const [[u]] = await pool.query(
    `SELECT id, email, full_name, phone_e164, kyc_status, is_kyc_verified
       FROM users WHERE id=? LIMIT 1`, [req.user.id]
  );
  if (!u) return res.status(404).json({ ok:false, error:'not_found' });
  res.json({ ok:true, user:u });
});

/**
 * Profil güncelle
 * POST /api/users/profile
 * body: { full_name?, phone_e164? }
 *
 * Not:
 *  - Alan gönderilmemişse hiç dokunmayız.
 *  - full_name = "" gönderilirse NULL’a çekilir.
 *  - phone_e164 = "" gönderilirse NULL’a çekilir (telefon temizleme).
 */
r.post('/profile', authRequired, async (req, res) => {
  try {
    const body = req.body || {};
    let { full_name } = body;
    let phone_e164 = body.hasOwnProperty('phone_e164') ? body.phone_e164 : undefined;

    // full_name doğrulama (yalnızca gönderildiyse)
    if (full_name !== undefined) {
      full_name = String(full_name).trim();
      if (full_name === '') full_name = null; // boşsa temizle
      if (full_name && full_name.length > 120) {
        return res.status(400).json({ ok:false, error:'full_name_too_long' });
      }
    }

    // Telefon normalize + benzersizlik (yalnızca gönderildiyse)
    if (phone_e164 !== undefined) {
      const norm = normalizeE164(phone_e164); // undefined|null|'+90…'
      if (norm === null) {
        return res.status(400).json({ ok:false, error:'telefon_gecersiz' });
      }
      if (norm !== undefined) {
        // başka kullanıcıda var mı?
        const [dupe] = await pool.query(
          `SELECT id FROM users WHERE phone_e164=? AND id<>? LIMIT 1`,
          [norm, req.user.id]
        );
        if (dupe.length) {
          return res.status(409).json({ ok:false, error:'telefon_kayitli' });
        }
      }
      phone_e164 = norm; // null (sil) / '+90…' (güncelle) / undefined (dokunma)
    }

    // Dinamik SET kur — yalnız gönderilen alanlar
    const sets = [];
    const params = [];

    if (full_name !== undefined) {
      sets.push('full_name = ?');
      params.push(full_name); // null olabilir
    }
    if (phone_e164 !== undefined) {
      sets.push('phone_e164 = ?');
      params.push(phone_e164); // null olabilir
    }

    if (sets.length === 0) {
      return res.status(400).json({ ok:false, error:'nothing_to_update' });
    }

    sets.push('updated_at = NOW()');

    await pool.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = ?`,
      [...params, req.user.id]
    );

    // Güncellenmiş veriyi döndür
    const [[u]] = await pool.query(
      `SELECT id, email, full_name, phone_e164, kyc_status, is_kyc_verified
         FROM users WHERE id=? LIMIT 1`, [req.user.id]
    );

    return res.json({ ok:true, user:u });
  } catch (e) {
    console.error('POST /users/profile error =>', e);
    return res.status(500).json({ ok:false, error:'server_error' });
  }
});

/**
 * Get user addresses
 * GET /api/users/addresses
 */
r.get('/addresses', authRequired, async (req, res) => {
  try {
    const [addresses] = await pool.query(
      `SELECT id, title, full_name as recipient_name, address_line as full_address, city, postal_code, phone, created_at
       FROM user_addresses
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json({ ok: true, data: addresses });
  } catch (error) {
    console.error('Get addresses error:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

/**
 * Add new address
 * POST /api/users/addresses
 * body: { title, recipient_name, full_address, city, postal_code, phone }
 */
r.post('/addresses', authRequired, async (req, res) => {
  try {
    const { title, recipient_name, full_address, city, postal_code, phone } = req.body || {};

    if (!recipient_name || !full_address || !city) {
      return res.status(400).json({ ok: false, error: 'missing_required_fields' });
    }

    const [result] = await pool.query(
      `INSERT INTO user_addresses
       (user_id, title, full_name, address_line, city, postal_code, phone, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [req.user.id, title || 'Adres', recipient_name, full_address, city, postal_code, phone]
    );

    res.json({ ok: true, address_id: result.insertId });
  } catch (error) {
    console.error('Add address error:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

/**
 * Update address
 * PUT /api/users/addresses/:id
 */
r.put('/addresses/:id', authRequired, async (req, res) => {
  try {
    const addressId = parseInt(req.params.id);
    const { title, recipient_name, full_address, city, postal_code, phone } = req.body || {};

    if (!recipient_name || !full_address || !city) {
      return res.status(400).json({ ok: false, error: 'missing_required_fields' });
    }

    const [result] = await pool.query(
      `UPDATE user_addresses
       SET title = ?, full_name = ?, address_line = ?, city = ?,
           postal_code = ?, phone = ?, updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [title || 'Adres', recipient_name, full_address, city, postal_code, phone, addressId, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, error: 'address_not_found' });
    }

    res.json({ ok: true, message: 'Address updated' });
  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

/**
 * Delete address
 * DELETE /api/users/addresses/:id
 */
r.delete('/addresses/:id', authRequired, async (req, res) => {
  try {
    const addressId = parseInt(req.params.id);

    const [result] = await pool.query(
      'DELETE FROM user_addresses WHERE id = ? AND user_id = ?',
      [addressId, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, error: 'address_not_found' });
    }

    res.json({ ok: true, message: 'Address deleted' });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

module.exports = r;
