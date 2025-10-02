# CSP Eval Violation Fix

## Problem
Your site is showing CSP violations for `eval()` usage, even though your HTML files already include `'unsafe-eval'` in the CSP meta tag.

## Root Cause
The issue is likely that your **server is sending a CSP header** that overrides the HTML meta tag CSP, and the server CSP doesn't include `'unsafe-eval'`.

## Solutions

### Option 1: Fix Server CSP (Recommended)
Update your server's CSP header to include `'unsafe-eval'`:

**Current server CSP:**
```
script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com
```

**Updated server CSP:**
```
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com
```

### Option 2: Complete Production CSP Headers
Set these CSP headers on your server:

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

## Where to Update CSP

### If using Nginx:
Add to your nginx config:
```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net data:; img-src 'self' data: https: http:; connect-src 'self' https://api.eskisiniveryenisinial.com https://test.eskisiniveryenisinial.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com https://res.cloudinary.com http://localhost:3000 ws: wss:;";
```

### If using Apache:
Add to your .htaccess or apache config:
```apache
Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net data:; img-src 'self' data: https: http:; connect-src 'self' https://api.eskisiniveryenisinial.com https://test.eskisiniveryenisinial.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com https://res.cloudinary.com http://localhost:3000 ws: wss:;"
```

### If using hosting platform:
Look for "Security Headers" or "CSP" configuration in your hosting platform's dashboard and add the CSP header there.

## Why 'unsafe-eval' is needed
Several legitimate libraries use eval():
- Bootstrap (for dynamic calculations)
- Template engines
- Polyfills for older browsers
- Dynamic imports

## Testing the Fix
1. Update your server CSP configuration
2. Clear browser cache
3. Reload the page
4. Check browser console - CSP eval violations should be gone

## Alternative: Identify Specific Eval Usage
If you want to avoid `'unsafe-eval'`, you can:

1. **Check which specific libraries need eval:**
   - Open browser DevTools
   - Go to Console tab
   - Look for specific eval violation messages

2. **Replace problematic libraries:**
   - Use CSP-compliant versions
   - Load libraries locally instead of from CDN
   - Update to newer versions that don't use eval

## Security Note
Adding `'unsafe-eval'` slightly reduces security but is often necessary for modern web applications. The risk is minimal if:
- You trust your CDN sources (jsdelivr, cloudflare)
- You don't have XSS vulnerabilities
- You use other security measures (HTTPS, secure cookies, etc.)