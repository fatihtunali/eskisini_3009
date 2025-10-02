// backend/routes/orders.js
const { Router } = require('express');
const { pool } = require('../db.js');
const { authRequired } = require('../mw/auth.js');
const notificationService = require('../services/notifications.js');

const router = Router();

/* ------------ cache helpers ------------ */
function noStore(res) {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
}

/* ------------ CREATE ORDER ------------ */
/**
 * POST /api/orders
 * body: { listing_id, qty? }
 * - Sadece status='active' ilanlardan oluşturur.
 * - Aynı alıcı + ilan için 'pending' sipariş varsa tekrar kullanır (dupe engeli).
 * - Self purchase ENV ile kontrol edilir: ALLOW_SELF_PURCHASE=true ise izin.
 */
router.post('/', authRequired, async (req, res) => {
  noStore(res);

  const { listing_id, qty = 1 } = req.body || {};
  const q = Math.max(1, Number(qty) || 1);
  if (!Number.isFinite(Number(listing_id)) || Number(listing_id) <= 0) {
    return res.status(400).json({ ok: false, error: 'MISSING_LISTING_ID' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Yalnızca aktif ilan
    const [L] = await conn.query(
      `SELECT id, seller_id, title, price_minor, currency
         FROM listings
        WHERE id = ? AND status = 'active'
        LIMIT 1`,
      [listing_id]
    );
    if (!L.length) {
      await conn.rollback();
      return res.status(404).json({ ok: false, error: 'LISTING_NOT_FOUND_OR_INACTIVE' });
    }

    const listing   = L[0];
    const buyerId   = req.user.id;
    const sellerId  = listing.seller_id;
    const unitMinor = Number(listing.price_minor) || 0;
    const currency  = listing.currency || 'TRY';

    if (unitMinor <= 0) {
      await conn.rollback();
      return res.status(400).json({ ok: false, error: 'INVALID_PRICE' });
    }

    // Self purchase kuralı
    const allowSelf = String(process.env.ALLOW_SELF_PURCHASE || '').toLowerCase() === 'true';
    if (buyerId === sellerId && !allowSelf) {
      await conn.rollback();
      return res.status(400).json({ ok: false, error: 'SELF_BUY_FORBIDDEN' });
    }

    // Aynı alıcı + ilan için pending sipariş var mı?
    const [D] = await conn.query(
      `SELECT id FROM orders
        WHERE buyer_id = ? AND listing_id = ? AND status = 'pending'
        LIMIT 1`,
      [buyerId, listing_id]
    );
    if (D.length) {
      await conn.commit();
      return res.json({ ok: true, order_id: D[0].id, status: 'pending', duplicate: true });
    }

    const subtotal_minor = unitMinor * q;
    const shipping_minor = 0;
    const total_minor    = subtotal_minor + shipping_minor;

    const [ins] = await conn.query(
      `INSERT INTO orders
         (buyer_id, seller_id, listing_id, qty,
          unit_price_minor, currency, subtotal_minor, shipping_minor, total_minor, status, created_at, updated_at)
       VALUES (?,?,?,?, ?,?,?,?,?,'pending', NOW(), NOW())`,
      [buyerId, sellerId, listing_id, q,
       unitMinor, currency, subtotal_minor, shipping_minor, total_minor]
    );

    // Get buyer info for notification
    const [[buyer]] = await conn.query(
      `SELECT full_name, username FROM users WHERE id = ?`,
      [buyerId]
    );

    await conn.commit();

    // Send notification to seller about new order (async, don't block response)
    setImmediate(async () => {
      try {
        await notificationService.createNotification({
          userId: sellerId,
          type: 'order_update',
          title: 'Yeni Sipariş',
          body: `${buyer?.full_name || buyer?.username || 'Bir kullanıcı'} "${listing.title}" için sipariş verdi`,
          data: {
            orderId: ins.insertId,
            status: 'pending',
            buyerName: buyer?.full_name || buyer?.username,
            listingTitle: listing.title,
            amount: (total_minor / 100).toFixed(2),
            currency: currency,
            action_url: `/profile.html?tab=sales&orderId=${ins.insertId}`
          }
        });
      } catch (notifError) {
        console.error('Failed to send new order notification:', notifError);
      }
    });

    return res.json({ ok: true, order_id: ins.insertId, status: 'pending' });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    console.error('[orders:create]', e);
    return res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
  } finally {
    conn.release();
  }
});

/* ------------ CREATE ORDER FROM CART ------------ */
/**
 * POST /api/orders/create
 * body: { cart_id, shipping_method, shipping_cost_minor, total_minor, address, payment }
 */
router.post('/create', authRequired, async (req, res) => {
  noStore(res);

  const { cart_id, shipping_method, shipping_cost_minor, total_minor, address, payment } = req.body || {};
  const userId = req.user.id;

  if (!cart_id || !shipping_method || !address || !payment) {
    return res.status(400).json({ ok: false, error: 'MISSING_REQUIRED_FIELDS' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Get cart items
    const [cartItems] = await conn.query(`
      SELECT
        ci.*,
        l.title, l.seller_id, l.status as listing_status,
        l.price_minor as current_price_minor, l.currency as current_currency
      FROM cart_items ci
      JOIN listings l ON l.id = ci.listing_id
      JOIN carts c ON c.id = ci.cart_id
      WHERE c.id = ? AND c.user_id = ?
    `, [cart_id, userId]);

    if (!cartItems.length) {
      await conn.rollback();
      return res.status(400).json({ ok: false, error: 'EMPTY_CART' });
    }

    // Filter only active listings
    const activeItems = cartItems.filter(item => item.listing_status === 'active');
    if (!activeItems.length) {
      await conn.rollback();
      return res.status(400).json({ ok: false, error: 'NO_ACTIVE_ITEMS' });
    }

    // Prevent self-purchase
    const allowSelf = String(process.env.ALLOW_SELF_PURCHASE || '').toLowerCase() === 'true';
    if (!allowSelf) {
      const selfItems = activeItems.filter(item => item.seller_id === userId);
      if (selfItems.length > 0) {
        await conn.rollback();
        return res.status(400).json({ ok: false, error: 'SELF_BUY_FORBIDDEN' });
      }
    }

    // Handle address
    let addressId = null;
    if (address.address_id) {
      // Use existing address
      addressId = address.address_id;

      // Verify address belongs to user
      const [userAddresses] = await conn.query(
        'SELECT id FROM user_addresses WHERE id = ? AND user_id = ?',
        [addressId, userId]
      );

      if (!userAddresses.length) {
        await conn.rollback();
        return res.status(400).json({ ok: false, error: 'INVALID_ADDRESS' });
      }
    } else {
      // Create new address
      const [addressResult] = await conn.query(
        `INSERT INTO user_addresses
         (user_id, title, full_name, address_line, city, postal_code, phone, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          userId,
          address.title || 'Adres',
          address.recipient_name,  // frontend sends recipient_name -> maps to full_name in DB
          address.full_address,    // frontend sends full_address -> maps to address_line in DB
          address.city,
          address.postal_code,
          address.phone
        ]
      );
      addressId = addressResult.insertId;
    }

    // Group items by seller
    const sellerGroups = {};
    activeItems.forEach(item => {
      if (!sellerGroups[item.seller_id]) {
        sellerGroups[item.seller_id] = [];
      }
      sellerGroups[item.seller_id].push(item);
    });

    const orderIds = [];

    // Create separate orders for each seller
    for (const [sellerId, items] of Object.entries(sellerGroups)) {
      const orderSubtotal = items.reduce((sum, item) =>
        sum + (item.unit_price_minor * item.quantity), 0
      );

      // Split shipping cost proportionally
      const totalCartSubtotal = activeItems.reduce((sum, item) =>
        sum + (item.unit_price_minor * item.quantity), 0
      );
      const sellerShippingCost = Math.round(
        (shipping_cost_minor * orderSubtotal) / totalCartSubtotal
      );

      const orderTotal = orderSubtotal + sellerShippingCost;

      // Create order
      const [orderResult] = await conn.query(
        `INSERT INTO orders
         (buyer_id, seller_id, subtotal_minor, shipping_minor, total_minor, currency,
          shipping_method, shipping_address_id, payment_method, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'TRY', ?, ?, ?, 'pending', NOW(), NOW())`,
        [
          userId,
          sellerId,
          orderSubtotal,
          sellerShippingCost,
          orderTotal,
          shipping_method,
          addressId,
          payment.method
        ]
      );

      const orderId = orderResult.insertId;
      orderIds.push(orderId);

      // Create order items
      for (const item of items) {
        await conn.query(
          `INSERT INTO order_items
           (order_id, listing_id, quantity, unit_price_minor, total_minor, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [
            orderId,
            item.listing_id,
            item.quantity,
            item.unit_price_minor,
            item.unit_price_minor * item.quantity
          ]
        );
      }

      // Create payment transaction record
      if (payment.method === 'credit_card' && payment.card) {
        // In real app, integrate with payment processor here
        await conn.query(
          `INSERT INTO payment_transactions
           (order_id, method, amount_minor, currency, status, created_at)
           VALUES (?, 'credit_card', ?, 'TRY', 'pending', NOW())`,
          [orderId, orderTotal]
        );
      }
    }

    // Clear cart after successful order creation
    await conn.query(
      'DELETE FROM cart_items WHERE cart_id = ?',
      [cart_id]
    );

    await conn.commit();

    // Return the first order ID (main order)
    res.json({
      ok: true,
      order_id: orderIds[0],
      order_ids: orderIds,
      message: `${orderIds.length} sipariş oluşturuldu`
    });

  } catch (error) {
    await conn.rollback();
    console.error('Create order from cart error:', error);
    res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
  } finally {
    conn.release();
  }
});

/* ------------ CANCEL ORDER (buyer, only pending) ------------ */
/**
 * POST /api/orders/:id/cancel
 */
router.post('/:id/cancel', authRequired, async (req, res) => {
  noStore(res);
  const orderId = Number(req.params.id || 0);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    return res.status(400).json({ ok: false, error: 'INVALID_ID' });
  }

  try {
    const [[o]] = await pool.query(
      `SELECT id, buyer_id, status
         FROM orders
        WHERE id = ?
        LIMIT 1`,
      [orderId]
    );
    if (!o) return res.status(404).json({ ok:false, error:'ORDER_NOT_FOUND' });
    if (o.buyer_id !== req.user.id) {
      return res.status(403).json({ ok:false, error:'FORBIDDEN' });
    }
    if (o.status !== 'pending') {
      return res.status(409).json({ ok:false, error:'NOT_CANCELABLE' });
    }

    await pool.query(
      `UPDATE orders
          SET status = 'cancelled', updated_at = NOW()
        WHERE id = ? AND status = 'pending'`,
      [orderId]
    );

    return res.json({ ok:true, order_id: orderId, status:'cancelled' });
  } catch (e) {
    console.error('[orders:cancel]', e);
    return res.status(500).json({ ok:false, error:'SERVER_ERROR' });
  }
});

/* ------------ MY PURCHASES (buyer side) ------------ */
/**
 * GET /api/orders/mine?include_cancelled=1
 */
router.get('/mine', authRequired, async (req, res) => {
  noStore(res);
  const includeCancelled = String(req.query.include_cancelled||'').trim() === '1';
  const statusClause = includeCancelled ? '' : `AND o.status <> 'cancelled'`;

  try {
    // Get orders with their items for cart-based orders
    const [rows] = await pool.query(
      `
      SELECT
        o.id, o.listing_id, o.qty,
        o.unit_price_minor, o.currency,
        o.subtotal_minor, o.shipping_minor, o.total_minor,
        o.status, o.created_at, o.shipping_method, o.tracking_number, o.payment_method,
        -- For single-item orders (legacy)
        l.title, l.slug,
        (
          SELECT li.file_url
          FROM listing_images li
          WHERE li.listing_id = o.listing_id
          ORDER BY li.sort_order, li.id
          LIMIT 1
        ) AS thumb_url,
        -- For cart-based orders, get item count and first item info
        (
          SELECT COUNT(*)
          FROM order_items oi
          WHERE oi.order_id = o.id
        ) AS item_count,
        (
          SELECT l2.title
          FROM order_items oi2
          JOIN listings l2 ON l2.id = oi2.listing_id
          WHERE oi2.order_id = o.id
          ORDER BY oi2.id LIMIT 1
        ) AS first_item_title,
        (
          SELECT (
            SELECT li2.file_url
            FROM listing_images li2
            WHERE li2.listing_id = oi3.listing_id
            ORDER BY li2.sort_order, li2.id LIMIT 1
          )
          FROM order_items oi3
          WHERE oi3.order_id = o.id
          ORDER BY oi3.id LIMIT 1
        ) AS first_item_image
      FROM orders o
      LEFT JOIN listings l ON l.id = o.listing_id
      WHERE o.buyer_id = ?
        ${statusClause}
      ORDER BY o.id DESC
      LIMIT 100
      `,
      [req.user.id]
    );

    return res.json({ ok: true, orders: rows });
  } catch (e) {
    console.error('[orders:mine]', e);
    return res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
  }
});

/* ------------ SELLER ORDERS (sales) ------------ */
/**
 * GET /api/orders/sales?include_cancelled=1
 * Returns orders where current user is the SELLER
 */
router.get('/sales', authRequired, async (req, res) => {
  noStore(res);

  const includeCancelled = String(req.query.include_cancelled||'').trim() === '1';
  const statusClause = includeCancelled ? '' : `AND o.status <> 'cancelled'`;

  try {
    const [rows] = await pool.query(
      `
      SELECT
        o.id, o.buyer_id, o.listing_id, o.qty,
        o.unit_price_minor, o.currency,
        o.subtotal_minor, o.shipping_minor, o.total_minor,
        o.status, o.created_at, o.payment_method, o.tracking_number,
        o.shipping_address_id, o.notes,

        -- Listing info
        l.title, l.slug,
        (
          SELECT li.file_url
          FROM listing_images li
          WHERE li.listing_id = l.id
          ORDER BY li.sort_order, li.id
          LIMIT 1
        ) AS thumb_url,

        -- Buyer info
        u.full_name as buyer_name,
        u.email as buyer_email,
        u.avatar_url as buyer_avatar

      FROM orders o
      LEFT JOIN listings l ON l.id = o.listing_id
      LEFT JOIN users u ON u.id = o.buyer_id
      WHERE o.seller_id = ? ${statusClause}
      ORDER BY o.created_at DESC
      `,
      [req.user.id]
    );

    // Also get order items for cart-based orders
    for (const order of rows) {
      if (!order.listing_id) {
        const [items] = await pool.query(
          `SELECT
            oi.id, oi.listing_id, oi.quantity as qty, oi.unit_price_minor, oi.total_minor,
            l.title, l.slug,
            (
              SELECT li.file_url
              FROM listing_images li
              WHERE li.listing_id = oi.listing_id
              ORDER BY li.sort_order, li.id
              LIMIT 1
            ) AS thumb_url
          FROM order_items oi
          LEFT JOIN listings l ON l.id = oi.listing_id
          WHERE oi.order_id = ?
          ORDER BY oi.id`,
          [order.id]
        );
        order.items = items;
      }
    }

    res.json({ ok: true, orders: rows });
  } catch (err) {
    console.error('Error fetching seller orders:', err);
    console.error('SQL Query failed for seller_id:', req.user?.id);
    console.error('Full error:', err.message, err.stack);
    res.status(500).json({ ok: false, error: 'server_error', debug: err.message });
  }
});

/* ------------ GET SINGLE ORDER ------------ */
/**
 * GET /api/orders/:id - Get order details
 */
router.get('/:id', authRequired, async (req, res) => {
  noStore(res);
  const orderId = Number(req.params.id || 0);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    return res.status(400).json({ ok: false, error: 'INVALID_ID' });
  }

  try {
    const [[order]] = await pool.query(
      `SELECT
        o.id, o.buyer_id, o.seller_id, o.listing_id, o.qty,
        o.unit_price_minor, o.currency,
        o.subtotal_minor, o.shipping_minor, o.total_minor,
        o.shipping_method, o.tracking_number, o.payment_method, o.status, o.created_at, o.updated_at,
        l.title, l.slug,
        (
          SELECT li.file_url
          FROM listing_images li
          WHERE li.listing_id = o.listing_id
          ORDER BY li.sort_order, li.id
          LIMIT 1
        ) AS thumb_url,
        ua.full_name as recipient_name, ua.address_line as full_address, ua.city, ua.postal_code, ua.phone
      FROM orders o
      LEFT JOIN listings l ON l.id = o.listing_id
      LEFT JOIN user_addresses ua ON ua.id = o.shipping_address_id
      WHERE o.id = ?
      LIMIT 1`,
      [orderId]
    );

    if (!order) {
      return res.status(404).json({ ok: false, error: 'ORDER_NOT_FOUND' });
    }

    // Check if user is authorized to view this order
    if (order.buyer_id !== req.user.id && order.seller_id !== req.user.id) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' });
    }

    // Also get order items if this is a cart-based order (no listing_id)
    let items = [];
    if (!order.listing_id) {
      const [itemRows] = await pool.query(
        `SELECT
          oi.id, oi.listing_id, oi.quantity as qty, oi.unit_price_minor, oi.total_minor,
          l.title, l.slug,
          (
            SELECT li.file_url
            FROM listing_images li
            WHERE li.listing_id = oi.listing_id
            ORDER BY li.sort_order, li.id
            LIMIT 1
          ) AS thumb_url
        FROM order_items oi
        LEFT JOIN listings l ON l.id = oi.listing_id
        WHERE oi.order_id = ?
        ORDER BY oi.id`,
        [orderId]
      );
      items = itemRows;
    }

    // Format shipping address for display
    let shipping_address = '';
    if (order.full_address) {
      shipping_address = `${order.recipient_name || ''}\n${order.full_address}`;
      if (order.city) shipping_address += `\n${order.city}`;
      if (order.postal_code) shipping_address += ` ${order.postal_code}`;
      if (order.phone) shipping_address += `\nTel: ${order.phone}`;
    }

    res.json({
      ok: true,
      order: {
        ...order,
        shipping_address: shipping_address.trim(),
        items: items.length > 0 ? items : undefined
      }
    });

  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
  }
});

/* ------------ GET ORDER ITEMS ------------ */
/**
 * GET /api/orders/:id/items - Get order items
 */
router.get('/:id/items', authRequired, async (req, res) => {
  noStore(res);
  const orderId = Number(req.params.id || 0);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    return res.status(400).json({ ok: false, error: 'INVALID_ID' });
  }

  try {
    // First verify the user has access to this order
    const [[order]] = await pool.query(
      'SELECT buyer_id, seller_id FROM orders WHERE id = ? LIMIT 1',
      [orderId]
    );

    if (!order) {
      return res.status(404).json({ ok: false, error: 'ORDER_NOT_FOUND' });
    }

    if (order.buyer_id !== req.user.id && order.seller_id !== req.user.id) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' });
    }

    // Get order items
    const [items] = await pool.query(
      `SELECT
        oi.id, oi.listing_id, oi.quantity, oi.unit_price_minor, oi.total_minor,
        l.title as listing_title, l.slug,
        (
          SELECT li.file_url
          FROM listing_images li
          WHERE li.listing_id = oi.listing_id
          ORDER BY li.sort_order, li.id
          LIMIT 1
        ) AS thumb_url
      FROM order_items oi
      LEFT JOIN listings l ON l.id = oi.listing_id
      WHERE oi.order_id = ?
      ORDER BY oi.id`,
      [orderId]
    );

    res.json({ ok: true, items });

  } catch (error) {
    console.error('Get order items error:', error);
    res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
  }
});

/* ------------ MY SALES (seller side) ------------ */
/**
 * GET /api/orders/sold?include_cancelled=1
 */
router.get('/sold', authRequired, async (req, res) => {
  noStore(res);
  const includeCancelled = String(req.query.include_cancelled||'').trim() === '1';
  const statusClause = includeCancelled ? '' : `AND o.status <> 'cancelled'`;

  try {
    const [rows] = await pool.query(
      `
      SELECT
        o.id, o.listing_id, o.qty,
        o.unit_price_minor, o.currency,
        o.subtotal_minor, o.shipping_minor, o.total_minor,
        o.status, o.created_at,
        l.title, l.slug,
        (
          SELECT li.file_url
          FROM listing_images li
          WHERE li.listing_id = o.listing_id
          ORDER BY li.sort_order, li.id
          LIMIT 1
        ) AS thumb_url
      FROM orders o
      JOIN listings l ON l.id = o.listing_id
      WHERE o.seller_id = ?
        ${statusClause}
      ORDER BY o.id DESC
      LIMIT 100
      `,
      [req.user.id]
    );

    return res.json({ ok: true, orders: rows });
  } catch (e) {
    console.error('[orders:sold]', e);
    return res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
  }
});

/* ------------ UPDATE ORDER STATUS (seller) ------------ */
/**
 * PUT /api/orders/:id/fulfill
 * Updates order status and tracking info (seller only)
 */
router.put('/:id/fulfill', authRequired, async (req, res) => {
  noStore(res);
  const orderId = parseInt(req.params.id);
  const { status, tracking_number, notes } = req.body || {};

  if (!orderId || !status) {
    return res.status(400).json({ ok: false, error: 'MISSING_REQUIRED_FIELDS' });
  }

  // Valid seller statuses
  const validStatuses = ['processing', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ ok: false, error: 'INVALID_STATUS' });
  }

  try {
    // Verify seller owns this order
    const [[order]] = await pool.query(
      'SELECT seller_id, status as current_status FROM orders WHERE id = ? LIMIT 1',
      [orderId]
    );

    if (!order) {
      return res.status(404).json({ ok: false, error: 'ORDER_NOT_FOUND' });
    }

    if (order.seller_id !== req.user.id) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' });
    }

    // Update order
    const updates = {
      status,
      updated_at: new Date()
    };

    if (tracking_number) updates.tracking_number = tracking_number;
    if (notes) updates.notes = notes;
    if (status === 'delivered') updates.completed_at = new Date();

    const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(orderId);

    await pool.query(`UPDATE orders SET ${setClause} WHERE id = ?`, values);

    // Get order details for notification
    const [[orderDetails]] = await pool.query(`
      SELECT o.buyer_id, o.total_minor, o.currency, l.title as listing_title
      FROM orders o
      JOIN listings l ON o.listing_id = l.id
      WHERE o.id = ?
    `, [orderId]);

    // Send notification to buyer about status update (async, don't block response)
    if (orderDetails && status !== order.current_status) {
      setImmediate(async () => {
        try {
          await notificationService.sendOrderUpdateNotification(orderDetails.buyer_id, {
            orderId: orderId,
            status: status,
            trackingNumber: tracking_number,
            listingTitle: orderDetails.listing_title,
            amount: (orderDetails.total_minor / 100).toFixed(2),
            currency: orderDetails.currency
          });
        } catch (notifError) {
          console.error('Failed to send order update notification:', notifError);
        }
      });
    }

    res.json({
      ok: true,
      message: `Order status updated to ${status}`,
      order_id: orderId,
      new_status: status
    });

  } catch (err) {
    console.error('Error updating order status:', err);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

module.exports = router;
