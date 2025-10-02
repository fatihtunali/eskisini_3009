# Cache Management Guide

## Overview
This guide explains how to manage caching on the cPanel shared hosting environment to prevent stale JavaScript/CSS files from affecting the live site.

## The Caching Problem

**Issue**: cPanel/Apache servers cache static files (JS, CSS) aggressively (24+ hours by default)
**Result**: Code updates don't take effect immediately, causing bugs and confusion

## Solution 1: PHP Cache Clear Script (Recommended)

### Setup
1. Upload `clear-cache.php` to `frontend/public/` directory on cPanel
2. The script is already configured with:
   - Secret key: `eSkIsInI_CaChe_CLeaR_2025_SecReT`
   - Allowed IP: `88.228.207.166`

### Usage

**Option A: Visit URL with Secret Key (Easiest)**
```
https://test.eskisiniveryenisinial.com/clear-cache.php?key=eSkIsInI_CaChe_CLeaR_2025_SecReT
```

**Option B: Access from Allowed IP**
```
https://test.eskisiniveryenisinial.com/clear-cache.php
```
(No key needed if accessing from 88.228.207.166)

### What It Clears
- ✅ **OPcache** - PHP opcode cache
- ✅ **APCu** - PHP user cache
- ✅ **Stat cache** - File system stat cache

### Expected Output
```
✅ OPcache cleared
✅ APCu cache cleared
✅ Stat cache cleared

✅ All available caches cleared!
🕒 Time: 2025-09-30 14:30:45
```

### Security Note
⚠️ **NEVER share the secret key publicly or commit it to GitHub**
- The script blocks unauthorized access (403 Forbidden)
- Only works from allowed IP or with correct secret key

## Solution 2: .htaccess Cache Control

### Setup
The `.htaccess` file in `frontend/public/` directory controls browser caching:

```apache
# JavaScript files - NO CACHE (always fetch fresh)
<FilesMatch "\.(js|mjs)$">
    Header set Cache-Control "no-cache, no-store, must-revalidate, max-age=0"
    Header set Pragma "no-cache"
    Header set Expires "0"
</FilesMatch>

# CSS files - NO CACHE
<FilesMatch "\.css$">
    Header set Cache-Control "no-cache, no-store, must-revalidate, max-age=0"
    Header set Pragma "no-cache"
    Header set Expires "0"
</FilesMatch>
```

### Verify .htaccess is Working
```bash
curl -I https://test.eskisiniveryenisinial.com/js/index-v2.js
```

Look for:
```
Cache-Control: no-cache, no-store, must-revalidate
```

## Solution 3: File Versioning (Emergency)

When cache-clearing doesn't work, rename files completely:

### Step 1: Rename Files
```bash
# Example: index.js → index-v2.js
mv frontend/public/js/index.js frontend/public/js/index-v2.js
mv frontend/public/js/dependency-manager.js frontend/public/js/dependency-manager-v2.js
```

### Step 2: Update References
```html
<!-- In index.html -->
<script src="/js/dependency-manager-v2.js"></script>
```

```javascript
// In dependency-manager-v2.js
home: [
  '/js/index-v2.js'  // Updated reference
],
```

### When to Use File Renaming
- ✅ When cache-clearing script doesn't work
- ✅ For major updates that MUST deploy immediately
- ✅ When .htaccess cache headers aren't being respected
- ❌ Not for routine updates (use cache-clearing script instead)

## Solution 4: Version Parameters (Not Reliable on cPanel)

**NOT RECOMMENDED** - Version query parameters don't bypass cPanel cache:
```html
<!-- This DOESN'T work on cPanel hosting -->
<script src="/js/index.js?v=20250101001"></script>
```

❌ **Why it fails**: Apache ignores query parameters for cache key by default

## Deployment Workflow

### Routine Updates (Small Changes)
1. Upload changed files to cPanel via FTP/File Manager
2. Visit: `https://test.eskisiniveryenisinial.com/clear-cache.php?key=eSkIsInI_CaChe_CLeaR_2025_SecReT`
3. Test changes in **Incognito/Private window**
4. If still cached: Clear cPanel tmp files (File Manager → /tmp)

### Critical Updates (Must Deploy Now)
1. Rename affected files (e.g., `index.js` → `index-v3.js`)
2. Update all references in HTML/JS files
3. Upload to cPanel
4. Run cache-clear script
5. Test in Incognito window

### Post-Deployment Testing Checklist
- [ ] Open site in Incognito/Private window (bypasses browser cache)
- [ ] Check browser console for correct file versions being loaded
- [ ] Verify no 404 errors for renamed files
- [ ] Test functionality (products loading, forms working, etc.)
- [ ] Check Network tab in DevTools for cache headers

## Troubleshooting

### Problem: Changes still not showing
**Solutions**:
1. Clear browser cache: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. Test in Incognito window
3. Check browser DevTools → Network tab for 304 (cached) responses
4. Clear cPanel tmp files via File Manager
5. Verify correct file is being loaded (check console logs)

### Problem: 404 errors after renaming files
**Cause**: Forgot to update references in HTML/JS
**Solution**: Use Grep to find all references:
```bash
grep -r "old-filename.js" frontend/public/
```

### Problem: Cache-clear script returns 403
**Causes**:
- Wrong secret key in URL
- Accessing from non-allowed IP
**Solution**: Use correct URL with secret key

### Problem: .htaccess not working
**Causes**:
- File not uploaded to correct directory
- Apache mod_headers not enabled (unlikely on cPanel)
- File permissions incorrect
**Solution**:
```bash
# Check file exists
ls -la frontend/public/.htaccess

# Check file permissions (should be 644)
chmod 644 frontend/public/.htaccess
```

## cPanel File Manager Tips

### Clear Temp Files
1. Login to cPanel
2. File Manager → Navigate to `/tmp`
3. Select all files
4. Delete

### Upload Files Without Cache
1. File Manager → Upload
2. After upload: immediately visit cache-clear URL
3. Test in Incognito window

## Browser Cache Testing

### Force Fresh Load
- **Chrome/Edge**: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- **Firefox**: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)
- **Safari**: Cmd+Option+R

### Check What's Cached
1. Open DevTools (F12)
2. Network tab
3. Reload page
4. Look for:
   - **200**: Fresh from server ✅
   - **304**: Not Modified (cached) ⚠️
   - **from disk cache**: Browser cached ⚠️

### Incognito Mode (Best Testing Method)
- **Chrome**: Ctrl+Shift+N
- **Firefox**: Ctrl+Shift+P
- **Safari**: Cmd+Shift+N
- **Edge**: Ctrl+Shift+N

## Summary

**Best Practice Workflow**:
1. Upload changes via cPanel File Manager
2. Visit cache-clear URL: `https://test.eskisiniveryenisinial.com/clear-cache.php?key=eSkIsInI_CaChe_CLeaR_2025_SecReT`
3. Test in Incognito window
4. If still cached: Clear cPanel /tmp files
5. Last resort: Rename files (index-v2.js → index-v3.js)

**Files to Remember**:
- `frontend/public/clear-cache.php` - Server cache clearing
- `frontend/public/.htaccess` - Browser cache control
- `CACHE-MANAGEMENT.md` - This guide

**Quick Commands**:
```bash
# Clear cache
curl "https://test.eskisiniveryenisinial.com/clear-cache.php?key=eSkIsInI_CaChe_CLeaR_2025_SecReT"

# Check cache headers
curl -I https://test.eskisiniveryenisinial.com/js/index-v2.js
```
