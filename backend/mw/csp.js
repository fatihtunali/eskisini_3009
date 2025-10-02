// backend/mw/csp.js - Content Security Policy middleware
// Sets CSP headers for the application

/**
 * CSP Middleware
 *
 * Sets Content-Security-Policy headers to allow necessary resources
 * while maintaining security.
 *
 * Includes 'unsafe-eval' for Bootstrap and other libraries that need it.
 */
function cspMiddleware(req, res, next) {
  // Only set CSP for HTML responses
  // API endpoints don't need CSP headers
  if (req.path.startsWith('/api/')) {
    return next();
  }

  // Production-ready CSP policy
  const cspPolicy = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net data:",
    "img-src 'self' data: https: http:",
    "connect-src 'self' https://api.eskisiniveryenisinial.com https://test.eskisiniveryenisinial.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com https://res.cloudinary.com http://localhost:3000 http://localhost:5500 ws: wss: blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'"
  ].join('; ');

  res.setHeader('Content-Security-Policy', cspPolicy);

  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  next();
}

module.exports = { cspMiddleware };