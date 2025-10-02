const { z } = require('zod');

/** WHY: Tiny, explicit request validators prevent inconsistent ad-hoc checks. */
function validate(bodySchema, querySchema = null) {
  return (req, res, next) => {
    try {
      if (bodySchema) req.body = bodySchema.parse(req.body ?? {});
      if (querySchema) req.query = querySchema.parse(req.query ?? {});
      next();
    } catch (e) {
      return res.status(400).json({ ok:false, error:'validation_error', details: e.errors ?? String(e) });
    }
  };
}

module.exports = { validate };