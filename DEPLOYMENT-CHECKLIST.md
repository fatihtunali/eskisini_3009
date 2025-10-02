# Production Deployment Checklist

## Backend API Server (api.eskisiniveryenisinial.com)

### Files to Upload:

1. **server-production.js** → Rename to `server.js` on server
   - Location: `c:\eskisini_2209\server-production.js`
   - Has flat file structure (no ./backend/ prefix)

2. **All backend folders** (upload to root):
   - `/routes/` folder
   - `/middleware/` folder
   - `/services/` folder
   - `/utils/` folder
   - All other files: `db.js`, `websocket.js`, etc.

3. **.env file** - Update with these values:
```env
NODE_ENV=production
PORT=3000

# Database
DB_HOST=93.113.96.11
DB_PORT=3306
DB_USER=fatihtunali
DB_PASS=Dlr235672.-Yt
DB_NAME=eskisini_db

# Security
JWT_SECRET=Diler-Yalin-Fatih-030113
ADMIN_KEY=Diler-Yalin-Fatih-030113

# CORS
CORS_ORIGIN=https://test.eskisiniveryenisinial.com,https://api.eskisiniveryenisinial.com

# Cookies
COOKIE_SECURE=true
COOKIE_SAMESITE=strict
COOKIE_DOMAIN=.eskisiniveryenisinial.com

# Cloudinary
CLOUDINARY_CLOUD_NAME=dwgua2oxy
CLOUDINARY_API_KEY=648262632261768
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# OpenAI
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
```

### Start Backend:
```bash
cd /home/yalintunali/api
pm2 start server.js --name "marketplace-api"
pm2 save
```

---

## Frontend Server (test.eskisiniveryenisinial.com)

### Critical Files to Upload:

1. **core-loader-prod.js** → Upload as `/js/core-loader.js`
   - Source: `c:\eskisini_2209\frontend\public\js\core-loader-prod.js`
   - Destination: `test.eskisiniveryenisinial.com/js/core-loader.js`
   - **This is the MOST IMPORTANT file!**
   - Sets hardcoded API URL: `https://api.eskisiniveryenisinial.com`

2. **admin-login.html** → Upload as `/admin-login.html`
   - Source: `c:\eskisini_2209\frontend\public\admin-login.html`
   - Destination: `test.eskisiniveryenisinial.com/admin-login.html`
   - Has improved fallback logic

3. **index.js** → Upload as `/js/index.js`
   - Source: `c:\eskisini_2209\frontend\public\js\index.js`
   - Destination: `test.eskisiniveryenisinial.com/js/index.js`
   - Has fixed fallback logic

### After Upload:

1. **Clear browser cache:**
   - Press `Ctrl + Shift + R` (Windows/Linux)
   - Or `Cmd + Shift + R` (Mac)
   - This forces browser to reload all cached JavaScript files

2. **Verify in Console:**
   - Open browser console (F12)
   - Look for this log:
   ```
   🚀 Production Core-loader: API_BASE hardcoded to: https://api.eskisiniveryenisinial.com
   ```
   - Check `window.APP.API_BASE` value:
   ```javascript
   console.log(window.APP.API_BASE)
   // Should show: https://api.eskisiniveryenisinial.com
   ```

3. **Test API Calls:**
   - Go to admin login page
   - Check console for:
   ```
   🔐 Admin-login: Using API_BASE: https://api.eskisiniveryenisinial.com
   ```
   - Try to login
   - Verify API calls go to: `https://api.eskisiniveryenisinial.com/api/auth/login`
   - NOT: `https://test.eskisiniveryenisinial.com/api/auth/login`

---

## Current Issue

Your **live server** console shows:
```
POST https://test.eskisiniveryenisinial.com/api/auth/login 404 (Not Found)
```

This is **WRONG** - it should call: `https://api.eskisiniveryenisinial.com/api/auth/login`

**Root Cause:** Live server has OLD JavaScript files that don't set `window.APP.API_BASE` correctly.

**Solution:** Upload the 3 critical files above and hard refresh browser.

---

## Verification Checklist

### Backend API (api.eskisiniveryenisinial.com)
- [ ] `https://api.eskisiniveryenisinial.com/health` returns 200 OK
- [ ] `https://api.eskisiniveryenisinial.com/api/categories` returns categories array
- [ ] PM2 process is running: `pm2 list`

### Frontend (test.eskisiniveryenisinial.com)
- [ ] Console shows: `🚀 Production Core-loader: API_BASE hardcoded to: https://api.eskisiniveryenisinial.com`
- [ ] `window.APP.API_BASE` === `"https://api.eskisiniveryenisinial.com"`
- [ ] Admin login calls: `https://api.eskisiniveryenisinial.com/api/auth/login`
- [ ] Homepage loads categories successfully
- [ ] No 404 errors on API calls

---

## Troubleshooting

### If API calls still go to test.eskisiniveryenisinial.com:
1. Check if you uploaded core-loader-prod.js as core-loader.js
2. Hard refresh browser (Ctrl+Shift+R) multiple times
3. Clear browser cache completely
4. Try incognito/private browsing mode
5. Check if CDN/proxy is caching old files

### If console doesn't show production logs:
1. Verify file was uploaded correctly
2. Check file permissions on server
3. View page source and verify <script src="/js/core-loader.js"> is loading the new file
4. Try accessing the file directly: `https://test.eskisiniveryenisinial.com/js/core-loader.js`

### If backend returns 503:
1. Check PM2 status: `pm2 list`
2. Check PM2 logs: `pm2 logs marketplace-api`
3. Restart backend: `pm2 restart marketplace-api`
4. Check database connection in .env

---

## Important Notes

1. **DO NOT** upload the old `core-loader.js` - use `core-loader-prod.js` renamed
2. **DO NOT** forget to hard refresh browser after uploading files
3. **DO KEEP** csp-bypass.js - it's working correctly
4. All backend files must be in FLAT structure on server (no nested /backend/ folder)