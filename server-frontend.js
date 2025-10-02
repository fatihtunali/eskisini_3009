// server-frontend.js - Production Frontend Server (test.eskisiniveryenisinial.com)
// This file serves static files and proxies /api requests to the API server
console.log('[BOOT] Frontend server starting…');

// Load configuration
const config = require('./backend/config.js');
const http = require('http');
const httpProxy = require('http-proxy');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

// Configuration
const HOST = config.FRONTEND_HOST;
const PORT = config.FRONTEND_PORT;
const API_TARGET = config.API_TARGET;
const root = path.join(__dirname, 'frontend', 'public');

console.log('[CONFIG] Frontend root:', root);
console.log('[CONFIG] API proxy target:', API_TARGET);

// Create proxy for /api requests
const proxy = httpProxy.createProxyServer({
  target: API_TARGET,
  changeOrigin: true,
  xfwd: true,
  proxyTimeout: 30_000,
  timeout: 30_000,
});

// Handle proxy errors
proxy.on('error', (err, req, res) => {
  console.error('[PROXY ERROR]', err.message);
  if (!res.headersSent) {
    res.writeHead(502, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    });
  }
  res.end('API proxy error');
});

// MIME types
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm'
};

// Utility functions
const resType = (p) => MIME[path.extname(p).toLowerCase()] || 'application/octet-stream';

const isUnderRoot = (p) => {
  const full = path.resolve(p);
  const base = path.resolve(root);
  return full === base || full.startsWith(base + path.sep);
};

const etagFor = (st) =>
  `"${crypto.createHash('sha1').update(`${st.ino || ''}-${st.size}-${st.mtimeMs}`).digest('hex')}"`;

const isLongCache = (p) =>
  p.includes(`${path.sep}assets${path.sep}`) ||
  /\.(css|js|woff2?|png|jpe?g|gif|webp|svg|ico|map)$/i.test(p);

const cacheControl = (p) => {
  // HTML files - no cache
  if (p.endsWith('.html')) return 'no-cache';

  // JS files - no cache (always fetch fresh during development/updates)
  if (p.endsWith('.js') || p.endsWith('.mjs')) return 'no-cache, no-store, must-revalidate';

  // CSS files - short cache (5 minutes)
  if (p.endsWith('.css')) return 'public, max-age=300';

  // Assets (images, fonts) in /assets folder - long cache (1 year)
  if (p.includes(`${path.sep}assets${path.sep}`)) return 'public, max-age=31536000, immutable';

  // Other static files (images, fonts outside assets) - 1 day cache
  if (isLongCache(p)) return 'public, max-age=86400';

  // Default - no cache
  return 'no-cache';
};

// CSP policy for frontend
const CSP_POLICY = [
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

// Security headers
const baseHeaders = {
  'Content-Security-Policy': CSP_POLICY,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

// Check if content type is compressible
const isCompressible = (ctype) =>
  /^(text\/|application\/(javascript|json|xml|wasm))/.test(ctype);

// Try to use precompressed files (.br or .gz)
async function tryPrecompressed(filePath, acceptEncoding) {
  // Prefer .br, fallback to .gz
  if (/\bbr\b/.test(acceptEncoding)) {
    try {
      const p = filePath + '.br';
      const st = await fs.promises.stat(p);
      return { path: p, encoding: 'br', stats: st };
    } catch { }
  }
  if (/\bgzip\b/.test(acceptEncoding)) {
    try {
      const p = filePath + '.gz';
      const st = await fs.promises.stat(p);
      return { path: p, encoding: 'gzip', stats: st };
    } catch { }
  }
  return null;
}

function send304(res, etag, p) {
  res.writeHead(304, {
    'ETag': etag,
    'Cache-Control': cacheControl(p),
    ...baseHeaders,
  });
  res.end();
}

function send500(res, msg = 'server error') {
  if (!res.headersSent) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', ...baseHeaders });
  }
  res.end(msg);
}

function send404(res, msg = 'not found') {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...baseHeaders });
  res.end(msg);
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  // Handle OPTIONS for CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      ...baseHeaders,
    });
    return res.end();
  }

  // Proxy /api requests to backend
  if (req.url.startsWith('/api/') || req.url.startsWith('/ws/')) {
    return proxy.web(req, res);
  }

  try {
    // Parse URL
    const urlObj = new URL(req.url, `http://${HOST}:${PORT}`);
    let pathname = decodeURIComponent(urlObj.pathname);

    // Root → index.html
    if (pathname === '/') pathname = '/index.html';

    // Resolve file path
    let filePath = path.join(root, pathname);
    let stats;

    try {
      stats = await fs.promises.stat(filePath);
      // If directory, try index.html
      if (stats.isDirectory()) {
        filePath = path.join(filePath, 'index.html');
        stats = await fs.promises.stat(filePath);
      }
    } catch {
      return send404(res);
    }

    // Security check: ensure file is under root
    if (!isUnderRoot(filePath)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8', ...baseHeaders });
      return res.end('forbidden');
    }

    // Determine content type and cache strategy
    const type = resType(filePath);
    const longCache = cacheControl(filePath);

    // Generate ETag
    const etag = etagFor(stats);
    if (req.headers['if-none-match'] === etag) {
      return send304(res, etag, filePath);
    }

    // Handle HEAD request
    if (req.method === 'HEAD') {
      res.writeHead(200, {
        'Content-Type': type,
        'Content-Length': stats.size,
        'ETag': etag,
        'Cache-Control': longCache,
        ...baseHeaders,
      });
      return res.end();
    }

    // Try precompressed files
    const acceptEncoding = req.headers['accept-encoding'] || '';
    let useCompressed = null;
    if (isCompressible(type)) {
      useCompressed = await tryPrecompressed(filePath, acceptEncoding);
    }

    // Prepare response headers
    let streamPath = filePath;
    let headers = {
      'Content-Type': type,
      'ETag': etag,
      'Cache-Control': longCache,
      ...baseHeaders,
    };

    // Serve precompressed file
    if (useCompressed) {
      headers['Content-Encoding'] = useCompressed.encoding;
      headers['Vary'] = 'Accept-Encoding';
      headers['Content-Length'] = useCompressed.stats.size;
      streamPath = useCompressed.path;

      const stream = fs.createReadStream(streamPath);
      res.writeHead(200, headers);
      stream.pipe(res);
      stream.on('error', () => send500(res));
      return;
    }

    // Dynamic compression for text content
    const canZip = isCompressible(type);
    const wantsBr = canZip && /\bbr\b/.test(acceptEncoding);
    const wantsGz = canZip && /\bgzip\b/.test(acceptEncoding);

    const raw = fs.createReadStream(streamPath);

    if (wantsBr) {
      headers['Content-Encoding'] = 'br';
      headers['Vary'] = 'Accept-Encoding';
      res.writeHead(200, headers);
      raw.pipe(zlib.createBrotliCompress()).pipe(res);
    } else if (wantsGz) {
      headers['Content-Encoding'] = 'gzip';
      headers['Vary'] = 'Accept-Encoding';
      res.writeHead(200, headers);
      raw.pipe(zlib.createGzip({ level: zlib.constants.Z_BEST_SPEED })).pipe(res);
    } else {
      headers['Content-Length'] = stats.size;
      res.writeHead(200, headers);
      raw.pipe(res);
    }

    raw.on('error', () => send500(res));
  } catch (e) {
    console.error('[ERROR]', e);
    send500(res);
  }
});

// Handle WebSocket upgrade for /api
server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/api/') || req.url.startsWith('/ws/')) {
    proxy.ws(req, socket, head);
  } else {
    socket.destroy();
  }
});

// Start server
server.listen(PORT, HOST, () => {
  console.log(`[FRONTEND] Server listening on http://${HOST}:${PORT}`);
  console.log(`[FRONTEND] Serving files from: ${root}`);
  console.log(`[FRONTEND] Proxying /api to: ${API_TARGET}`);
  console.log('[FRONTEND] Ready to accept connections');
});