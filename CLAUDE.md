# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Project guidance for Claude Code when working with this Turkish marketplace platform.

## Project Overview

**Eskisini Ver Yenisini Al** - Turkish P2P marketplace with legal compliance (KVKK, tax, consumer protection).

## Commands

```bash
# Development
npm run dev                # API (3000) + Frontend (5500) with BrowserSync
npm run dev:clean          # Kill ports 3000 & 5500, then start dev
npm run dev:api            # API server only (nodemon)
npm run dev:web            # Frontend only (BrowserSync on 5500)
npm run dev:frontend       # Frontend server only (server-frontend.js)
npm run dev:prod           # API + Frontend server (production-like)
npm run dev:cpanel         # Unified cPanel server (nodemon)

# Production
npm start                  # API server (server.js)
npm run start:api          # API server (alias)
npm run start:frontend     # Frontend server (server-frontend.js)
npm run start:cpanel       # Unified cPanel server (server-cpanel.js)
npm run start:clean        # Kill port 3000, then start API

# Database & CSS
npm run setup-db           # Setup database from schema
npm run css:build          # PurgeCSS + minify (59% reduction)
npm run css:watch          # Watch and rebuild CSS
npm run css:dev            # Build CSS without optimization

# Testing
npm test                   # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # With coverage report
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:api           # API tests only
```

## Architecture

### Production Deployment Options

**Option A: Two-Server Setup (VPS/Cloud)**
1. **API Server** (`server.js`) - Port 3000 → `api.eskisiniveryenisinial.com`
2. **Frontend Server** (`server-frontend.js`) - Port 5500 → `test.eskisiniveryenisinial.com`
- See [DEPLOYMENT.md](DEPLOYMENT.md) for VPS deployment

**Option B: Unified Server (cPanel/Shared Hosting)** ⭐ Recommended for MuvHost
1. **Unified Server** (`server-cpanel.js`) - Single domain serves both API and frontend
   - API: `https://yourdomain.com/api/*`
   - Frontend: `https://yourdomain.com/*`
- See [MUVHOST-CPANEL-DEPLOYMENT.md](MUVHOST-CPANEL-DEPLOYMENT.md) for cPanel deployment

### Backend (Node.js + Express)
- **Entry**: `server.js` (production API server)
- **Config**: `backend/config.js` (centralized configuration, environment detection)
- **Database**: `backend/db.js` (MySQL connection pool with utf8mb4_turkish_ci)
- **Auth**: `backend/mw/auth.js` (JWT cookies with `authRequired`/`authOptional`, token in cookie or Bearer header)
- **Middleware**: `backend/mw/validate.js`, `backend/mw/rateLimit.js`, `backend/mw/csp.js`
- **WebSocket**: `backend/websocket.js` (real-time notifications with JWT auth)
- **Services**: `backend/services/notifications.js`, `backend/services/openai-moderation.js`
- **CSP**: Server headers with `'unsafe-eval'` (Bootstrap/Chart.js) - **NEVER REMOVE**

### API Routes (`/api/*`)
Auth, listings, categories, favorites, cart, orders, messages, trade, billing, users, sellers, uploads, admin, shop, notifications, search, legal (KVKK/tax/complaints)

### Frontend (Vanilla JS)
- **Root**: `frontend/public/`
- **HTML Pages**: `index.html`, `category.html`, `cart.html`, `checkout.html`, `profile.html`, `admin.html`, etc.
- **Core JS**:
  - `api-config.js` - Auto-detects API base (localhost:3000 or api.eskisiniveryenisinial.com)
  - `api.js` - API client wrapper with auth
  - `auth.js` - Authentication utilities
  - `cart.js`, `fav.js` - Shopping cart and favorites
  - `notifications.js` - WebSocket notifications
  - `header-v3.js` - Global header with dropdown
- **Utilities**: `validation.js`, `ui.js`, `cities-tr.js` (81 Turkish cities)
- **Advanced Features**: `advanced-search.js` (real-time search with filters)
- **CSP**: Set by server headers (NOT HTML meta tags)

### Database
- **Docs**: [DATABASE.md](DATABASE.md) - 59 tables, Turkish collation (`utf8mb4_turkish_ci`)
- **Key Tables**: users, listings, orders, messages, cart_items, categories, kvkk_consents, user_complaints, seller_tax_info

### Key Patterns

1. **Dynamic Column Detection** - Auto-detects schema variations (`seller_id`/`user_id`/`owner_id`)
2. **Cookie Auth** - JWT in httpOnly cookies, `credentials: 'include'`
3. **Images** - Cloudinary (listings), DB URLs (avatars, logos)
4. **Real-Time** - WebSocket notifications (`backend/websocket.js`, `services/notifications.js`)
5. **AI Moderation** - OpenAI integration (`services/openai-moderation.js`)
6. **Multi-Env** - Auto-detects localhost vs production domains
7. **CSP** - Server headers with `'unsafe-eval'` (Bootstrap/Chart.js) - **NEVER REMOVE**

## Environment Variables

Create `.env` from `.env.example`. Critical variables:

### Required
- `JWT_SECRET` - JWT signing key (min 32 chars) - **REQUIRED**, server exits if missing
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` - MySQL database connection
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` - Image uploads

### Server Configuration
- `PORT` - API server port (default: 3000)
- `FRONTEND_PORT` - Frontend server port (default: 5500)
- `CORS_ORIGIN` - Comma-separated allowed origins (auto-configured in dev)
- `COOKIE_SECURE` - `true` (prod with HTTPS), `false` (dev)
- `COOKIE_SAMESITE` - `lax` or `strict` (default: `lax`)

### Optional Services
- `OPENAI_API_KEY` - AI content moderation
- `OPENAI_MODEL` - Model name (default: `gpt-4o-mini`)
- `AI_AUTO_APPROVE_ENABLED`, `AI_AUTO_APPROVE_THRESHOLD` - Auto-approval settings
- `ADMIN_KEY` - Admin authentication key

### Business Logic
- `FREE_LISTING_QUOTA` - Free listings per user (default: 5)
- `BUMP_DAYS`, `FEATURED_DAYS`, `HIGHLIGHT_DAYS` - Premium listing durations
- `PAYMENT_CURRENCY` - Currency code (default: TRY)

See [ENVIRONMENT.md](ENVIRONMENT.md) for complete documentation.

## Implementation Notes

### Listings
- Use `LISTING_OWNER_COL` (runtime-detected)
- Status: `draft`, `active`, `sold`, `paused`, `deleted`
- Premium: `bump`, `featured`, `sponsor` (time-based)

### Authentication
- JWT in httpOnly cookie `token`
- User data in `window.currentUser` (NOT localStorage)
- All fetches need `credentials: 'include'`
- Backend: `req.user` available after `authRequired`

### Legal Compliance
- KVKK consent required
- Audit logs in `activity_logs`
- Auto tax calculation
- Auto-generated complaint refs

### CSP Policy
- **Server headers only** (NO HTML meta tags)
- **Includes `'unsafe-eval'`** - DO NOT remove
- See [CSP-CONFIGURATION.md](CSP-CONFIGURATION.md)

### Cache Management (cPanel Hosting)
- **Clear Cache URL**: `https://test.eskisiniveryenisinial.com/clear-cache.php?key=eSkIsInI_CaChe_CLeaR_2025_SecReT`
- **What it clears**: OPcache, APCu, stat cache
- **When to use**: After deploying JS/CSS updates to live server
- **Emergency**: Rename files (`index.js` → `index-v3.js`) if cache persists
- See [CACHE-MANAGEMENT.md](CACHE-MANAGEMENT.md)

## Code Examples

### Frontend: Authenticated API Call
```javascript
// API base is auto-configured by api-config.js
const API_BASE = window.GLOBAL_API_BASE || window.getCorrectApiBase();

// Always use credentials: 'include' for cookie auth
fetch(`${API_BASE}/api/endpoint`, {
  method: 'POST',
  credentials: 'include',  // REQUIRED for JWT cookies
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});
```

### Backend: Protected Route
```javascript
const { authRequired, authOptional } = require('./backend/mw/auth.js');
const { pool } = require('./backend/db.js');

// Required auth - returns 401 if not authenticated
router.post('/endpoint', authRequired, async (req, res) => {
  const userId = req.user.id;  // req.user populated by authRequired
  const isAdmin = req.user.is_admin;
  // ... handle request
});

// Optional auth - req.user is null if not authenticated
router.get('/public-endpoint', authOptional, async (req, res) => {
  const userId = req.user?.id;  // May be null
  // ... handle request
});
```

### Backend: Database Query
```javascript
const { pool } = require('./backend/db.js');

// Use parameterized queries (prevents SQL injection)
const [rows] = await pool.execute(
  'SELECT * FROM listings WHERE id = ? AND status = ?',
  [listingId, 'active']
);

// Multiple rows
const [listings] = await pool.execute(
  'SELECT * FROM listings WHERE seller_id = ? ORDER BY created_at DESC LIMIT ?',
  [sellerId, 10]
);
```

### Frontend: WebSocket Notifications
```javascript
// WebSocket connection with JWT auth
const token = getCookie('token');  // From auth.js
const ws = new WebSocket(`wss://api.example.com/ws/notifications?token=${token}`);

ws.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  console.log('Notification:', notification);
};
```

## Local Setup

```bash
npm install
cp .env.example .env  # Fill credentials
npm run setup-db      # Import schema
npm run dev           # Start servers
# Frontend: http://localhost:5500
# API: http://localhost:3000/api
```

## Turkish Locale
- Content in Turkish, DB uses `utf8mb4_turkish_ci`
- Form validations handle: ı, ğ, ü, ş, ö, ç
- Cities: `frontend/public/js/cities-tr.js` (81 cities)

## Documentation Files

- **[DATABASE.md](DATABASE.md)** - Complete database schema (59 tables), connection info, query patterns
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Two-server production deployment guide (VPS/Cloud)
- **[MUVHOST-CPANEL-DEPLOYMENT.md](MUVHOST-CPANEL-DEPLOYMENT.md)** - ⭐ Unified cPanel deployment guide (MuvHost)
- **[TESTING.md](TESTING.md)** - Jest/Supertest testing guide, coverage, best practices
- **[CACHE-MANAGEMENT.md](CACHE-MANAGEMENT.md)** - cPanel cache clearing for deployments
- **[CSP-CONFIGURATION.md](CSP-CONFIGURATION.md)** - Content Security Policy troubleshooting
- **[CSS-OPTIMIZATION.md](CSS-OPTIMIZATION.md)** - PurgeCSS setup (59% size reduction)
- **[ENVIRONMENT.md](ENVIRONMENT.md)** - Environment variables reference
- **[README_LEGAL.md](README_LEGAL.md)** - KVKK/tax/consumer protection compliance

## Recent Changes (2025-09-30)

### Infrastructure
- **Two-Server Architecture**: Split `server.js` (API) + `server-frontend.js` (Frontend)
- **CSP Fix**: Server headers with `unsafe-eval` (Bootstrap/Chart.js support)
- **CSS Optimization**: PurgeCSS integration (59% reduction: 276KB→112KB)
- **Database Docs**: [DATABASE.md](DATABASE.md) with all 59 tables documented

### UI/UX Improvements
- **Product Card Component**: Unified `window.ProductCard.renderListingCard()` across all pages
- **2-Row Layout**: Image + Row1(title/category/price) + Row2(views/favorite/shop/actions)
- **Header Dropdown**: Fixed Bootstrap initialization with retry logic
- **Notification Sounds**: 6 WAV files (~192KB total)
- **Checkout/Order Pages**: Fixed DOMContentLoaded timing (check `document.readyState`)
- **Search Page**: Upgraded to `advanced-search.js` (real-time, filters, pagination)
- **Cities Dropdown**: All 81 Turkish cities from `cities-tr.js`

### Page Features
- **Seller Profile**: Owner mode (edit/delete/status) vs Public mode (buy button)
- **Profile Page**: My Listings uses ProductCard component
- **Authentication**: User data in `window.currentUser` (NOT localStorage)

### Testing System
- **Jest + Supertest**: 65+ tests (unit, integration, API)
- **Test Database**: Separate `eskisini_db_test` with cleanup utilities
- **Admin UI**: Test runner in admin panel (Flask icon tab)
- **Commands**: `npm test`, `npm run test:coverage`, `npm run test:api`
- **Backend API**: `/api/test/*` endpoints (admin-only)
- **Config**: `jest.config.js` - 10s timeout, CommonJS, coverage disabled by default
- See [TESTING.md](TESTING.md) for documentation

## Common Development Patterns

### API Response Format
All API endpoints follow a consistent response structure:
```javascript
// Success response
{ ok: true, data: {...}, message: 'Success message' }

// Error response
{ ok: false, error: 'Error message', code: 'ERROR_CODE' }
```

### Environment Detection
The codebase auto-detects environment (localhost vs production):
- **Backend**: `backend/config.js` checks `process.env.NODE_ENV` and hostname
- **Frontend**: `api-config.js` checks `window.location.hostname`
- **localhost/127.0.0.1** → API: `http://localhost:3000`
- **test.eskisiniveryenisinial.com** → API: `https://api.eskisiniveryenisinial.com`

### CSS Organization
- **Source**: `frontend/public/css/*.css`
- **Build Output**: `frontend/public/css/dist/*.min.css`
- **PostCSS**: Configured in `postcss.config.js` with PurgeCSS + CSSnano
- **Production**: Always use minified `.min.css` files
- **Bootstrap**: Safeguarded classes (btn-*, modal-*, dropdown-*, etc.)

## Troubleshooting

### CORS Errors
- Ensure `credentials: 'include'` in all fetch calls
- Check `CORS_ORIGIN` in `.env` includes frontend domain
- API must return `Access-Control-Allow-Credentials: true`

### Authentication Issues
- JWT stored in httpOnly cookie named `token`
- Cookie requires `COOKIE_SECURE=true` for HTTPS
- Use `authRequired` middleware for protected routes
- User data available in `req.user` after auth middleware

### Database Connection
- Charset is `utf8mb4`, collation `utf8mb4_turkish_ci`
- Connection pool limited to 10 connections
- 60s timeout for queries
- Use `await pool.execute(sql, params)` with parameterized queries

### WebSocket Connection
- Endpoint: `/ws/notifications`
- Auth via query param: `?token=<jwt>` or cookie
- Server validates JWT before upgrading connection
- Client must handle reconnection on disconnect

### CSP Violations
- CSP configured in `backend/mw/csp.js`
- Includes `'unsafe-eval'` for Bootstrap/Chart.js
- **NEVER add CSP meta tags to HTML** - use server headers only
- See [CSP-CONFIGURATION.md](CSP-CONFIGURATION.md) for debugging

