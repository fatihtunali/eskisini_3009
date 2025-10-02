const rateLimit = require('express-rate-limit');

/** WHY: Throttle abuse while keeping dev-friendly defaults. */
const rlAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});

const rlAdminTight = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  rlAuth,
  rlAdminTight
};