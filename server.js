// server.js - Production API Server (api.eskisiniveryenisinial.com)
// This file should be deployed to your API server
console.log('[BOOT] API server starting…');

// Load configuration
const config = require('./backend/config.js');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const http = require('http');

// Import routes
const auth = require('./backend/routes/auth.js');
const categories = require('./backend/routes/categories.js');
const listings = require('./backend/routes/listings.js');
const favorites = require('./backend/routes/favorites.js');
const messages = require('./backend/routes/messages.js');
const trade = require('./backend/routes/trade.js');
const orders = require('./backend/routes/orders.js');
const cart = require('./backend/routes/cart.js');
const billing = require('./backend/routes/billing.js');
const users = require('./backend/routes/users.js');
const legal = require('./backend/routes/legal/index.js');
const setup = require('./backend/routes/setup.js');
const sellers = require('./backend/routes/sellers.js');
const uploads = require('./backend/routes/uploads.js');
const admin = require('./backend/routes/admin.js');
const debug = require('./backend/routes/debug.js');
const shopManagement = require('./backend/routes/shop-management.js');
const notifications = require('./backend/routes/notifications.js');
const search = require('./backend/routes/search.js');
const testRunner = require('./backend/routes/test.js');

const { pingDb } = require('./backend/db.js');
const { handleWebSocket } = require('./backend/websocket.js');
const { cspMiddleware } = require('./backend/mw/csp.js');

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

  // CORS configuration from config
  const ORIGINS = config.CORS_ORIGINS;

  console.log('[CORS] Allowed origins:', ORIGINS);

  // Trust proxy for secure cookies in production
  if (config.COOKIE_SECURE) {
    app.set('trust proxy', 1);
    console.log('[SECURITY] Trust proxy enabled for secure cookies');
  }

  // Middleware
  app.use(morgan('dev'));
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(cors({
    origin: ORIGINS,
    credentials: true
  }));

  // Handle preflight requests
  app.options('*', cors({ origin: ORIGINS, credentials: true }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV
    });
  });

  // Config endpoint for frontend
  app.get('/api/config', (req, res) => {
    res.json({
      apiBase: config.API_BASE,
      frontendBase: config.FRONTEND_BASE,
      apiPort: config.API_PORT,
      frontendPort: config.FRONTEND_PORT
    });
  });

  // Mount API routes
  app.use('/api/auth', auth);
  app.use('/api/billing', billing);
  app.use('/api/categories', categories);
  app.use('/api/favorites', favorites);
  app.use('/api/listings', listings);
  app.use('/api/messages', messages);
  app.use('/api/orders', orders);
  app.use('/api/cart', cart);
  app.use('/api/trade', trade);
  app.use('/api/users', users);
  app.use('/api/legal', legal);
  app.use('/api/setup', setup);
  app.use('/api/sellers', sellers);
  app.use('/api/uploads', uploads);
  app.use('/api/admin', admin);
  app.use('/api/debug', debug);
  app.use('/api/shop', shopManagement);
  app.use('/api/notifications', notifications);
  app.use('/api/search', search);
  app.use('/api/test', testRunner);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ ok: false, error: 'not_found' });
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error('[ERROR]', err);
    res.status(500).json({ ok: false, error: 'server_error' });
  });

  // Create HTTP server
  const server = http.createServer(app);

  // Handle WebSocket upgrades
  server.on('upgrade', handleWebSocket);

  // Start server
  server.listen(config.API_PORT, () => {
    console.log(`[API] Server listening on port ${config.API_PORT}`);
    console.log(`[API] Health check: http://localhost:${config.API_PORT}/api/health`);
    console.log(`[API] Config: http://localhost:${config.API_PORT}/api/config`);
    console.log('[API] Ready to accept connections');
  });
})();