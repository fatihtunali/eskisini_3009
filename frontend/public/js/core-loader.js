// Core Loader - Resilient JavaScript Loading System
// Ensures the site works even if some JS files fail to load

(function() {
  'use strict';

  // Core configuration - fallback values if config.js fails
  window.APP = window.APP || {
    API_BASE: '', // Will be set by server or detected
    VERSION: '1.0.0',
    DEBUG: false
  };

  // Critical error handling
  window.addEventListener('error', function(e) {
    console.warn('JS Error caught:', e.filename, e.message);
    // Don't let JS errors break the page
  });

  // Always set API base correctly (override any incorrect values)
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = window.location.port;

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    window.APP.API_BASE = `${protocol}//${hostname}:3000`;
  } else if (hostname === 'test.eskisiniveryenisinial.com') {
    // Production frontend domain - points to separate API domain
    window.APP.API_BASE = 'https://api.eskisiniveryenisinial.com';
  } else {
    // Other domains - default to production API
    window.APP.API_BASE = 'https://api.eskisiniveryenisinial.com';
  }

  console.log('🔧 Core-loader: API_BASE set to:', window.APP.API_BASE);
  console.log('🔧 Core-loader: window.APP object:', window.APP);

  // Safe script loader with fallbacks
  function loadScript(src, callback, fallback) {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;

    script.onload = function() {
      console.log('✅ Loaded:', src);
      if (callback) callback();
    };

    script.onerror = function() {
      console.warn('❌ Failed to load:', src);
      if (fallback) fallback();
    };

    document.head.appendChild(script);
  }

  // Essential functions that must work
  const EssentialFunctions = {
    // Safe API request function
    safeApiRequest: async function(url, options = {}) {
      try {
        const response = await fetch(window.APP.API_BASE + url, {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...options.headers
          },
          ...options
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        console.error('API request failed:', error);
        return { ok: false, error: error.message };
      }
    },

    // Safe DOM manipulation
    safeQuerySelector: function(selector) {
      try {
        return document.querySelector(selector);
      } catch (error) {
        console.warn('Invalid selector:', selector);
        return null;
      }
    },

    // Safe event listener
    safeAddEventListener: function(element, event, handler) {
      if (element && typeof handler === 'function') {
        element.addEventListener(event, function(e) {
          try {
            handler(e);
          } catch (error) {
            console.error('Event handler error:', error);
          }
        });
      }
    },

    // Simple toast notification fallback
    showToast: function(message, type = 'info') {
      // Try to use main notification system first
      if (window.notifications && typeof window.notifications.show === 'function') {
        try {
          window.notifications.show(message, type);
          return;
        } catch (error) {
          console.warn('Main notification system failed, using fallback');
        }
      }

      // Create simple toast fallback
      const toast = document.createElement('div');
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#10b981'};
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        z-index: 9999;
        max-width: 300px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.4;
      `;
      toast.textContent = message;
      document.body.appendChild(toast);

      // Auto remove after 3 seconds
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 3000);

      // Click to dismiss
      toast.addEventListener('click', () => {
        if (toast.parentNode) {
          toast.remove();
        }
      });
    },

    // Safe partial loading
    loadPartials: function() {
      const partialElements = document.querySelectorAll('[data-include]');

      partialElements.forEach(async (element) => {
        const src = element.getAttribute('data-include');
        if (!src) return;

        try {
          const response = await fetch(src);
          if (response.ok) {
            const html = await response.text();
            element.innerHTML = html;

            // Process any scripts in the loaded content
            const scripts = element.querySelectorAll('script');
            scripts.forEach(script => {
              const newScript = document.createElement('script');
              newScript.textContent = script.textContent;
              document.head.appendChild(newScript);
            });

            // If header partial was loaded, call bootHeader
            if (src.includes('header.html')) {
              setTimeout(() => {
                if (typeof window.bootHeader === 'function') {
                  console.log('🚀 Calling bootHeader after header partial loaded (core-loader)');
                  window.bootHeader();
                }
              }, 200);
            }
          }
        } catch (error) {
          console.warn('Failed to load partial:', src, error);
          element.innerHTML = `<!-- Failed to load: ${src} -->`;
        }
      });
    }
  };

  // Make essential functions globally available
  window.EssentialFunctions = EssentialFunctions;

  // Critical script validation
  const CriticalValidator = {
    requiredScripts: [
      'dependency-manager.js',
      'partials.js',
      'validation.js'
    ],

    criticalTimeout: 10000, // 10 seconds max wait for critical scripts

    checkCriticalScripts: function() {
      const missing = [];

      // Check if dependency manager loaded
      if (!window.DependencyManager) {
        missing.push('Dependency Manager');
      }

      // Check if partials system works
      if (!window.EssentialFunctions && typeof includePartials !== 'function') {
        missing.push('Partials System');
      }

      return missing;
    },

    showCriticalError: function(missingComponents) {
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
            <h1 style="font-size: 2rem; margin-bottom: 1rem;">⚠️ Critical System Error</h1>
            <p style="font-size: 1.2rem; margin-bottom: 1rem;">
              Essential website components failed to load:
            </p>
            <ul style="font-size: 1rem; margin-bottom: 2rem; text-align: left;">
              ${missingComponents.map(comp => `<li>${comp}</li>`).join('')}
            </ul>
            <div style="background: rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px; margin-bottom: 2rem;">
              <p style="margin: 0;">This could be due to:</p>
              <ul style="margin: 0.5rem 0; text-align: left;">
                <li>Network connectivity issues</li>
                <li>Server problems</li>
                <li>Ad blockers blocking JavaScript</li>
                <li>Browser security settings</li>
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
            ">🔄 Retry</button>
            <button onclick="this.parentElement.parentElement.style.display='none'" style="
              background: transparent;
              color: white;
              border: 2px solid white;
              padding: 10px 24px;
              border-radius: 6px;
              font-size: 1rem;
              cursor: pointer;
            ">Continue Anyway</button>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', errorHtml);
      console.error('🚨 CRITICAL: Essential scripts failed to load:', missingComponents);
    },

    validateAfterTimeout: function() {
      setTimeout(() => {
        const missing = this.checkCriticalScripts();

        if (missing.length > 0) {
          this.showCriticalError(missing);
        } else {
          console.log('✅ All critical systems loaded successfully');
        }
      }, this.criticalTimeout);
    }
  };

  // Auto-initialize critical features
  document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Core loader initialized');

    // Start critical script validation
    CriticalValidator.validateAfterTimeout();

    // Load partials with fallback
    if (typeof includePartials !== 'function') {
      console.log('📦 Using fallback partial loader');
      EssentialFunctions.loadPartials();
    }

    // Basic cart functionality fallback (only if main system fails)
    if (!window.Cart) {
      window.Cart = {
        add: function() { EssentialFunctions.showToast('Cart system loading...', 'info'); },
        getState: function() { return { items: [], item_count: 0 }; }
      };
    }

    // Basic auth check fallback (only if main system fails)
    if (!window.Auth) {
      window.Auth = {
        checkLoginStatus: function() { return false; },
        getCurrentUser: function() { return null; },
        login: function() { EssentialFunctions.showToast('Authentication system loading...', 'info'); },
        logout: function() { EssentialFunctions.showToast('Logging out...', 'info'); }
      };
    }

    // Basic notification system fallback
    if (!window.notifications) {
      window.notifications = {
        show: EssentialFunctions.showToast,
        connect: function() { console.log('📡 Notification system loading...'); }
      };
    }
  });

  // Listen for successful dependency loading
  document.addEventListener('dependenciesLoaded', function(e) {
    const detail = e.detail || {};
    if (detail.error) {
      console.error('🚨 Dependency loading completed with errors');
      // Don't show error overlay if dependencies loaded with some errors -
      // the dependency manager already handles individual script failures
    } else {
      console.log('✅ All dependencies loaded successfully');
    }
  });

  // Emergency CSS injection for critical styles
  const emergencyCSS = `
    .emergency-header {
      background: #667eea;
      color: white;
      padding: 1rem;
      text-align: center;
    }
    .emergency-nav {
      background: #f8f9fa;
      padding: 0.5rem;
      text-align: center;
    }
    .emergency-nav a {
      margin: 0 1rem;
      color: #667eea;
      text-decoration: none;
    }
  `;

  // Inject emergency CSS if main styles fail
  const styleElement = document.createElement('style');
  styleElement.textContent = emergencyCSS;
  document.head.appendChild(styleElement);

  console.log('🛡️ Core loader ready - Site will work even if other JS fails');

})();