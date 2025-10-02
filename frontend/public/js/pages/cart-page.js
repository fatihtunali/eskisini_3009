// frontend/public/js/pages/cart-page.js
(function() {
  'use strict';

  // DOM elements
  const elements = {
    loading: document.getElementById('cartLoading'),
    content: document.getElementById('cartContent'),
    emptyCart: document.getElementById('emptyCart'),
    itemsList: document.getElementById('cartItemsList'),
    summary: document.getElementById('cartSummary')
  };

  let currentCart = null;

  // Helper functions
  const esc = (str) => (str || '').toString().replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));

  const toTL = (minor, currency = 'TRY') => {
    const value = (Number(minor) || 0) / 100;
    try {
      return value.toLocaleString('tr-TR', { style: 'currency', currency: currency || 'TRY' });
    } catch {
      return `${value.toLocaleString('tr-TR')} ${esc(currency || 'TRY')}`;
    }
  };

  // Show loading state
  function showLoading() {
    elements.loading.style.display = 'block';
    elements.content.style.display = 'none';
    elements.emptyCart.style.display = 'none';
  }

  // Show cart content
  function showContent() {
    elements.loading.style.display = 'none';
    elements.content.style.display = 'block';
    elements.emptyCart.style.display = 'none';
  }

  // Show empty cart
  function showEmpty() {
    elements.loading.style.display = 'none';
    elements.content.style.display = 'none';
    elements.emptyCart.style.display = 'block';
  }

  // Render cart items
  function renderCartItems(items) {
    if (!items || items.length === 0) {
      elements.itemsList.innerHTML = '<p class="text-muted">Sepetinizde ürün bulunmuyor.</p>';
      return;
    }

    const itemsHtml = items.map(item => {
      const itemTotal = item.unit_price_minor * item.quantity;
      const isInactive = item.listing_status !== 'active';

      return `
        <div class="cart-item ${isInactive ? 'opacity-50' : ''}" data-item-id="${item.id}">
          <img src="${item.image_url || '/assets/placeholder.png'}"
               alt="${esc(item.title)}"
               class="item-image"
               onerror="this.src='/assets/placeholder.png'">

          <div class="item-details">
            <h5 class="item-title">${esc(item.title)}</h5>

            ${isInactive ? `
              <div class="alert alert-warning small mb-2">
                <i class="fas fa-exclamation-triangle me-1"></i>
                Bu ürün artık satışta değil
              </div>
            ` : ''}

            <div class="item-price">${toTL(item.unit_price_minor, item.currency)}</div>

            ${item.current_price_minor !== item.unit_price_minor ? `
              <div class="small text-muted">
                Güncel fiyat: ${toTL(item.current_price_minor, item.current_currency)}
              </div>
            ` : ''}

            <div class="quantity-controls">
              <button class="qty-btn cart-qty-minus" data-item-id="${item.id}" ${isInactive ? 'disabled' : ''}>
                <i class="fas fa-minus"></i>
              </button>
              <input type="number" class="qty-input cart-qty-input"
                     value="${item.quantity}" min="1" max="99"
                     data-item-id="${item.id}" ${isInactive ? 'disabled' : ''}>
              <button class="qty-btn cart-qty-plus" data-item-id="${item.id}" ${isInactive ? 'disabled' : ''}>
                <i class="fas fa-plus"></i>
              </button>

              <div class="ms-auto">
                <span class="fw-bold">${toTL(itemTotal, item.currency)}</span>
              </div>
            </div>
          </div>

          <button class="remove-btn btn-remove-cart-item" data-item-id="${item.id}"
                  title="Sepetten çıkar">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;
    }).join('');

    elements.itemsList.innerHTML = itemsHtml;
  }

  // Render cart summary
  function renderCartSummary(cart) {
    if (!cart) return;

    const activeItems = cart.items.filter(item => item.listing_status === 'active');
    const activeSubtotal = activeItems.reduce((sum, item) =>
      sum + (item.unit_price_minor * item.quantity), 0
    );
    const activeItemCount = activeItems.reduce((sum, item) => sum + item.quantity, 0);

    // Calculate shipping (example: free over 200 TL)
    const shippingThreshold = 20000; // 200 TL in minor units
    const standardShipping = 999; // 9.99 TL
    const shippingCost = activeSubtotal >= shippingThreshold ? 0 : standardShipping;

    const total = activeSubtotal + shippingCost;

    const summaryHtml = `
      <div class="summary-row">
        <span>Ürünler (${activeItemCount} adet)</span>
        <span>${toTL(activeSubtotal)}</span>
      </div>
      <div class="summary-row">
        <span>Kargo</span>
        <span class="${shippingCost === 0 ? 'text-success' : ''}">
          ${shippingCost === 0 ? 'Ücretsiz' : toTL(shippingCost)}
        </span>
      </div>
      ${shippingCost > 0 && activeSubtotal < shippingThreshold ? `
        <div class="small text-muted mt-2">
          <i class="fas fa-info-circle me-1"></i>
          ${toTL(shippingThreshold - activeSubtotal)} daha alışveriş yapın, kargo ücretsiz olsun!
        </div>
      ` : ''}
      <div class="summary-row total">
        <span>Toplam</span>
        <span>${toTL(total)}</span>
      </div>
    `;

    elements.summary.innerHTML = summaryHtml;
  }

  // Load and display cart
  async function loadAndDisplayCart() {
    showLoading();

    try {
      if (!window.Cart) {
        throw new Error('Sepet sistemi yüklenemedi');
      }

      await window.Cart.load();
      currentCart = window.Cart.getState();

      if (!currentCart.items || currentCart.items.length === 0) {
        showEmpty();
        return;
      }

      renderCartItems(currentCart.items);
      renderCartSummary(currentCart);
      showContent();

    } catch (error) {
      console.error('Failed to load cart:', error);
      elements.loading.innerHTML = `
        <div class="text-danger">
          <i class="fas fa-exclamation-triangle fa-2x mb-3"></i>
          <p>Sepet yüklenirken hata oluştu</p>
          <button class="btn btn-primary" onclick="location.reload()">
            Yeniden Dene
          </button>
        </div>
      `;
    }
  }

  // Global functions for buttons
  window.proceedToCheckout = function() {
    if (!currentCart || !currentCart.items.length) {
      alert('Sepetinizde ürün bulunmuyor.');
      return;
    }

    const activeItems = currentCart.items.filter(item => item.listing_status === 'active');
    if (activeItems.length === 0) {
      alert('Sepetinizdeki ürünlerin hiçbiri satışta değil.');
      return;
    }

    // Go to checkout page
    window.location.href = '/checkout.html';
  };

  window.clearEntireCart = async function() {
    if (!window.Cart) return;

    const success = await window.Cart.clear();
    if (success) {
      showEmpty();
    }
  };

  // Listen for cart updates
  document.addEventListener('cart:updated', (e) => {
    currentCart = e.detail;

    if (currentCart.items.length === 0) {
      showEmpty();
    } else {
      renderCartItems(currentCart.items);
      renderCartSummary(currentCart);
    }
  });

  // Initialize cart page when dependencies are ready
  async function startCartPage() {
    console.log('🚀 Cart-page.js: Starting cart page initialization');
    const API_BASE = window.getCorrectApiBase ? window.getCorrectApiBase() : (window.APP && window.APP.API_BASE) || '';
    console.log('🚀 Cart-page.js: API_BASE available:', API_BASE);

    async function initCart() {
      try {
        // Check authentication directly with API
        const response = await fetch(`${API_BASE}/api/auth/me`, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
          // User not logged in, redirect to login
          const redirect = encodeURIComponent(window.location.href);
          window.location.href = `/login.html?redirect=${redirect}`;
          return;
        }

        // User is logged in, proceed
        loadAndDisplayCart();
      } catch (error) {
        console.error('Auth check failed:', error);
        // Redirect to login on error
        const redirect = encodeURIComponent(window.location.href);
        window.location.href = `/login.html?redirect=${redirect}`;
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initCart);
    } else {
      initCart();
    }
  }

  // Wait for dependencies to be loaded before starting
  if (window.dependenciesLoadedTriggered) {
    console.log('🚀 Cart-page.js: Dependencies already loaded, starting immediately');
    startCartPage();
  } else {
    console.log('🚀 Cart-page.js: Waiting for dependencies to load...');
    document.addEventListener('dependenciesLoaded', function() {
      console.log('🚀 Cart-page.js: Dependencies loaded event received, starting cart');
      startCartPage();
    });
  }

  // Listen for auth changes
  document.addEventListener('auth:login', loadAndDisplayCart);
  document.addEventListener('auth:logout', () => {
    // Don't force redirect to login - let the main logout handler decide
    console.log('🛒 Cart page: User logged out, clearing cart data');
    // Just clear any sensitive cart data if needed
  });

})();