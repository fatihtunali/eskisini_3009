// Test script to demonstrate the resilient loading system
// This script can be used to test how the system handles failures

(function() {
  'use strict';

  console.log('🔧 Test Resilience Script loaded');

  // Test the dependency manager
  function testResilienceSystem() {
    console.log('=== JavaScript Resilience Test ===');

    // Check if core loader is available
    if (window.EssentialFunctions) {
      console.log('✅ Core loader functions are available');
    } else {
      console.log('❌ Core loader failed to load');
    }

    // Check if dependency manager is available
    if (window.DependencyManager) {
      console.log('✅ Dependency manager is available');
      console.log('Loaded scripts:', Array.from(window.DependencyManager.loaded));
      console.log('Failed scripts:', Array.from(window.DependencyManager.failed));
    } else {
      console.log('❌ Dependency manager failed to load');
    }

    // Test essential functions
    if (window.EssentialFunctions) {
      // Test safe API request
      console.log('🔧 Testing safe API request...');
      window.EssentialFunctions.safeApiRequest('/api/test')
        .then(result => console.log('API test result:', result))
        .catch(error => console.log('API test error (expected):', error));

      // Test toast notification
      console.log('🔧 Testing toast notification...');
      window.EssentialFunctions.showToast('✅ Resilient loading system working!', 'success');

      // Test notification system
      if (window.NotificationSystem) {
        console.log('✅ NotificationSystem class available');
        try {
          const testNotif = new window.NotificationSystem();
          console.log('✅ NotificationSystem constructor works');
        } catch (error) {
          console.log('❌ NotificationSystem constructor failed:', error);
        }
      } else {
        console.log('❌ NotificationSystem class not available');
      }

      // Test notification instance
      if (window.notifications) {
        console.log('✅ Notification instance available:', typeof window.notifications);
        if (typeof window.notifications.show === 'function') {
          try {
            window.notifications.show('🔔 Test notification from main system', 'info');
            console.log('✅ Main notification system working');
          } catch (error) {
            console.log('❌ Main notification system failed:', error);
          }
        }
      } else {
        console.log('❌ No notification instance available');
      }
    }

    // Test cart fallback
    if (window.Cart) {
      console.log('✅ Cart system is available');
      console.log('Cart state:', window.Cart.getState());
    } else {
      console.log('⚠️ Cart system not available (may load later)');
    }

    // Test auth fallback
    if (window.Auth) {
      console.log('✅ Auth system is available');
    } else {
      console.log('⚠️ Auth system not available (may load later)');
    }

    console.log('=== Test completed ===');
  }

  // Run tests when dependencies are loaded
  document.addEventListener('dependenciesLoaded', () => {
    console.log('🎯 Dependencies loaded event received');
    setTimeout(testResilienceSystem, 100);
  });

  // Fallback test if dependencies don't load
  setTimeout(() => {
    if (!window.dependenciesLoadedTriggered) {
      console.log('🔧 Running fallback resilience test');
      testResilienceSystem();
    }
  }, 3000);

  // Global test function for manual testing
  window.testResilienceSystem = testResilienceSystem;

})();