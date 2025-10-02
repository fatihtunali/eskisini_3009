// Shared API Configuration Utility
// This ensures all JS files use the correct API base URL
// Supports both two-server (API + Frontend) and unified server deployments

(function() {
  'use strict';

  // Fetch config from backend and detect automatically
  async function fetchConfigFromBackend() {
    try {
      const hostname = window.location.hostname;
      const port = window.location.port;
      const protocol = window.location.protocol;

      // Build backend URL based on current location
      let backendUrl;

      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        // Development mode detection
        if (port === '5500') {
          // BrowserSync serving frontend, API on 3000
          backendUrl = 'http://localhost:3000';
        } else {
          // Unified server or direct access
          backendUrl = `${protocol}//${hostname}:${port || 3000}`;
        }
      } else if (hostname === 'test.eskisiniveryenisinial.com') {
        // Two-server production setup
        backendUrl = 'https://api.eskisiniveryenisinial.com';
      } else {
        // Unified server deployment (cPanel/single domain)
        // API is on the same domain
        backendUrl = `${protocol}//${hostname}${port ? ':' + port : ''}`;
      }

      // Try to fetch config from backend
      const response = await fetch(`${backendUrl}/api/config`, {
        method: 'GET',
        credentials: 'include'
      });

      if (response.ok) {
        const config = await response.json();
        console.log('🔧 API Config: Fetched from backend:', config);

        // If server returns apiBase, use it; otherwise use backendUrl
        return config.apiBase || backendUrl;
      }
    } catch (err) {
      console.warn('⚠️ API Config: Could not fetch from backend, using fallback', err.message);
    }

    // Fallback to detection
    return getCorrectApiBaseFallback();
  }

  // Get correct API base with fallback detection
  function getCorrectApiBaseFallback() {
    const hostname = window.location.hostname;
    const port = window.location.port;
    const protocol = window.location.protocol;

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // Development: Check if BrowserSync (5500) or unified server
      if (port === '5500') {
        return 'http://localhost:3000'; // BrowserSync → API on 3000
      }
      return `${protocol}//${hostname}:${port || 3000}`; // Unified server
    } else if (hostname === 'test.eskisiniveryenisinial.com') {
      // Two-server production
      return 'https://api.eskisiniveryenisinial.com';
    } else {
      // Unified server (cPanel) - same domain as frontend
      if (window.APP && window.APP.API_BASE) {
        return window.APP.API_BASE;
      }
      // Same domain as current page
      return `${protocol}//${hostname}${port ? ':' + port : ''}`;
    }
  }

  // Synchronous version for immediate use
  function getCorrectApiBase() {
    return window.GLOBAL_API_BASE || getCorrectApiBaseFallback();
  }

  // Initialize async
  (async function init() {
    const apiBase = await fetchConfigFromBackend();
    window.GLOBAL_API_BASE = apiBase;
    console.log('🔧 API Config: Global API_BASE set to:', window.GLOBAL_API_BASE);
  })();

  // Make globally available
  window.getCorrectApiBase = getCorrectApiBase;

  // Set initial fallback
  window.GLOBAL_API_BASE = getCorrectApiBaseFallback();

})();