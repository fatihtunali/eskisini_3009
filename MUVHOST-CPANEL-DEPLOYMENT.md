# MuvHost cPanel Deployment Guide

Complete step-by-step guide to deploy **Eskisini Ver Yenisini Al** on MuvHost cPanel hosting.

## Overview

This guide uses the **unified server** approach (`server-cpanel.js`) which serves both API and frontend from a single Node.js application. This is ideal for cPanel hosting.

### Architecture
```
Single Domain (e.g., eskisiniveryenisinial.com)
    ↓
cPanel Node.js Application (server-cpanel.js)
    ├── API Routes (/api/*)
    └── Static Files (frontend/public/*)
```

## Prerequisites

- ✅ MuvHost cPanel account with Node.js support
- ✅ MySQL database created in cPanel
- ✅ Domain/subdomain configured
- ✅ SSH access (optional, recommended)
- ✅ Git installed on cPanel (optional)

## Step 1: Prepare Your Files

### 1.1 Build CSS (Local)
```bash
npm run css:build
```
This creates optimized CSS in `frontend/public/css/dist/`

### 1.2 Files to Upload
Upload these to cPanel via FTP/File Manager:

**Required Files:**
```
server-cpanel.js          ← Main entry point
package.json
.env                      ← Create from .env.example
backend/                  ← All backend code
frontend/public/          ← All frontend files
database/                 ← Database setup files
```

**Optional (if not installing on server):**
```
node_modules/            ← Only if you can't run npm install on server
```

**DO NOT Upload:**
```
.git/
node_modules/ (if you'll run npm install on server)
tests/
.env.example
```

## Step 2: Create MySQL Database

### 2.1 In cPanel MySQL
1. Create database: `eskisini_db`
2. Create user: `eskisini_user`
3. Set password (strong password)
4. Add user to database with ALL PRIVILEGES

### 2.2 Import Schema
**Via cPanel phpMyAdmin:**
1. Select your database
2. Click "Import"
3. Upload `database/schema.sql` (or exported schema)
4. Execute

**Via SSH (if available):**
```bash
mysql -u eskisini_user -p eskisini_db < database/schema.sql
```

Note your database credentials:
- Host: Usually `localhost` or `127.0.0.1`
- Port: `3306`
- Database: `eskisini_db`
- User: `eskisini_user`
- Password: [your password]

## Step 3: Configure Environment Variables

### 3.1 Create .env File
In your website root directory, create `.env`:

```bash
# Server Configuration
PORT=3000
NODE_ENV=production

# Database (Replace with your cPanel MySQL credentials)
DB_HOST=localhost
DB_PORT=3306
DB_USER=eskisini_user
DB_PASS=YOUR_DATABASE_PASSWORD
DB_NAME=eskisini_db
DB_SSL=false

# JWT Secret (REQUIRED - Generate a strong random key)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters_long_change_this

# Admin Key (Generate another random key)
ADMIN_KEY=your_admin_secret_key_change_this

# CORS Origins (Your domain)
CORS_ORIGIN=https://eskisiniveryenisinial.com,https://www.eskisiniveryenisinial.com

# Cookie Settings (IMPORTANT for production)
COOKIE_SECURE=true
COOKIE_SAMESITE=lax

# Cloudinary (Image Uploads)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# OpenAI (Optional - for AI moderation)
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini

# Business Settings
FREE_LISTING_QUOTA=5
BUMP_DAYS=0
FEATURED_DAYS=7
HIGHLIGHT_DAYS=30
PAYMENT_CURRENCY=TRY
PAYMENT_CURRENCY_SYMBOL=₺

# AI Auto-Approval (Optional)
AI_AUTO_APPROVE_ENABLED=true
AI_AUTO_APPROVE_THRESHOLD=85
AI_AUTO_REJECT_THRESHOLD=20
```

### 3.2 Security Checklist
- [ ] Changed `JWT_SECRET` to random 32+ character string
- [ ] Changed `ADMIN_KEY` to random string
- [ ] Set `COOKIE_SECURE=true`
- [ ] Added your domain to `CORS_ORIGIN`
- [ ] Database credentials are correct

## Step 4: Install Dependencies

### Option A: Via cPanel Terminal/SSH
```bash
cd /home/username/public_html  # Your website directory
npm install --production
```

### Option B: Via cPanel Node.js Application Manager
1. Go to cPanel → Setup Node.js App
2. Select your application
3. Click "Run NPM Install"

### Option C: Upload node_modules (Not Recommended)
If you can't install on server, zip `node_modules/` locally and upload.

## Step 5: Setup Node.js Application in cPanel

### 5.1 Create Node.js Application
1. **Login to cPanel**
2. **Find "Setup Node.js App"** (Software section)
3. **Click "Create Application"**

### 5.2 Application Settings
```
Node.js version: 18.x or higher (use latest LTS)
Application mode: Production
Application root: public_html (or your directory)
Application URL: https://eskisiniveryenisinial.com
Application startup file: server-cpanel.js
```

### 5.3 Environment Variables (in cPanel)
Add these in the Node.js App interface:
```
PORT=3000
NODE_ENV=production
```

**Note:** cPanel may override PORT. The app will use `process.env.PORT` automatically.

### 5.4 Start Application
1. Click "Save" to create the application
2. Click "Start App" or "Restart App"
3. Check Status - should show "Running"

## Step 6: Configure .htaccess (Important!)

Create or edit `.htaccess` in your website root:

```apache
# Enable Node.js proxy
RewriteEngine On

# Redirect all requests to Node.js app
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ http://127.0.0.1:3000/$1 [P,L]

# Headers for CORS (if needed)
<IfModule mod_headers.c>
    Header set Access-Control-Allow-Origin "*"
    Header set Access-Control-Allow-Credentials "true"
</IfModule>

# Compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
</IfModule>

# Browser caching
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/gif "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
    ExpiresByType text/css "access plus 1 month"
    ExpiresByType application/javascript "access plus 1 month"
    ExpiresByType application/font-woff "access plus 1 year"
    ExpiresByType application/font-woff2 "access plus 1 year"
</IfModule>
```

**Important:** Replace `3000` with the actual port cPanel assigns (check Node.js App settings).

## Step 7: SSL Certificate (HTTPS)

### 7.1 Install SSL
1. Go to cPanel → SSL/TLS Status
2. Select your domain
3. Click "Run AutoSSL" (Let's Encrypt - Free)
4. Wait for certificate to be issued

### 7.2 Force HTTPS
Add to `.htaccess` (top of file):
```apache
# Force HTTPS
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

## Step 8: Verify Deployment

### 8.1 Check Health Endpoint
Visit: `https://yourdomain.com/api/health`

Should return:
```json
{
  "ok": true,
  "timestamp": "2025-10-02T...",
  "environment": "production",
  "server": "cpanel-unified"
}
```

### 8.2 Check Frontend
Visit: `https://yourdomain.com`
- Should load homepage
- Check browser console (F12) - no errors
- Check Network tab - API calls should work

### 8.3 Test Login
1. Try to login/register
2. Check cookies in DevTools → Application → Cookies
3. Should see `token` cookie with httpOnly flag

### 8.4 Common Issues

**Issue: "Cannot GET /"**
- Check Node.js app is running in cPanel
- Verify `.htaccess` proxy configuration
- Check Application startup file is `server-cpanel.js`

**Issue: API calls fail with CORS error**
- Add your domain to `.env` → `CORS_ORIGIN`
- Restart Node.js application
- Clear browser cache

**Issue: CSS/JS not loading**
- Check file paths are correct (no `/dist/` in HTML if using source files)
- Run `npm run css:build` and upload minified CSS
- Clear cPanel cache and browser cache

**Issue: Database connection error**
- Verify DB credentials in `.env`
- Check database exists in cPanel MySQL
- Test connection: `mysql -u user -p database` via SSH

**Issue: "JWT_SECRET missing"**
- Add `JWT_SECRET` to `.env`
- Must be 32+ characters
- Restart application

## Step 9: Monitoring & Logs

### 9.1 View Logs
**In cPanel Node.js App:**
- Click on your application
- Scroll to "Application Logs"
- Check for errors

**Via SSH:**
```bash
pm2 logs  # If using PM2
tail -f /home/username/logs/node-app.log  # Check cPanel log path
```

### 9.2 Restart Application
**In cPanel:**
- Setup Node.js App → Click "Restart"

**Via SSH:**
```bash
pm2 restart all
```

### 9.3 Monitor Performance
- Check CPU/RAM usage in cPanel → Resource Usage
- Monitor response times
- Set up uptime monitoring (UptimeRobot, etc.)

## Step 10: Post-Deployment Tasks

### 10.1 Clear Caches
```bash
# Visit cache clear URL (if you have clear-cache.php)
https://yourdomain.com/clear-cache.php?key=eSkIsInI_CaChe_CLeaR_2025_SecReT
```

### 10.2 Test Critical Features
- [ ] User registration/login
- [ ] Create listing
- [ ] Upload images (Cloudinary)
- [ ] Add to cart
- [ ] Checkout process
- [ ] Real-time notifications
- [ ] Admin panel access

### 10.3 Security Hardening
- [ ] Remove `clear-cache.php` or change secret key
- [ ] Disable directory listing in `.htaccess`:
  ```apache
  Options -Indexes
  ```
- [ ] Set proper file permissions:
  ```bash
  find . -type f -exec chmod 644 {} \;
  find . -type d -exec chmod 755 {} \;
  chmod 600 .env
  ```

### 10.4 Backup Strategy
1. **Database Backup:**
   - cPanel → Backup Wizard → Download Database
   - Or automate: `mysqldump -u user -p database > backup.sql`

2. **File Backup:**
   - cPanel → Backup Wizard → Download Home Directory
   - Or use Git for version control

3. **Automated Backups:**
   - Set up cPanel automatic backups
   - Use external backup service

## Troubleshooting Guide

### Port Already in Use
```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Or let cPanel assign port automatically
```

### Application Won't Start
1. Check `server-cpanel.js` exists
2. Verify `package.json` scripts
3. Check logs for errors
4. Ensure all dependencies installed
5. Verify Node.js version compatibility

### WebSocket Connection Issues
- Check firewall allows WebSocket
- Verify SSL certificate covers WebSocket
- Update `.htaccess` for WebSocket proxy:
  ```apache
  RewriteRule ^ws/(.*)$ ws://127.0.0.1:3000/ws/$1 [P,L]
  ```

### Database Connection Pool Exhausted
- Increase pool size in `backend/db.js`
- Check for connection leaks
- Monitor active connections

## Performance Optimization

### 1. Enable Compression
Already in `.htaccess` - verify `mod_deflate` is enabled in cPanel.

### 2. Use CDN for Static Assets
Upload to Cloudinary or CDN:
- CSS files
- JavaScript files
- Images
- Fonts

### 3. Database Optimization
```sql
-- Add indexes for frequent queries
ALTER TABLE listings ADD INDEX idx_status (status);
ALTER TABLE listings ADD INDEX idx_seller (seller_id);

-- Optimize tables
OPTIMIZE TABLE listings;
OPTIMIZE TABLE users;
```

### 4. Caching Strategy
- Static files: 1 year (in `.htaccess`)
- API responses: `no-cache` (already set)
- Implement Redis for session storage (advanced)

## Support & Next Steps

### Development Workflow
```bash
# Local development
npm run dev:cpanel

# Test locally
curl http://localhost:3000/api/health

# Deploy changes
# 1. Build CSS: npm run css:build
# 2. Upload changed files via FTP
# 3. Restart app in cPanel
```

### Production Checklist
- [ ] `.env` configured with production values
- [ ] SSL certificate installed
- [ ] Database imported and migrated
- [ ] All dependencies installed
- [ ] Node.js app running and monitored
- [ ] Backups configured
- [ ] Performance tested
- [ ] Security hardened

### Getting Help
- Check cPanel error logs
- Review Node.js application logs
- Test API endpoints with curl/Postman
- Check browser console for frontend errors

---

## Quick Reference

**Start Application:**
```bash
npm start:cpanel
# or
node server-cpanel.js
```

**Local Testing:**
```bash
npm run dev:cpanel
```

**Check Health:**
```
https://yourdomain.com/api/health
```

**Application Files:**
- Entry: `server-cpanel.js`
- Config: `backend/config.js`
- Database: `backend/db.js`
- Frontend: `frontend/public/`

**Important URLs:**
- Frontend: `https://yourdomain.com`
- API: `https://yourdomain.com/api/*`
- Health: `https://yourdomain.com/api/health`
- Admin: `https://yourdomain.com/admin.html`

---

🎉 **Deployment Complete!** Your application should now be running on MuvHost cPanel.

For issues or questions, check the logs and verify each step carefully.
