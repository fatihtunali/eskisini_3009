// Dependency Manager - Smart JavaScript loader
(function() {
  'use strict';

  // Page-specific script configurations
  const PAGE_SCRIPTS = {
    // Core scripts needed by all pages - order matters!
    core: [
      '/js/api-config.js',  // For API base URL configuration - MUST BE FIRST
      '/js/partials.js',    // For data-include functionality
      '/js/validation.js',  // For form validation
      '/js/header-v3.js'    // For header functionality (v3 - bypasses cache)
    ],

    // Auth pages (login, register) - ensure auth.js waits for full initialization
    auth: [
      '/js/auth.js'
    ],

    // Home page
    home: [
      '/js/cities-tr.js',
      '/js/components/product-card-v2.js',
      '/js/cookie-consent.js',
      '/js/notifications.js', // After header.js is loaded
      '/js/cart.js',          // For add to cart functionality
      '/js/index-v2.js'       // RENAMED FILE TO BYPASS CACHE
    ],

    // Profile pages
    profile: [
      '/js/components/product-card-v2.js', // For unified product card rendering
      '/js/notifications.js', // After header.js is loaded
      '/js/sales-tab.js',     // For sales tab functionality
      '/js/profile.js'
    ],

    // Selling/listing pages
    sell: [
      '/js/cities-tr.js',      // Turkish cities data for location
      '/js/sell.js',
      '/js/validation.js'
    ],

    // Cart page
    cart: [
      '/js/notifications.js',
      '/js/cart.js'
    ],

    // Checkout page
    checkout: [
      '/js/api-config.js',
      '/js/notifications.js',
      '/js/cart.js',
      '/js/pages/checkout.js'
    ],

    // Order success page
    'order-success': [
      '/js/api-config.js',
      '/js/notifications.js',
      '/js/pages/order-success.js'
    ],

    // Admin pages
    admin: [
      '/js/api-config.js?v=9',
      '/js/notifications.js?v=9',
      '/js/admin-panel.js?v=9'
    ],

    // Messaging
    messages: [
      '/js/notifications.js', // After header.js is loaded
      '/js/messages.js'
    ],

    // Thread (individual conversation)
    thread: [
      '/js/notifications.js',
      '/js/thread.js'
    ],

    // Search pages
    search: [
      '/js/cities-tr.js',      // Turkish cities data for city filter
      '/js/components/product-card-v2.js',
      '/js/cart.js',          // For add to cart functionality
      '/js/advanced-search.js' // Advanced search with filters, pagination, suggestions
    ],

    // Category page
    category: [
      '/js/components/product-card-v2.js',
      '/js/notifications.js', // After header.js is loaded
      '/js/cart.js',          // For add to cart functionality
      '/js/category-page.js'
    ],

    // Favorites page
    favorites: [
      '/js/components/product-card-v2.js',
      '/js/notifications.js', // After header.js is loaded
      '/js/cart.js',          // For add to cart functionality
      '/js/fav.js'
    ],

    // Listing detail page
    listing: [
      '/js/components/product-card-v2.js',
      '/js/notifications.js',
      '/js/cart.js',
      '/js/pages/listing.js'
    ],

    // Seller profile page
    'seller-profile': [
      '/js/api-config.js',
      '/js/components/product-card-v2.js',
      '/js/notifications.js',
      '/js/cart.js',
      '/js/pages/seller-profile.js'
    ],

    // Shop settings page
    'shop-settings': [
      '/js/cities-tr.js',      // Turkish cities data for shop location
      '/js/api-config.js',
      '/js/notifications.js'
    ]
  };

  // Detect current page
  function detectPageType() {
    const path = window.location.pathname;
    const filename = path.split('/').pop().replace('.html', '') || 'index';

    // Map filenames to page types
    const pageMap = {
      'index': 'home',
      'login': 'auth',
      'register': 'auth',
      'admin-login': 'auth',
      'profile': 'profile',
      'sell': 'sell',
      'cart': 'cart',
      'checkout': 'checkout',
      'order-success': 'order-success',
      'admin': 'admin',
      'admin-panel': 'admin',
      'messages': 'messages',
      'thread': 'thread',
      'search': 'search',
      'category': 'category',
      'favorites': 'favorites',
      'listing': 'listing',
      'seller-profile': 'seller-profile'
    };

    return pageMap[filename] || 'default';
  }

  // Critical scripts that must load for the site to function
  const CRITICAL_SCRIPTS = [
    '/js/partials.js',
    '/js/validation.js'
  ];

  // Cache-busting version
  const VERSION = Date.now();

  // Load script with promise
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      // Add cache-busting version to src
      const separator = src.includes('?') ? '&' : '?';
      const versionedSrc = `${src}${separator}v=${VERSION}`;

      // Check if script already exists (check base src without version)
      const existingScript = Array.from(document.querySelectorAll('script')).find(s =>
        s.src && s.src.includes(src.split('?')[0])
      );

      if (existingScript) {
        console.log(`📦 Script already loaded: ${src}`);
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = versionedSrc;
      script.onload = () => {
        console.log(`✅ Loaded: ${src}`);
        resolve();
      };
      script.onerror = () => {
        const isCritical = CRITICAL_SCRIPTS.includes(src);
        if (isCritical) {
          console.error(`🚨 CRITICAL SCRIPT FAILED: ${src}`);
          reject(new Error(`Critical script failed to load: ${src}`));
        } else {
          console.warn(`❌ Failed to load non-critical script: ${src}`);
          resolve(); // Continue for non-critical scripts
        }
      };
      document.head.appendChild(script);
    });
  }

  // Load multiple scripts in sequence
  async function loadScripts(scripts) {
    for (const script of scripts) {
      try {
        await loadScript(script);
      } catch (error) {
        console.warn(`⚠️ Continuing despite error loading: ${script}`);
      }
    }
  }

  // Main dependency manager
  window.DependencyManager = {
    loadPageScripts: async function(page) {
      const pageType = page || detectPageType();
      console.log(`📦 Loading scripts for page type: ${pageType}`);

      // Load core scripts first
      await loadScripts(PAGE_SCRIPTS.core);

      // Load page-specific scripts
      if (PAGE_SCRIPTS[pageType]) {
        await loadScripts(PAGE_SCRIPTS[pageType]);
      }

      console.log(`✅ All scripts loaded for page: ${pageType}`);
      return pageType;
    },

    loadScript: loadScript,

    getPageType: detectPageType
  };

  // Auto-initialize when DOM is ready
  function initialize() {
    const pageType = detectPageType();
    console.log(`🚀 Dependency Manager initializing for: ${pageType}`);

    // Load page scripts
    DependencyManager.loadPageScripts()
      .then(async () => {
        // Load partials (header/footer HTML)
        if (typeof includePartials === 'function') {
          console.log('🔧 Loading partials (header/footer)...');
          await includePartials();
        }

        // Mark dependencies as loaded
        window.dependenciesLoadedTriggered = true;

        // Dispatch the event that other scripts are waiting for
        document.dispatchEvent(new CustomEvent('dependenciesLoaded', {
          detail: { pageType }
        }));

        console.log(`✅ Dependencies loaded for ${pageType} page`);
      })
      .catch(error => {
        console.error('❌ Error loading dependencies:', error);

        // Check if this was a critical script failure
        const isCriticalFailure = error.message && error.message.includes('Critical script failed');

        if (isCriticalFailure) {
          // Show user-friendly error message for critical failures
          showCriticalLoadingError(error.message);

          // Still dispatch event but mark as critical error
          window.dependenciesLoadedTriggered = true;
          document.dispatchEvent(new CustomEvent('dependenciesLoaded', {
            detail: { pageType, error: true, critical: true }
          }));
        } else {
          // Non-critical error - continue normally
          window.dependenciesLoadedTriggered = true;
          document.dispatchEvent(new CustomEvent('dependenciesLoaded', {
            detail: { pageType, error: true, critical: false }
          }));
        }
      });
  }

  // Show critical loading error to user
  function showCriticalLoadingError(errorMessage) {
    const errorHtml = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #dc3545;
        color: white;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <div style="text-align: center; max-width: 600px; padding: 2rem;">
          <h1 style="font-size: 2rem; margin-bottom: 1rem;">🚨 Website Loading Failed</h1>
          <p style="font-size: 1.2rem; margin-bottom: 1rem;">
            Critical website components could not be loaded.
          </p>
          <div style="background: rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px; margin-bottom: 2rem;">
            <p style="margin: 0; font-size: 0.9rem; font-family: monospace;">${errorMessage}</p>
          </div>
          <div style="background: rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px; margin-bottom: 2rem;">
            <p style="margin: 0;">Possible causes:</p>
            <ul style="margin: 0.5rem 0; text-align: left;">
              <li>Network connectivity issues</li>
              <li>Server maintenance</li>
              <li>Browser security settings</li>
              <li>Ad blocker interference</li>
            </ul>
          </div>
          <button onclick="window.location.reload()" style="
            background: white;
            color: #dc3545;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 1rem;
            font-weight: bold;
            cursor: pointer;
            margin-right: 1rem;
          ">🔄 Reload Page</button>
          <button onclick="this.parentElement.parentElement.remove()" style="
            background: transparent;
            color: white;
            border: 2px solid white;
            padding: 10px 24px;
            border-radius: 6px;
            font-size: 1rem;
            cursor: pointer;
          ">Try Anyway</button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', errorHtml);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  console.log('🛡️ Smart Dependency Manager loaded');
})();