// frontend/public/js/pages/order-success.js
(function() {
  'use strict';

  // Get API base URL
  const API_BASE = window.getCorrectApiBase ? window.getCorrectApiBase() : (window.APP && window.APP.API_BASE) || '';

  // DOM elements
  const elements = {
    loading: document.getElementById('successLoading'),
    content: document.getElementById('successContent'),
    error: document.getElementById('successError'),
    orderDetails: document.getElementById('orderDetails')
  };

  // Get order ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('order');

  // API helper
  async function apiRequest(url, options = {}) {
    try {
      const response = await fetch(`${API_BASE}${url}`, {
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
      console.error('API Request failed:', error);
      throw error;
    }
  }

  // Show/hide states
  function showLoading() {
    elements.loading.style.display = 'block';
    elements.content.style.display = 'none';
    elements.error.style.display = 'none';
  }

  function showContent() {
    elements.loading.style.display = 'none';
    elements.content.style.display = 'block';
    elements.error.style.display = 'none';
  }

  function showError() {
    elements.loading.style.display = 'none';
    elements.content.style.display = 'none';
    elements.error.style.display = 'block';
  }

  // Load and display order details
  async function loadOrderDetails() {
    try {
      showLoading();

      if (!orderId) {
        showError();
        return;
      }

      // Get order details and items
      const [orderResponse, itemsResponse] = await Promise.all([
        apiRequest(`/api/orders/${orderId}`),
        apiRequest(`/api/orders/${orderId}/items`)
      ]);

      if (!orderResponse.ok) {
        throw new Error('Order not found');
      }

      const order = orderResponse.order;
      const items = itemsResponse.items || [];

      renderOrderDetails(order, items);
      showContent();

    } catch (error) {
      console.error('Load order details error:', error);
      showError();
    }
  }

  // Render order details
  function renderOrderDetails(order, items) {
    if (!order) return;

    const paymentMethodText = {
      'credit_card': 'Kredi/Banka Kartı',
      'bank_transfer': 'Havale/EFT',
      'cash_on_delivery': 'Kapıda Ödeme'
    }[order.payment_method] || order.payment_method;

    const statusText = {
      'pending': 'Beklemede',
      'confirmed': 'Onaylandı',
      'processing': 'Hazırlanıyor',
      'shipped': 'Kargoda',
      'delivered': 'Teslim Edildi',
      'cancelled': 'İptal Edildi'
    }[order.status] || order.status;

    const statusClass = {
      'pending': 'text-warning',
      'confirmed': 'text-info',
      'processing': 'text-primary',
      'shipped': 'text-success',
      'delivered': 'text-success',
      'cancelled': 'text-danger'
    }[order.status] || 'text-muted';

    // Format date
    const orderDate = new Date(order.created_at).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let itemsHtml = '';
    if (items.length > 0) {
      itemsHtml = items.map(item => `
        <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
          <div>
            <strong>${escapeHtml(item.title || item.listing_title || 'Ürün')}</strong>
            <div class="small text-muted">Adet: ${item.quantity}</div>
          </div>
          <div class="text-end">
            <div>${formatPrice(item.total_minor, order.currency)}</div>
            <div class="small text-muted">Birim: ${formatPrice(item.unit_price_minor, order.currency)}</div>
          </div>
        </div>
      `).join('');
    } else {
      // Fallback for single-item order (legacy format)
      itemsHtml = `
        <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
          <div>
            <strong>${escapeHtml(order.title || 'Ürün')}</strong>
            <div class="small text-muted">Adet: ${order.qty || 1}</div>
          </div>
          <div class="text-end">
            <div>${formatPrice(order.subtotal_minor, order.currency)}</div>
            <div class="small text-muted">Birim: ${formatPrice(order.unit_price_minor, order.currency)}</div>
          </div>
        </div>
      `;
    }

    const detailsHtml = `
      <div class="summary-row">
        <span>Sipariş No</span>
        <span><strong>#${order.id}</strong></span>
      </div>
      <div class="summary-row">
        <span>Sipariş Tarihi</span>
        <span>${orderDate}</span>
      </div>
      <div class="summary-row">
        <span>Durum</span>
        <span class="${statusClass}"><strong>${statusText}</strong></span>
      </div>
      <div class="summary-row">
        <span>Ödeme Yöntemi</span>
        <span>${paymentMethodText}</span>
      </div>

      <hr class="my-3">

      <h6 class="mb-3">Sipariş Kalemleri</h6>
      ${itemsHtml}

      <hr class="my-3">

      <div class="summary-row">
        <span>Ara Toplam</span>
        <span>${formatPrice(order.subtotal_minor, order.currency)}</span>
      </div>
      ${order.shipping_minor > 0 ? `
        <div class="summary-row">
          <span>Kargo</span>
          <span>${formatPrice(order.shipping_minor, order.currency)}</span>
        </div>
      ` : `
        <div class="summary-row">
          <span>Kargo</span>
          <span class="text-success">Ücretsiz</span>
        </div>
      `}
      <div class="summary-row">
        <span><strong>Toplam</strong></span>
        <span><strong>${formatPrice(order.total_minor, order.currency)}</strong></span>
      </div>
    `;

    elements.orderDetails.innerHTML = detailsHtml;
  }

  // Utility functions
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatPrice(minor, currency = 'TRY') {
    const value = (minor || 0) / 100;
    try {
      return value.toLocaleString('tr-TR', {
        style: 'currency',
        currency: currency
      });
    } catch {
      const symbol = currency === 'USD' ? '$' : '₺';
      return `${symbol}${value.toLocaleString('tr-TR')}`;
    }
  }

  // Initialize page
  async function initOrderSuccess() {
    try {
      console.log('🎉 Order success page initializing...');

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

      console.log('✅ User authenticated, loading order details...');
      // User is logged in, proceed
      loadOrderDetails();
    } catch (error) {
      console.error('Auth check failed:', error);
      // Redirect to login on error
      const redirect = encodeURIComponent(window.location.href);
      window.location.href = `/login.html?redirect=${redirect}`;
    }
  }

  // Run initialization - handle both cases: DOM ready or not
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOrderSuccess);
  } else {
    // DOM already loaded, run immediately
    initOrderSuccess();
  }

  // Listen for auth changes
  document.addEventListener('auth:logout', () => {
    // Don't force redirect to login - let the main logout handler decide
    console.log('✅ Order success page: User logged out, clearing order data');
    // Just clear any sensitive order data if needed
  });

})();