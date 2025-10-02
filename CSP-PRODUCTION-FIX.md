# CSP Production Fix

## Problem
Your production server has a restrictive CSP that blocks Bootstrap source maps from `cdn.jsdelivr.net`.

**Error:**
```
Refused to connect to 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js.map'
because it violates the following Content Security Policy directive:
"connect-src 'self' https://api.eskisiniveryenisinial.com https://test.eskisiniveryenisinial.com http://localhost:3000 ws: wss:"
```

## Solutions

### Solution 1: Update Server CSP (Recommended)
Update your server's CSP configuration to include CDN domains:

**Current:**
```
connect-src 'self' https://api.eskisiniveryenisinial.com https://test.eskisiniveryenisinial.com http://localhost:3000 ws: wss:
```

**Updated:**
```
connect-src 'self' https://api.eskisiniveryenisinial.com https://test.eskisiniveryenisinial.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com http://localhost:3000 ws: wss:
```

### Solution 2: Full Production CSP
Replace your entire production CSP with this optimized version:

```
Content-Security-Policy: default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://static.cloudflareinsights.com;
style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net data:;
img-src 'self' data: https: http:;
connect-src 'self' https://api.eskisiniveryenisinial.com https://test.eskisiniveryenisinial.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com https://res.cloudinary.com http://localhost:3000 ws: wss:;
```

### Solution 3: Disable Source Maps (Quick Fix)
If you can't update CSP, use minified versions without source maps:

Replace in your HTML files:
```html
<!-- Instead of: -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>

<!-- Use this specific version without source map: -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js" crossorigin="anonymous"></script>
```

## Where to Apply CSP Changes

### Option A: Server Configuration
If you control your web server (Apache/Nginx), add CSP headers there.

### Option B: Hosting Platform
Most hosting platforms have CSP configuration in their dashboard.

### Option C: Update HTML Files (Not Recommended for Production)
Only as a last resort, you could update all HTML files, but server-level CSP is better.

## Recommended Production CSP

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval'
    https://cdn.jsdelivr.net
    https://cdnjs.cloudflare.com
    https://static.cloudflareinsights.com;
  style-src 'self' 'unsafe-inline'
    https://cdn.jsdelivr.net
    https://cdnjs.cloudflare.com
    https://fonts.googleapis.com;
  font-src 'self'
    https://fonts.gstatic.com
    https://cdnjs.cloudflare.com
    https://cdn.jsdelivr.net
    data:;
  img-src 'self' data: https: http:;
  connect-src 'self'
    https://api.eskisiniveryenisinial.com
    https://test.eskisiniveryenisinial.com
    https://cdn.jsdelivr.net
    https://cdnjs.cloudflare.com
    https://fonts.googleapis.com
    https://res.cloudinary.com
    http://localhost:3000
    ws: wss:;
```

## Testing
After updating CSP, test these:
1. ✅ Bootstrap loads without errors
2. ✅ Fonts load from Google Fonts
3. ✅ Images load from Cloudinary
4. ✅ API calls work to your backend
5. ✅ No CSP violations in browser console