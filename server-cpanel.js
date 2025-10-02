// server-cpanel.js - Unified Server for cPanel/MuvHost Deployment
// This server handles BOTH API and frontend serving on a single domain

console.log('[BOOT] cPanel unified server starting…');

// Load configuration
const config = require('./backend/config.js');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');
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

  // CORS configuration
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
      environment: config.NODE_ENV,
      server: 'cpanel-unified'
    });
  });

  // Config endpoint for frontend
  app.get('/api/config', (req, res) => {
    // Return same domain for API base (since unified server)
    const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;

    res.json({
      apiBase: baseUrl,
      frontendBase: baseUrl,
      apiPort: config.API_PORT,
      server: 'unified'
    });
  });

  // ========== API ROUTES ==========
  app.use('/api/auth', auth);
  app.use('/api/categories', categories);
  app.use('/api/listings', listings);
  app.use('/api/favorites', favorites);
  app.use('/api/cart', cart);
  app.use('/api/orders', orders);
  app.use('/api/messages', messages);
  app.use('/api/trade', trade);
  app.use('/api/billing', billing);
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

  // ========== STATIC FILE SERVING ==========
  const frontendPath = path.join(__dirname, 'frontend', 'public');

  // Serve static files with caching
  app.use(express.static(frontendPath, {
    maxAge: '1d', // Cache static assets for 1 day
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      // Cache images, fonts, CSS, JS longer
      if (filePath.match(/\.(jpg|jpeg|png|gif|ico|css|js|woff|woff2|ttf|svg)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
      }
      // Don't cache HTML files
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    }
  }));

  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
      return next();
    }

    // Skip static files
    if (req.path.match(/\.\w+$/)) {
      return next();
    }

    // For all other routes, serve index.html (SPA routing)
    res.sendFile(path.join(frontendPath, 'index.html'));
  });

  // 404 handler for API routes
  app.use('/api/*', (req, res) => {
    res.status(404).json({
      ok: false,
      error: 'API endpoint not found',
      path: req.path
    });
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error('[ERROR]', err);
    res.status(500).json({
      ok: false,
      error: process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message
    });
  });

  // ========== START SERVER ==========
  const PORT = process.env.PORT || 3000;
  const server = http.createServer(app);

  // WebSocket support
  server.on('upgrade', (request, socket, head) => {
    handleWebSocket(request, socket, head);
  });

  server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════╗
║  🚀 cPanel Unified Server Running                  ║
║                                                    ║
║  Port: ${PORT}                                        ║
║  Environment: ${config.NODE_ENV}                      ║
║  Database: Connected ✓                            ║
║                                                    ║
║  API Endpoints: http://localhost:${PORT}/api          ║
║  Frontend: http://localhost:${PORT}                   ║
║  Health: http://localhost:${PORT}/api/health          ║
║                                                    ║
║  WebSocket: ws://localhost:${PORT}/ws/notifications   ║
╚════════════════════════════════════════════════════╝
    `);
  });

})().catch(err => {
  console.error('[FATAL] Server failed to start:', err);
  process.exit(1);
});
