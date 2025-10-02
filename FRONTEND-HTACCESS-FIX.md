# Frontend .htaccess Fix for JavaScript Loading Issues

## Problem
JavaScript files are not loading on the frontend server.

## Solution
Add this to your frontend server's .htaccess file:

```apache
# Ensure JavaScript files are served with correct MIME type
AddType application/javascript .js
AddType application/javascript .mjs

# Enable GZIP compression for JS files
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE text/javascript
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE text/html
</IfModule>

# Cache control for JS files
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType application/javascript "access plus 1 week"
    ExpiresByType text/css "access plus 1 week"
</IfModule>

# Ensure CSP allows your own JS files
Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net data:; img-src 'self' data: https: http:; connect-src 'self' https://api.eskisiniveryenisinial.com https://test.eskisiniveryenisinial.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com https://res.cloudinary.com http://localhost:3000 ws: wss:;"

# Allow direct access to JS files
<Files "*.js">
    Order allow,deny
    Allow from all
</Files>

# Default document
DirectoryIndex index.html index.htm
```

## Alternative: Remove CSP from HTML temporarily

If the above doesn't work, temporarily remove the CSP meta tag from your HTML files:

Remove this line from index.html:
```html
<meta http-equiv="Content-Security-Policy" content="...">
```

This will help identify if CSP is the issue.