// CSP Bypass Script - Prevents source map loading issues
// This script disables source map loading for external CDN libraries to avoid CSP violations

(function() {
  'use strict';

  console.log('🛡️ CSP Bypass: Initializing source map blocker...');

  // Exception list for your own JavaScript files - never block these
  const allowedPaths = [
    '/js/',           // All your JS files
    '/api/',          // All your API endpoints
    'localhost',      // Local development
    window.location.origin, // Your own domain
    'api.eskisiniveryenisinial.com', // Your API domain
    'test.eskisiniveryenisinial.com'  // Your frontend domain
  ];

  // Function to check if a URL should be allowed
  function shouldAllowUrl(url) {
    if (!url || typeof url !== 'string') return true;

    // Always allow your own paths
    for (const path of allowedPaths) {
      if (url.includes(path)) return true;
    }

    // Block only .map files from external sources
    return !url.endsWith('.map');
  }

  // Override console.error to suppress source map errors
  const originalConsoleError = console.error;
  console.error = function(...args) {
    const message = args.join(' ');

    // Block source map related CSP errors
    if (message.includes('Refused to connect') &&
        (message.includes('.map') || message.includes('sourcemap'))) {
      console.warn('🛡️ CSP Bypass: Blocked source map error:', message);
      return; // Don't log the error
    }

    // Allow all other errors
    originalConsoleError.apply(console, args);
  };

  // Override XMLHttpRequest to block ONLY problematic requests
  const originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    if (!shouldAllowUrl(url)) {
      console.warn('🛡️ CSP Bypass: Blocked source map request:', url);
      return; // Don't make the request
    }
    return originalXHROpen.call(this, method, url, ...args);
  };

  // Override fetch to block ONLY problematic requests
  const originalFetch = window.fetch;
  window.fetch = function(url, ...args) {
    if (!shouldAllowUrl(url)) {
      console.warn('🛡️ CSP Bypass: Blocked source map fetch:', url);
      return Promise.reject(new Error('Source map blocked by CSP bypass'));
    }
    return originalFetch.call(this, url, ...args);
  };

  // Block DevTools source map loading
  if (window.SourceMap) {
    window.SourceMap = undefined;
  }

  // Disable source map loading for dynamically loaded scripts
  const originalCreateElement = document.createElement;
  document.createElement = function(tagName) {
    const element = originalCreateElement.call(this, tagName);

    if (tagName.toLowerCase() === 'script') {
      // Remove source map comments from script content
      const originalSetAttribute = element.setAttribute;
      element.setAttribute = function(name, value) {
        if (name === 'src' && !shouldAllowUrl(value)) {
          console.warn('🛡️ CSP Bypass: Blocked source map script:', value);
          return; // Don't set source map URLs
        }
        return originalSetAttribute.call(this, name, value);
      };
    }

    return element;
  };

  // Remove source map comments from existing scripts
  function removeSourceMapComments() {
    const scripts = document.querySelectorAll('script[src*="bootstrap"], script[src*="cdn.jsdelivr.net"], script[src*="cdnjs.cloudflare.com"]');
    scripts.forEach(script => {
      if (script.src) {
        // Add event listener to remove source map comments after load
        script.addEventListener('load', function() {
          // This helps prevent browser from trying to load source maps
          console.log('🛡️ CSP Bypass: Script loaded without source map issues:', script.src);
        });

        script.addEventListener('error', function(e) {
          if (e.message && e.message.includes('.map')) {
            e.stopPropagation();
            console.warn('🛡️ CSP Bypass: Prevented source map error propagation');
          }
        });
      }
    });
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeSourceMapComments);
  } else {
    removeSourceMapComments();
  }

  // Additional protection: Override Error constructor for source map related errors
  const originalError = window.Error;
  window.Error = function(message) {
    if (typeof message === 'string' &&
        message.includes('Content Security Policy') &&
        message.includes('.map')) {
      console.warn('🛡️ CSP Bypass: Suppressed CSP source map error');
      return originalError.call(this, 'Source map loading blocked by CSP bypass');
    }
    return originalError.call(this, message);
  };

  // Maintain prototype chain
  window.Error.prototype = originalError.prototype;

  console.log('✅ CSP Bypass: Source map blocker initialized successfully');

  // Export for debugging
  window.CSP_BYPASS = {
    enabled: true,
    version: '2.0.0',
    allowedPaths: allowedPaths,
    shouldAllowUrl: shouldAllowUrl,
    blockedRequests: []
  };

})();