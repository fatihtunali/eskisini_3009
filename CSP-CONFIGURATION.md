# Content Security Policy (CSP) Configuration

## Overview

Content Security Policy (CSP) is implemented on both the API and frontend servers to prevent XSS attacks and unauthorized code execution.

## ⚠️ Important: CSP Eval Fix

The application **requires `'unsafe-eval'`** in the CSP policy because:
- Bootstrap 5 uses `eval()` for dynamic calculations
- Some third-party libraries (Chart.js, etc.) need eval
- Template rendering in certain components

Without `'unsafe-eval'`, you'll see console errors like:
```
Refused to evaluate a string as JavaScript because 'unsafe-eval' is not an allowed source of script
```

## Current CSP Policy

Both servers use the same CSP policy:

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://static.cloudflareinsights.com;
style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net data:;
img-src 'self' data: https: http:;
connect-src 'self' https://api.eskisiniveryenisinial.com https://test.eskisiniveryenisinial.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com https://res.cloudinary.com http://localhost:3000 http://localhost:5500 ws: wss: blob:;
object-src 'none';
base-uri 'self';
frame-ancestors 'none';
form-action 'self';
```

## Implementation

### API Server ([server.js](server.js))

CSP is implemented via middleware:

```javascript
const { cspMiddleware } = require('./backend/mw/csp.js');

app.use(cspMiddleware);
```

**File**: [backend/mw/csp.js](backend/mw/csp.js)

### Frontend Server ([server-frontend.js](server-frontend.js))

CSP is applied to all responses via `baseHeaders`:

```javascript
const baseHeaders = {
  'Content-Security-Policy': CSP_POLICY,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};
```

## Policy Breakdown

### `default-src 'self'`
Base policy: only allow resources from same origin

### `script-src`
- `'self'` - Allow scripts from same origin
- `'unsafe-inline'` - Allow inline `<script>` tags (needed for Bootstrap)
- `'unsafe-eval'` - **Allow eval()** (needed for Bootstrap, Chart.js)
- CDN sources: jsdelivr, cloudflare, cloudflareinsights

### `style-src`
- `'self'` - Same origin CSS
- `'unsafe-inline'` - Inline styles (Bootstrap utilities)
- CDN sources: jsdelivr, cloudflare, Google Fonts

### `font-src`
- `'self'` - Same origin fonts
- `data:` - Data URI fonts
- CDN sources: Google Fonts, jsdelivr, cloudflare

### `img-src`
- `'self'` - Same origin images
- `data:` - Data URI images
- `https:` `http:` - Any HTTPS/HTTP image source (for Cloudinary, external images)

### `connect-src`
- `'self'` - Same origin AJAX/fetch
- Production domains: api.eskisiniveryenisinial.com, test.eskisiniveryenisinial.com
- Cloudinary: res.cloudinary.com
- Local dev: localhost:3000, localhost:5500
- WebSocket: `ws:` `wss:`
- Blob URLs: `blob:`

### `object-src 'none'`
Block all `<object>`, `<embed>`, `<applet>` tags

### `base-uri 'self'`
Only allow same-origin `<base>` tags

### `frame-ancestors 'none'`
Prevent embedding in iframes (clickjacking protection)

### `form-action 'self'`
Forms can only submit to same origin

## Removing HTML Meta Tags

**IMPORTANT**: CSP should **ONLY** be set by the server, not in HTML meta tags.

If you have CSP meta tags in your HTML files (like `index.html`), **remove them**:

```html
<!-- REMOVE THIS: -->
<meta http-equiv="Content-Security-Policy" content="...">
```

Server headers always override HTML meta tags, so keeping both creates confusion.

## Testing CSP

### Check if CSP is Working

1. Open browser DevTools (F12)
2. Go to Network tab
3. Reload page
4. Click on the HTML document
5. Check Response Headers for `Content-Security-Policy`

### Verify No Violations

1. Open Console tab
2. Look for CSP violation errors
3. Should see no errors related to `eval()` or scripts being blocked

### Common CSP Violations

If you see violations, check:

1. **Inline scripts without nonce** - Use `'unsafe-inline'` or add nonces
2. **Eval errors** - Ensure `'unsafe-eval'` is present
3. **External resources blocked** - Add domain to appropriate directive
4. **WebSocket connections blocked** - Add `ws:` `wss:` to `connect-src`

## Security Considerations

### Why `'unsafe-eval'` is Acceptable

While `'unsafe-eval'` reduces security slightly, it's acceptable because:

1. **Trusted dependencies** - We only use eval from well-known libraries (Bootstrap, Chart.js)
2. **No user input in eval** - We don't eval user-provided strings
3. **Other security layers** - We have XSS protection, input validation, authentication
4. **Modern libraries need it** - Many popular libraries require eval for legitimate purposes
5. **Development velocity** - Without it, we'd need to fork and patch multiple libraries

### Security Best Practices Still Applied

- ✅ No inline event handlers (`onclick=`, etc.)
- ✅ No user input directly into HTML
- ✅ CSRF tokens for state-changing operations
- ✅ HTTPOnly cookies for authentication
- ✅ Input validation on server and client
- ✅ SQL injection protection (parameterized queries)
- ✅ Rate limiting on API endpoints
- ✅ HTTPS in production

## Modifying CSP

### Adding a New CDN

If you need to add a new CDN (e.g., `unpkg.com`):

1. **For scripts**: Add to `script-src` in both [backend/mw/csp.js](backend/mw/csp.js) and [server-frontend.js](server-frontend.js)
2. **For styles**: Add to `style-src`
3. **For fonts**: Add to `font-src`
4. Restart servers

Example:
```javascript
"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com"
```

### Adding a New API Domain

If you add a new API endpoint:

1. Add domain to `connect-src` in CSP
2. Add to `CORS_ORIGIN` in `.env`

### Removing `'unsafe-eval'` (Not Recommended)

If you want to remove `'unsafe-eval'`, you'll need to:

1. Replace Bootstrap with CSP-compliant alternative
2. Replace or patch Chart.js
3. Review all third-party libraries for eval usage
4. Test thoroughly

This is **not recommended** as it will break functionality.

## Production Deployment

### Nginx

If using Nginx as reverse proxy, **don't set CSP headers in Nginx config**.
Let the Node.js servers handle CSP.

If you must set it in Nginx:
```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; ...";
```

### Apache

Similarly, **don't duplicate CSP in Apache config**.

If you must:
```apache
Header always set Content-Security-Policy "default-src 'self'; ..."
```

### Best Practice

Let the application servers ([server.js](server.js) and [server-frontend.js](server-frontend.js)) handle CSP headers.
This keeps configuration in one place and reduces duplication.

## Troubleshooting

### "Refused to evaluate a string as JavaScript"

**Solution**: `'unsafe-eval'` is missing from `script-src`
- Check [backend/mw/csp.js](backend/mw/csp.js) line 16
- Check [server-frontend.js](server-frontend.js) line 92

### "Refused to load script from CDN"

**Solution**: Add CDN domain to `script-src`

### "Refused to connect to API"

**Solution**: Add API domain to `connect-src`

### "Refused to load font"

**Solution**: Add font source to `font-src` (usually `data:` or Google Fonts domain)

### CSP still blocks despite correct config

**Solutions**:
1. **Remove CSP meta tags from HTML** - Server headers take precedence but can cause confusion
2. **Clear browser cache** - Old cached CSP might still apply
3. **Hard refresh** - Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
4. **Check server is using updated code** - Restart Node.js servers

## Monitoring CSP Violations

### Browser Console
Open DevTools Console to see CSP violations in real-time during development.

### Report-To Header (Future Enhancement)
Can add CSP reporting endpoint:

```javascript
"report-uri /api/csp-violations; report-to csp-endpoint"
```

Then log violations to track issues in production.

## Related Files

- [backend/mw/csp.js](backend/mw/csp.js) - CSP middleware for API server
- [server.js](server.js) - API server with CSP
- [server-frontend.js](server-frontend.js) - Frontend server with CSP
- [CSP-EVAL-FIX.md](CSP-EVAL-FIX.md) - Original eval fix documentation

## References

- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/) - Test your CSP policy
- [Bootstrap and CSP](https://getbootstrap.com/docs/5.3/getting-started/introduction/#csp-and-unsafe-inline)

---

**Last Updated**: 2025-09-30