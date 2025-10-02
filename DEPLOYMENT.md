# Production Deployment Guide

This guide explains how to deploy the application to your production servers.

## Architecture Overview

Your production setup uses **two separate servers**:

1. **API Server** (`api.eskisiniveryenisinial.com`)
   - Runs: `server.js` (root directory)
   - Purpose: Backend API, WebSocket connections, database operations
   - Port: 3000 (configurable via `PORT` env variable)

2. **Frontend Server** (`test.eskisiniveryenisinial.com`)
   - Runs: `server-frontend.js` (root directory)
   - Purpose: Static file serving, proxies `/api` requests to backend
   - Port: 5500 (configurable via `FRONTEND_PORT` env variable)

## Why Two Servers?

- **Separation of concerns**: API and static files are served independently
- **Security**: API server doesn't expose static files; frontend doesn't have database access
- **Scalability**: Each server can be scaled independently
- **Better performance**: Static files served with optimized caching and compression
- **CDN-ready**: Frontend can be easily moved behind a CDN

## API Server Deployment (api.eskisiniveryenisinial.com)

### 1. Upload Files
Upload these files/folders to your API server:
```
server.js               (main entry point)
backend/               (all backend code)
database/              (database setup scripts)
node_modules/          (or run npm install on server)
package.json
.env                   (create from .env.example)
```

### 2. Configure Environment (.env)
```bash
# Server
PORT=3000

# Database
DB_HOST=your_db_host
DB_PORT=3306
DB_USER=your_db_user
DB_PASS=your_db_password
DB_NAME=eskisini_db
DB_SSL=true

# JWT Secret (REQUIRED - min 32 chars)
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters_long

# CORS - Include your frontend domain
CORS_ORIGIN=https://test.eskisiniveryenisinial.com,https://www.test.eskisiniveryenisinial.com

# Security - IMPORTANT for production
COOKIE_SECURE=true
COOKIE_SAMESITE=lax

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# OpenAI
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4o-mini

# Other settings (see .env.example for full list)
```

### 3. Install Dependencies
```bash
npm install --production
```

### 4. Setup Database
```bash
npm run setup-db
```

### 5. Start Server
```bash
# Using npm
npm start

# Or directly with Node.js
node server.js

# For production with PM2 (recommended)
pm2 start server.js --name "api-server"
pm2 save
pm2 startup
```

### 6. Verify API Server
Visit: `https://api.eskisiniveryenisinial.com/api/health`

Should return:
```json
{
  "ok": true,
  "timestamp": "2025-09-30T...",
  "environment": "production"
}
```

## Frontend Server Deployment (test.eskisiniveryenisinial.com)

### 1. Upload Files
Upload these files/folders to your frontend server:
```
server-frontend.js      (main entry point)
frontend/              (all frontend code)
node_modules/          (or run npm install on server)
package.json
.env                   (create from .env.example)
```

### 2. Configure Environment (.env)
```bash
# Frontend Server
FRONTEND_PORT=5500
FRONTEND_HOST=0.0.0.0

# API Target - Point to your API server
API_TARGET=https://api.eskisiniveryenisinial.com

# Note: Database and other backend configs NOT needed here
```

### 3. Install Dependencies
```bash
npm install --production
```

### 4. Start Server
```bash
# Using npm
npm run start:frontend

# Or directly with Node.js
node server-frontend.js

# For production with PM2 (recommended)
pm2 start server-frontend.js --name "frontend-server"
pm2 save
```

### 5. Verify Frontend Server
Visit: `https://test.eskisiniveryenisinial.com`

Should load your homepage and proxy API requests to the backend.

## Local Development

For local development, you have multiple options:

### Option 1: Browser-Sync (Recommended for Frontend Development)
```bash
npm run dev
```
- API: `http://localhost:3000`
- Frontend: `http://localhost:5500` (with live reload)

### Option 2: Production-like Setup
```bash
npm run dev:prod
```
- API: `http://localhost:3000`
- Frontend: `http://localhost:5500` (served by server-frontend.js)

### Option 3: Separate Terminals
**Terminal 1 (API):**
```bash
npm run dev:api
```

**Terminal 2 (Frontend):**
```bash
npm run dev:web
# OR
npm run dev:frontend
```

## Environment Variables Summary

### API Server (.env)
| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `PORT` | Yes | `3000` | API server port |
| `DB_HOST` | Yes | `localhost` | Database host |
| `DB_USER` | Yes | `dbuser` | Database user |
| `DB_PASS` | Yes | `password` | Database password |
| `DB_NAME` | Yes | `eskisini_db` | Database name |
| `JWT_SECRET` | **YES** | `32+ char string` | Server won't start without this |
| `CORS_ORIGIN` | Yes | `https://test.eskisiniveryenisinial.com` | Comma-separated |
| `COOKIE_SECURE` | Yes | `true` (prod) / `false` (dev) | Secure cookies |
| `CLOUDINARY_*` | Yes | Various | Image hosting |
| `OPENAI_API_KEY` | Yes | `sk-...` | AI features |

### Frontend Server (.env)
| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `FRONTEND_PORT` | No | `5500` | Defaults to 5500 |
| `FRONTEND_HOST` | No | `0.0.0.0` | Defaults to 0.0.0.0 |
| `API_TARGET` | Yes | `https://api.eskisiniveryenisinial.com` | Backend API URL |

## Production Checklist

### API Server
- [ ] `.env` file created with all required variables
- [ ] `JWT_SECRET` is at least 32 characters and unique
- [ ] `COOKIE_SECURE=true` set
- [ ] `CORS_ORIGIN` includes only your frontend domains (NO wildcards)
- [ ] Database credentials are correct and database exists
- [ ] SSL/TLS certificate installed on domain
- [ ] Firewall allows incoming connections on API port
- [ ] Database backups configured
- [ ] Process manager (PM2) configured for auto-restart
- [ ] Logs are being collected

### Frontend Server
- [ ] `.env` file created with `API_TARGET` pointing to API server
- [ ] SSL/TLS certificate installed on domain
- [ ] Static files in `frontend/public/` directory
- [ ] Process manager (PM2) configured for auto-restart
- [ ] Firewall allows incoming connections on frontend port

## Troubleshooting

### API Server Issues

**Server won't start**
- Check if `JWT_SECRET` is set in `.env`
- Verify database connection: `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`
- Check if port 3000 is already in use: `npx kill-port 3000`

**CORS errors**
- Ensure `CORS_ORIGIN` includes your frontend domain: `https://test.eskisiniveryenisinial.com`
- Check protocol (http vs https) matches
- Clear browser cookies and try again

**Database connection errors**
- Verify database exists: `mysql -u user -p -e "SHOW DATABASES;"`
- Test connection: `mysql -h HOST -u USER -p DATABASE`
- Check if `DB_SSL=true` is needed for your host

### Frontend Server Issues

**Can't reach frontend**
- Check if `server-frontend.js` is running
- Verify `FRONTEND_PORT` is correct (default 5500)
- Check firewall rules allow the port

**API requests failing (502 errors)**
- Verify `API_TARGET` in `.env` points to correct API server
- Check API server is running and accessible
- Test API directly: `curl https://api.eskisiniveryenisinial.com/api/health`

**Static files not loading**
- Verify `frontend/public/` directory exists and contains files
- Check file permissions (readable by Node.js process)
- Look for errors in console: `pm2 logs frontend-server`

## Process Management with PM2

### Install PM2 globally
```bash
npm install -g pm2
```

### Start both servers
```bash
# On API server
pm2 start server.js --name "api-server"

# On frontend server
pm2 start server-frontend.js --name "frontend-server"
```

### Common PM2 commands
```bash
pm2 list                    # List all processes
pm2 logs api-server         # View logs
pm2 restart api-server      # Restart
pm2 stop api-server         # Stop
pm2 delete api-server       # Remove from PM2

pm2 save                    # Save current process list
pm2 startup                 # Configure PM2 to start on system boot
```

### Monitor with PM2
```bash
pm2 monit                   # Real-time monitoring
```

## Nginx Reverse Proxy (Optional but Recommended)

If using Nginx as reverse proxy:

### API Server (api.eskisiniveryenisinial.com)
```nginx
server {
    listen 443 ssl http2;
    server_name api.eskisiniveryenisinial.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Frontend Server (test.eskisiniveryenisinial.com)
```nginx
server {
    listen 443 ssl http2;
    server_name test.eskisiniveryenisinial.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:5500;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Security Best Practices

1. **Never commit `.env` files** - They contain secrets
2. **Use strong JWT_SECRET** - At least 32 random characters
3. **Enable COOKIE_SECURE in production** - Prevents cookie theft
4. **Limit CORS_ORIGIN** - Only allow your own domains
5. **Keep dependencies updated** - Run `npm audit` regularly
6. **Use HTTPS everywhere** - Install SSL certificates
7. **Regular database backups** - Automate with cron jobs
8. **Monitor logs** - Use PM2 logs or external logging service
9. **Rate limiting** - Already configured in backend
10. **Regular security audits** - Review code and dependencies

## Maintenance

### Update Application
```bash
# Pull latest code
git pull origin main

# Install dependencies
npm install

# Restart servers
pm2 restart api-server
pm2 restart frontend-server
```

### Database Migrations
```bash
# Run migration scripts
npm run setup-db

# Or manually
mysql -u user -p eskisini_db < database/migration.sql
```

### View Logs
```bash
# PM2 logs
pm2 logs api-server
pm2 logs frontend-server

# Or if running directly
node server.js > api.log 2>&1
node server-frontend.js > frontend.log 2>&1
```

## Support

For issues or questions:
1. Check logs: `pm2 logs [service-name]`
2. Verify environment variables in `.env`
3. Test API health: `curl https://api.eskisiniveryenisinial.com/api/health`
4. Review this deployment guide

---

**Remember**: Keep your `.env` file secure and never commit it to version control!