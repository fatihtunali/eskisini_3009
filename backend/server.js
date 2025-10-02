console.log('[BOOT] server starting…');

require('dotenv/config');
const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

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

const { pingDb } = require('./db.js');

(async () => {
await pingDb();



const app = express();
// ETag'ı kapatmak (opsiyonel ama pratik)
app.set('etag', false);

// Sadece API altında cache'i kapat
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store'); // her zaman taze JSON
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});


// --- güvenli CORS köken listesi ---
const ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:5500,http://localhost:5502,http://127.0.0.1:5500,http://127.0.0.1:5502,http://localhost:3000')
  .split(',').map(s=>s.trim()).filter(Boolean);


// Prod’da proxy arkası için (secure cookie/SameSite=None senaryosu)
if (process.env.COOKIE_SECURE === 'true') {
  app.set('trust proxy', 1);
}

// --- middleware sırası ---
app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.use(cors({
  origin: ORIGINS,           // '*' KULLANMA
  credentials: true
}));
// Preflight yanıtı
app.options('*', cors({ origin: ORIGINS, credentials: true }));

// --- health ---
app.get('/api/health', (req, res) => res.json({ ok: true }));

// --- routes ---
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

// --- Static dosya sunumu (frontend) ---
app.use(express.static(path.resolve(__dirname, '../frontend/public')));

// --- 404 ve hata yakalayıcı (opsiyonel ama faydalı) ---
app.use((req, res) => res.status(404).json({ ok: false, error: 'not_found' }));
app.use((err, req, res, next) => {
  console.error('UNCAUGHT', err);
  res.status(500).json({ ok: false, error: 'server_error' });
});

// --- WebSocket support ---
const http = require('http');
const { handleWebSocket } = require('./websocket.js');

// --- start ---
console.log('Environment PORT:', process.env.PORT);
const PORT = process.env.PORT || 3000;
console.log('Final PORT:', PORT);

const server = http.createServer(app);

// Handle WebSocket upgrade
server.on('upgrade', handleWebSocket);

server.listen(PORT, () => console.log('API listening on port', PORT, '- Visit: http://localhost:' + PORT + '/api/health'));

})();
