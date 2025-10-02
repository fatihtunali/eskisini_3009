// backend/routes/search.js
const { Router } = require('express');
const { pool } = require('../db.js');

const router = Router();

/* -------------------------------------------------
 * SEARCH SUGGESTIONS — GET /api/search/suggestions
 * ------------------------------------------------- */
router.get('/suggestions', async (req, res) => {
  try {
    const query = req.query.q?.toString().trim() || '';

    if (!query || query.length < 2) {
      return res.json({
        ok: true,
        suggestions: []
      });
    }

    const searchTerm = `%${query}%`;
    const limit = Math.min(10, parseInt(req.query.limit) || 8);

    // Get suggestions from listings titles and categories
    // Use simpler query to avoid potential column issues
    const [suggestions] = await pool.query(`
      SELECT DISTINCT title as suggestion, 'listing' as type
      FROM listings
      WHERE title LIKE ?
      AND status = 'active'
      ORDER BY created_at DESC
      LIMIT ?
    `, [searchTerm, limit]);

    res.json({
      ok: true,
      suggestions: suggestions.map(s => ({
        text: s.suggestion,
        type: s.type
      }))
    });

  } catch (error) {
    console.error('Search suggestions error:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error'
    });
  }
});

module.exports = router;