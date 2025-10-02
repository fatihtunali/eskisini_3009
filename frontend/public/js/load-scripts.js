/**
 * Universal Script Loader for muvhost.com
 * Solves aggressive caching by using timestamp-based versioning
 *
 * Usage: Just include this ONE file in your HTML:
 * <script src="/js/load-scripts.js"></script>
 *
 * It will automatically load all required scripts with cache-busting
 */

(function() {
  'use strict';

  // DEPLOYMENT VERSION - Update this number when deploying changes
  const VERSION = Date.now(); // Uses current timestamp for absolute cache busting

  console.log('📦 Script Loader: Version', VERSION);

  // Script loading helper
  function loadScript(src, onload) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');

      // Add version to bypass cache
      const separator = src.includes('?') ? '&' : '?';
      script.src = src + separator + 'v=' + VERSION;

      script.onload = () => {
        console.log('✅ Loaded:', src);
        if (onload) onload();
        resolve();
      };

      script.onerror = () => {
        console.error('❌ Failed to load:', src);
        reject(new Error('Failed to load: ' + src));
      };

      document.head.appendChild(script);
    });
  }

  // Load scripts in sequence
  async function loadAllScripts() {
    try {
      console.log('🚀 Loading core scripts...');

      // 1. Core loader (sets up API_BASE)
      await loadScript('/js/core-loader.js');

      // 2. Partials (loads header/footer HTML)
      await loadScript('/js/partials.js');

      // 3. Validation
      await loadScript('/js/validation.js');

      // 4. Header logic (with bootHeader)
      await loadScript('/js/header-v3.js');

      // 5. Detect page type and load page-specific scripts
      const pageType = detectPageType();
      console.log('📄 Page type:', pageType);

      await loadPageScripts(pageType);

      // 6. Initialize partials (load header/footer HTML)
      if (typeof includePartials === 'function') {
        console.log('🔧 Loading partials (header/footer)...');
        await includePartials();
      }

      console.log('✅ All scripts loaded successfully!');

      // Dispatch event for other scripts
      document.dispatchEvent(new CustomEvent('scriptsLoaded', {
        detail: { pageType, version: VERSION }
      }));

    } catch (error) {
      console.error('❌ Script loading failed:', error);
      alert('⚠️ Sayfa yüklenirken hata oluştu. Lütfen sayfayı yenileyin.');
    }
  }

  // Detect page type from URL
  function detectPageType() {
    const path = window.location.pathname;
    const filename = path.split('/').pop().replace('.html', '') || 'index';

    const pageMap = {
      'index': 'home',
      'login': 'auth',
      'register': 'auth',
      'profile': 'profile',
      'sell': 'sell',
      'cart': 'cart',
      'checkout': 'checkout',
      'search': 'search',
      'category': 'category',
      'favorites': 'favorites',
      'listing': 'listing',
      'seller-profile': 'seller-profile',
      'messages': 'messages',
      'thread': 'thread',
      'admin': 'admin'
    };

    return pageMap[filename] || 'default';
  }

  // Load page-specific scripts
  async function loadPageScripts(pageType) {
    const pageScripts = {
      home: [
        '/js/cities-tr.js',
        '/js/components/product-card-v2.js',
        '/js/cookie-consent.js',
        '/js/notifications.js',
        '/js/cart.js',
        '/js/index-v2.js'
      ],
      auth: [
        '/js/auth.js'
      ],
      profile: [
        '/js/components/product-card-v2.js',
        '/js/notifications.js',
        '/js/sales-tab.js',
        '/js/profile.js'
      ],
      sell: [
        '/js/cities-tr.js',
        '/js/sell.js'
      ],
      cart: [
        '/js/notifications.js',
        '/js/cart.js'
      ],
      checkout: [
        '/js/api-config.js',
        '/js/notifications.js',
        '/js/cart.js',
        '/js/pages/checkout.js'
      ],
      search: [
        '/js/cities-tr.js',
        '/js/components/product-card-v2.js',
        '/js/cart.js',
        '/js/advanced-search.js'
      ],
      category: [
        '/js/components/product-card-v2.js',
        '/js/notifications.js',
        '/js/cart.js',
        '/js/category-page.js'
      ],
      favorites: [
        '/js/components/product-card-v2.js',
        '/js/notifications.js',
        '/js/cart.js',
        '/js/fav.js'
      ],
      listing: [
        '/js/components/product-card-v2.js',
        '/js/notifications.js',
        '/js/cart.js',
        '/js/pages/listing.js'
      ],
      'seller-profile': [
        '/js/api-config.js',
        '/js/components/product-card-v2.js',
        '/js/notifications.js',
        '/js/cart.js',
        '/js/pages/seller-profile.js'
      ],
      messages: [
        '/js/notifications.js',
        '/js/messages.js'
      ],
      thread: [
        '/js/notifications.js',
        '/js/thread.js'
      ],
      admin: [
        '/js/api-config.js',
        '/js/notifications.js',
        '/js/admin-panel.js'
      ]
    };

    const scripts = pageScripts[pageType] || [];

    for (const script of scripts) {
      await loadScript(script);
    }
  }

  // Start loading when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAllScripts);
  } else {
    loadAllScripts();
  }

})();
