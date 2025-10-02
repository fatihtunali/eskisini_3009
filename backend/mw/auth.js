// backend/mw/auth.js
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { pool } = require('../db.js');

/** WHY: Central token handling avoids drift across routes. */
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('[auth] Missing JWT_SECRET; refuse to start for safety.');
  process.exit(1);
}

function signToken(payload, opts = {}) {
  // WHY: Short-lived tokens reduce blast radius; refresh via re-login or future refresh endpoint.
  const { expiresIn = '7d' } = opts;
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); }
  catch { return null; }
}

async function loadUser(id) {
  const [rows] = await pool.execute(
    `SELECT id, email, full_name, username, phone_e164, kyc_status, is_kyc_verified, status, is_admin
       FROM users WHERE id=? LIMIT 1`, [id]
  );
  const u = rows[0];
  if (!u) return null;
  if (u.status && u.status !== 'active') return null; // WHY: Disabled accounts must not auth.
  return u;
}

function getTokenFromReq(req) {
  // Prefer cookie, then Bearer
  const cTok = req.cookies?.token;
  if (cTok) return cTok;
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

function authOptional(req, _res, next) {
  const token = getTokenFromReq(req);
  if (!token) { req.user = null; return next(); }
  const payload = verifyToken(token);
  if (!payload?.id) { req.user = null; return next(); }
  loadUser(payload.id)
    .then(u => { req.user = u || null; next(); })
    .catch(() => { req.user = null; next(); });
}

function authRequired(req, res, next) {
  const token = getTokenFromReq(req);
  if (!token) return res.status(401).json({ ok:false, error:'unauthorized' });
  const payload = verifyToken(token);
  if (!payload?.id) return res.status(401).json({ ok:false, error:'unauthorized' });
  loadUser(payload.id)
    .then(u => {
      if (!u) return res.status(401).json({ ok:false, error:'unauthorized' });
      req.user = u;
      next();
    })
    .catch(() => res.status(500).json({ ok:false, error:'server_error' }));
}

// Alias for backward compatibility
const requireAuth = authRequired;

const cookieParserMiddleware = cookieParser();

module.exports = {
  signToken,
  authOptional,
  authRequired,
  requireAuth,
  cookieParserMiddleware
};