// server-production.js - Production API Server (api.eskisiniveryenisinial.com)
// For flat folder structure where all backend files are in root
console.log('[BOOT] API server starting…');

require('dotenv/config');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const http = require('http');

// Import routes (flat structure - no ./backend/ prefix)
const auth = require('./routes/auth.js');
const categories = require('./routes/categories.js');
const listings = require('./routes/listings.js');
const favorites = require('./routes/favorites.js');
const messages = require('./routes/messages.js');
const trade = require('./routes/trade.js');
const orders = require('./routes/orders.js');
const cart = require('./routes/cart.js');
const billing = require('./routes/billing.js');
const users = require('./routes/users.js');
const legal = require('./routes/legal/index.js');
const setup = require('./routes/setup.js');
const sellers = require('./routes/sellers.js');
const uploads = require('./routes/uploads.js');
const admin = require('./routes/admin.js');
const debug = require('./routes/debug.js');
const shopManagement = require('./routes/shop-management.js');
const notifications = require('./routes/notifications.js');
const search = require('./routes/search.js');
const testRunner = require('./routes/test.js');

const { pingDb } = require('./db.js');
const { handleWebSocket } = require('./websocket.js');
const { cspMiddleware } = require('./mw/csp.js');

(async () => {
  // Test database connection
  await pingDb();

  const app = express();

  // Disable ETag
  app.set('etag', false);

  // Security: CSP headers (must be early in middleware chain)
  app.use(cspMiddleware);

  // Disable cache for API responses
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // CORS configuration
  const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(o => o.trim());
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  }));

  // Body parsing middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(cookieParser());

  // Logging
  app.use(morgan('dev'));

  // API Routes
  app.use('/api/auth', auth);
  app.use('/api/categories', categories);
  app.use('/api/listings', listings);
  app.use('/api/favorites', favorites);
  app.use('/api/messages', messages);
  app.use('/api/trade', trade);
  app.use('/api/orders', orders);
  app.use('/api/cart', cart);
  app.use('/api/billing', billing);
  app.use('/api/users', users);
  app.use('/api/legal', legal);
  app.use('/api/setup', setup);
  app.use('/api/sellers', sellers);
  app.use('/api/uploads', uploads);
  app.use('/api/admin', admin);
  app.use('/api/debug', debug);
  app.use('/api/shop-management', shopManagement);
  app.use('/api/notifications', notifications);
  app.use('/api/search', search);
  app.use('/api/test', testRunner);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error'
    });
  });

  // Create HTTP server
  const PORT = process.env.PORT || 3000;
  const server = http.createServer(app);

  // Setup WebSocket - listen for upgrade events
  server.on('upgrade', (request, socket, head) => {
    handleWebSocket(request, socket, head);
  });

  // Start server
  server.listen(PORT, () => {
    console.log(`✅ API Server running on port ${PORT}`);
    console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✅ CORS Origins: ${allowedOrigins.join(', ')}`);
  });
})();