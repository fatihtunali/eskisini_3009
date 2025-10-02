// backend/routes/cart.js
const { Router } = require('express');
const { pool } = require('../db.js');
const { authRequired } = require('../mw/auth.js');

const router = Router();

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ ok: true, message: 'Cart routes are working' });
});

// Helper function for cart operations
async function getOrCreateCart(userId, sessionId = null) {
  let [carts] = await pool.query(
    'SELECT id FROM carts WHERE user_id = ? LIMIT 1',
    [userId]
  );

  if (carts.length === 0) {
    const [result] = await pool.query(
      'INSERT INTO carts (user_id, session_id) VALUES (?, ?)',
      [userId, sessionId]
    );
    return result.insertId;
  }

  return carts[0].id;
}

// GET /api/cart - Get user's cart
router.get('/', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const cartId = await getOrCreateCart(userId);

    const [cartItems] = await pool.query(`
      SELECT
        ci.*,
        l.title,
        l.slug,
        l.price_minor as current_price_minor,
        l.currency as current_currency,
        l.status as listing_status,
        l.seller_id,
        (SELECT file_url FROM listing_images WHERE listing_id = l.id ORDER BY sort_order, id LIMIT 1) as image_url
      FROM cart_items ci
      JOIN listings l ON l.id = ci.listing_id
      WHERE ci.cart_id = ?
      ORDER BY ci.created_at DESC
    `, [cartId]);

    // Calculate totals
    const subtotal = cartItems.reduce((sum, item) =>
      sum + (item.unit_price_minor * item.quantity), 0
    );

    res.json({
      ok: true,
      cart: {
        id: cartId,
        items: cartItems,
        subtotal_minor: subtotal,
        currency: 'TRY',
        item_count: cartItems.reduce((sum, item) => sum + item.quantity, 0)
      }
    });

  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// POST /api/cart/add - Add item to cart
router.post('/add', authRequired, async (req, res) => {
  console.log('🛒 Cart add route hit - user:', req.user?.id, 'body:', req.body);
  try {
    const userId = req.user.id;
    const { listing_id, quantity = 1 } = req.body;

    if (!listing_id) {
      return res.status(400).json({ ok: false, error: 'listing_id_required' });
    }

    // Check if listing exists and is active (handle both ID and slug)
    let listings;
    if (isNaN(listing_id)) {
      // If listing_id is not a number, treat it as a slug
      [listings] = await pool.query(
        'SELECT id, seller_id, price_minor, currency, status FROM listings WHERE slug = ? LIMIT 1',
        [listing_id]
      );
    } else {
      // If listing_id is a number, use it as ID
      [listings] = await pool.query(
        'SELECT id, seller_id, price_minor, currency, status FROM listings WHERE id = ? LIMIT 1',
        [listing_id]
      );
    }

    if (listings.length === 0) {
      console.log('🛒 No listing found for:', listing_id);
      return res.status(404).json({ ok: false, error: 'listing_not_found' });
    }

    const listing = listings[0];
    console.log('🛒 Found listing:', listing.id, listing.title, 'status:', listing.status);

    if (listing.status !== 'active') {
      console.log('🛒 Listing not active:', listing.status);
      return res.status(400).json({ ok: false, error: 'listing_not_active' });
    }

    // Prevent self-purchase
    if (listing.seller_id === userId) {
      console.log('🛒 Cannot buy own listing - seller_id:', listing.seller_id, 'user_id:', userId);
      return res.status(400).json({ ok: false, error: 'cannot_buy_own_listing' });
    }

    const cartId = await getOrCreateCart(userId);

    // Check if item already exists in cart
    const [existingItems] = await pool.query(
      'SELECT id, quantity FROM cart_items WHERE cart_id = ? AND listing_id = ?',
      [cartId, listing.id]
    );

    if (existingItems.length > 0) {
      // Update quantity
      const newQuantity = existingItems[0].quantity + parseInt(quantity);
      await pool.query(
        'UPDATE cart_items SET quantity = ?, updated_at = NOW() WHERE id = ?',
        [newQuantity, existingItems[0].id]
      );
    } else {
      // Add new item
      await pool.query(
        'INSERT INTO cart_items (cart_id, listing_id, quantity, unit_price_minor, currency) VALUES (?, ?, ?, ?, ?)',
        [cartId, listing.id, quantity, listing.price_minor, listing.currency]
      );
    }

    res.json({ ok: true, message: 'Ürün sepete eklendi' });

  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// PUT /api/cart/item/:id - Update cart item quantity
router.put('/item/:id', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const itemId = parseInt(req.params.id);
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ ok: false, error: 'invalid_quantity' });
    }

    // Verify ownership
    const [items] = await pool.query(`
      SELECT ci.id
      FROM cart_items ci
      JOIN carts c ON c.id = ci.cart_id
      WHERE ci.id = ? AND c.user_id = ?
    `, [itemId, userId]);

    if (items.length === 0) {
      return res.status(404).json({ ok: false, error: 'item_not_found' });
    }

    await pool.query(
      'UPDATE cart_items SET quantity = ?, updated_at = NOW() WHERE id = ?',
      [quantity, itemId]
    );

    res.json({ ok: true, message: 'Miktar güncellendi' });

  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// DELETE /api/cart/item/:id - Remove item from cart
router.delete('/item/:id', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const itemId = parseInt(req.params.id);

    // Verify ownership and delete
    const [result] = await pool.query(`
      DELETE ci FROM cart_items ci
      JOIN carts c ON c.id = ci.cart_id
      WHERE ci.id = ? AND c.user_id = ?
    `, [itemId, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, error: 'item_not_found' });
    }

    res.json({ ok: true, message: 'Ürün sepetten çıkarıldı' });

  } catch (error) {
    console.error('Remove cart item error:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// DELETE /api/cart/clear - Clear entire cart
router.delete('/clear', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.query(`
      DELETE ci FROM cart_items ci
      JOIN carts c ON c.id = ci.cart_id
      WHERE c.user_id = ?
    `, [userId]);

    res.json({ ok: true, message: 'Sepet temizlendi' });

  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

module.exports = router;