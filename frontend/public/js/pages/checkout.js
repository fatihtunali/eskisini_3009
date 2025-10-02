// frontend/public/js/pages/checkout.js
(function() {
  'use strict';

  const API_BASE = window.getCorrectApiBase ? window.getCorrectApiBase() : (window.APP && window.APP.API_BASE) || '';

  let cart = null;
  let user = null;

  // API helper
  async function apiRequest(url, options = {}) {
    const response = await fetch(`${API_BASE}${url}`, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }

  // Initialize
  async function initCheckout() {
    try {
      console.log('💳 Checkout page initializing...');

      // Check auth
      const authData = await apiRequest('/api/auth/me');
      user = authData.user;
      console.log('✅ User authenticated:', user.full_name);

      // Load cart
      const cartData = await apiRequest('/api/cart');
      cart = cartData.cart;
      console.log('✅ Cart loaded:', cart.items.length, 'items');

      if (!cart.items || cart.items.length === 0) {
        showError('Sepetiniz boş. Lütfen önce ürün ekleyin.');
        return;
      }

      // Pre-fill form
      console.log('📝 Pre-filling form...');
      document.getElementById('recipientName').value = user.full_name || '';
      document.getElementById('phone').value = user.phone_e164 || '';
      document.getElementById('cardHolder').value = user.full_name || '';

      // Render
      console.log('🎨 Rendering order items...');
      renderOrderItems();
      console.log('💰 Rendering order summary...');
      renderOrderSummary();
      console.log('🎯 Setting up event listeners...');
      setupEventListeners();

      // Show content
      console.log('✅ Showing content...');
      document.getElementById('loading').style.display = 'none';
      document.getElementById('content').style.display = 'block';
      console.log('✅ Checkout page ready!');

    } catch (error) {
      console.error('Checkout init error:', error);
      if (error.message.includes('401')) {
        window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.href)}`;
      } else {
        showError('Sayfa yüklenirken hata oluştu: ' + error.message);
      }
    }
  }

  // Run initialization - handle both cases: DOM ready or not
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCheckout);
  } else {
    // DOM already loaded, run immediately
    initCheckout();
  }

  function renderOrderItems() {
    const html = cart.items.map(item => `
      <div class="order-item">
        <img src="${item.image_url || '/assets/placeholder.png'}"
             alt="${escapeHtml(item.title)}"
             class="item-image"
             onerror="this.src='/assets/placeholder.png'">
        <div style="flex: 1;">
          <div class="item-title">${escapeHtml(item.title)}</div>
          <div class="item-price">${formatPrice(item.unit_price_minor)} x ${item.quantity}</div>
        </div>
      </div>
    `).join('');
    document.getElementById('orderItems').innerHTML = html;
  }

  function renderOrderSummary() {
    const subtotal = cart.subtotal_minor;
    const shipping = getShippingCost();
    const paymentFee = getPaymentFee();
    const total = subtotal + shipping + paymentFee;

    let html = `
      <div class="summary-row">
        <span>Ara Toplam</span>
        <span>${formatPrice(subtotal)}</span>
      </div>
      <div class="summary-row">
        <span>Kargo</span>
        <span class="${shipping === 0 ? 'text-success' : ''}">${shipping === 0 ? 'Ücretsiz' : formatPrice(shipping)}</span>
      </div>`;

    if (paymentFee > 0) {
      html += `
      <div class="summary-row">
        <span>Ödeme Komisyonu</span>
        <span>${formatPrice(paymentFee)}</span>
      </div>`;
    }

    html += `
      <div class="summary-row summary-total">
        <span>Toplam</span>
        <span>${formatPrice(total)}</span>
      </div>`;

    document.getElementById('orderSummary').innerHTML = html;
  }

  function getShippingCost() {
    const method = document.querySelector('input[name="shipping"]:checked')?.value;
    if (method === 'express') return 1999; // ₺19.99
    // Standard: free over ₺200
    return cart.subtotal_minor >= 20000 ? 0 : 999; // ₺9.99
  }

  function getPaymentFee() {
    const method = document.querySelector('input[name="payment"]:checked')?.value;
    return method === 'cash_on_delivery' ? 500 : 0; // ₺5.00
  }

  function setupEventListeners() {
    // Shipping change
    document.querySelectorAll('input[name="shipping"]').forEach(radio => {
      radio.addEventListener('change', () => {
        // Update standard price text
        const standardPrice = cart.subtotal_minor >= 20000 ? 'Ücretsiz' : '₺9,99';
        document.getElementById('standardPrice').textContent = standardPrice;
        renderOrderSummary();
      });
    });

    // Payment change
    document.querySelectorAll('input[name="payment"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const method = document.querySelector('input[name="payment"]:checked')?.value;
        document.getElementById('cardForm').style.display = method === 'credit_card' ? 'block' : 'none';
        renderOrderSummary();
      });
    });

    // Card formatting
    const cardNumber = document.getElementById('cardNumber');
    cardNumber.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\s/g, '').replace(/\D/g, '');
      value = value.substring(0, 16);
      value = value.replace(/(\d{4})/g, '$1 ').trim();
      e.target.value = value;
    });

    const cardExpiry = document.getElementById('cardExpiry');
    cardExpiry.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length >= 2) {
        value = value.substring(0, 2) + '/' + value.substring(2, 4);
      }
      e.target.value = value;
    });

    // Place order
    document.getElementById('placeOrderBtn').addEventListener('click', placeOrder);
  }

  async function placeOrder() {
    try {
      // Validate address
      const recipientName = document.getElementById('recipientName').value.trim();
      const phone = document.getElementById('phone').value.trim();
      const address = document.getElementById('address').value.trim();
      const city = document.getElementById('city').value.trim();
      const postalCode = document.getElementById('postalCode').value.trim();

      if (!recipientName || !phone || !address || !city) {
        alert('Lütfen tüm zorunlu adres bilgilerini doldurun');
        return;
      }

      // Validate payment
      const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value;
      if (!paymentMethod) {
        alert('Lütfen ödeme yöntemi seçin');
        return;
      }

      if (paymentMethod === 'credit_card') {
        const cardNumberVal = document.getElementById('cardNumber').value.replace(/\s/g, '');
        const cardCvc = document.getElementById('cardCvc').value.trim();
        const cardExpiry = document.getElementById('cardExpiry').value.trim();
        const cardHolder = document.getElementById('cardHolder').value.trim();

        if (!cardNumberVal || cardNumberVal.length !== 16 || !cardCvc || !cardExpiry || !cardHolder) {
          alert('Lütfen tüm kart bilgilerini doldurun');
          return;
        }
      }

      // Disable button
      const btn = document.getElementById('placeOrderBtn');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>İşleniyor...';

      // Prepare order data
      const shippingMethod = document.querySelector('input[name="shipping"]:checked')?.value || 'standard';
      const shippingCost = getShippingCost();
      const paymentFee = getPaymentFee();
      const total = cart.subtotal_minor + shippingCost + paymentFee;

      const orderData = {
        cart_id: cart.id,
        shipping_method: shippingMethod,
        shipping_cost_minor: shippingCost,
        total_minor: total,
        address: {
          title: 'Teslimat Adresi',
          recipient_name: recipientName,
          full_address: address,
          city: city,
          postal_code: postalCode,
          phone: phone
        },
        payment: {
          method: paymentMethod
        }
      };

      if (paymentMethod === 'credit_card') {
        orderData.payment.card = {
          number: document.getElementById('cardNumber').value.replace(/\s/g, ''),
          cvc: document.getElementById('cardCvc').value,
          expiry: document.getElementById('cardExpiry').value,
          holder: document.getElementById('cardHolder').value
        };
      }

      console.log('📦 Placing order:', orderData);

      // Place order
      const result = await apiRequest('/api/orders/create', {
        method: 'POST',
        body: JSON.stringify(orderData)
      });

      console.log('✅ Order created:', result);

      if (result.ok) {
        // Success! Redirect to success page
        window.location.href = `/order-success.html?order=${result.order_id}`;
      } else {
        throw new Error(result.error || 'Sipariş oluşturulamadı');
      }

    } catch (error) {
      console.error('Place order error:', error);
      alert('Sipariş oluşturulurken hata: ' + error.message);

      // Re-enable button
      const btn = document.getElementById('placeOrderBtn');
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-lock me-2"></i>Siparişi Tamamla';
    }
  }

  function showError(message) {
    document.getElementById('loading').style.display = 'none';
    const errorEl = document.getElementById('error');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }

  function formatPrice(minor, currency = 'TRY') {
    const value = (minor || 0) / 100;
    const symbol = currency === 'TRY' ? '₺' : '$';
    return `${symbol}${value.toFixed(2)}`;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  console.log('💳 Checkout system loaded');

})();