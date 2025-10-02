// public/js/sales-tab.js
(function(){
  'use strict';

  function getAPIBase() {
    return window.getCorrectApiBase ? window.getCorrectApiBase() : (window.APP && window.APP.API_BASE) || '';
  }

  function formatPrice(minor, currency = 'TRY') {
    const value = (Number(minor) || 0) / 100;
    try {
      return value.toLocaleString('tr-TR', { style: 'currency', currency: currency || 'TRY' });
    } catch {
      return `${value.toLocaleString('tr-TR')} ${currency || 'TRY'}`;
    }
  }

  function pickThumb(item) {
    const thumb = item.thumb_url || item.thumb || '';
    if (!thumb) return '/assets/products/p1.svg';
    if (/^https?:\/\//i.test(thumb) || thumb.startsWith('/')) return thumb;
    return `/uploads/${thumb}`;
  }

  function getStatusText(status) {
    const statusMap = {
      pending: 'Bekliyor',
      processing: 'İşlemde',
      shipped: 'Kargoda',
      delivered: 'Teslim Edildi',
      cancelled: 'İptal Edildi'
    };
    return statusMap[status] || status;
  }

  function getStatusClass(status) {
    return `status-${status}`;
  }

  async function fetchSales() {
    const API = getAPIBase();
    const response = await fetch(`${API}/api/orders/sales`, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });

    if (response.status === 401) {
      location.href = `/login.html?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`;
      return [];
    }

    const data = await response.json().catch(() => ({ ok: false, orders: [] }));
    return data.ok ? (data.orders || []) : [];
  }

  async function updateOrderStatus(orderId, newStatus, trackingNumber = null) {
    const API = getAPIBase();
    const body = { status: newStatus };
    if (trackingNumber) {
      body.tracking_number = trackingNumber;
    }

    const response = await fetch(`${API}/api/orders/${orderId}/fulfill`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (response.ok) {
      return await response.json();
    } else {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Update failed');
    }
  }

  function getOrderActions(order) {
    if (order.status === 'pending') {
      return `
        <button class="btn btn-success btn-sm me-2" onclick="window.updateSaleOrderStatus(${order.id}, 'processing')">
          <i class="fas fa-check me-1"></i>Onayla
        </button>
        <button class="btn btn-danger btn-sm" onclick="window.updateSaleOrderStatus(${order.id}, 'cancelled')">
          <i class="fas fa-times me-1"></i>İptal Et
        </button>
      `;
    } else if (order.status === 'processing') {
      return `
        <button class="btn btn-primary btn-sm" onclick="window.showSaleTrackingInput(${order.id})">
          <i class="fas fa-shipping-fast me-1"></i>Kargoya Ver
        </button>
        <div id="sales-tracking-${order.id}" class="tracking-input mt-2" style="display: none;">
          <div class="input-group">
            <input type="text" class="form-control" placeholder="Kargo takip numarası" id="sales-tracking-number-${order.id}">
            <button class="btn btn-outline-primary" onclick="window.shipSaleOrder(${order.id})">
              <i class="fas fa-paper-plane"></i>
            </button>
          </div>
        </div>
      `;
    } else if (order.status === 'shipped') {
      return `
        <button class="btn btn-outline-success btn-sm" onclick="window.updateSaleOrderStatus(${order.id}, 'delivered')">
          <i class="fas fa-check-double me-1"></i>Teslim Edildi
        </button>
        ${order.tracking_number ? `<div><small class="text-muted">Takip: ${order.tracking_number}</small></div>` : ''}
      `;
    } else {
      return `<small class="text-muted">Sipariş ${getStatusText(order.status).toLowerCase()}</small>`;
    }
  }

  function createOrderHTML(order) {
    const price = formatPrice(order.total_minor, order.currency);
    const date = new Date(order.created_at).toLocaleDateString('tr-TR');
    const statusClass = getStatusClass(order.status);
    const statusText = getStatusText(order.status);

    // Handle cart-based orders vs single item orders
    const isCartOrder = !order.listing_id && order.items && order.items.length > 0;

    let thumb, title, itemInfo;

    if (isCartOrder) {
      // For cart orders, use first item's info and show item count
      const firstItem = order.items[0];
      thumb = pickThumb(firstItem);
      const itemCount = order.items.length;

      if (itemCount === 1) {
        title = firstItem.title || 'Ürün';
        itemInfo = `Adet: ${firstItem.qty}`;
      } else {
        title = `${firstItem.title || 'Ürün'} + ${itemCount - 1} ürün daha`;
        itemInfo = `${itemCount} farklı ürün`;
      }
    } else {
      // Single item order
      thumb = pickThumb(order);
      title = order.title || 'Ürün';
      itemInfo = `Adet: ${order.qty || 1}`;
    }

    return `
      <div class="order-item mb-3 p-3 border rounded" data-status="${order.status}">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div>
            <h6 class="mb-1">Sipariş #${order.id}</h6>
            <small class="text-muted">
              <i class="fas fa-user me-1"></i>${order.buyer_name || 'Alıcı'} •
              <i class="fas fa-calendar me-1"></i>${date}
            </small>
          </div>
          <span class="badge ${statusClass}">${statusText}</span>
        </div>

        <div class="row align-items-center">
          <div class="col-auto">
            <img src="${thumb}" alt="${title}" class="order-thumb" style="width: 60px; height: 60px; object-fit: cover; border-radius: 0.375rem;">
          </div>
          <div class="col">
            <h6 class="mb-1">${title}</h6>
            <div class="d-flex justify-content-between align-items-center">
              <small class="text-muted">${itemInfo}</small>
              <strong class="text-success">${price}</strong>
            </div>
            ${isCartOrder && order.items.length > 1 ? `
              <div class="mt-1">
                <small class="text-muted">
                  <i class="fas fa-list me-1"></i>Sepet siparişi - ${order.items.length} ürün
                </small>
              </div>
            ` : ''}
          </div>
        </div>

        ${isCartOrder && order.items.length > 1 ? `
          <div class="mt-2">
            <details class="order-items-detail">
              <summary class="text-primary" style="cursor: pointer; font-size: 0.875rem;">
                <i class="fas fa-chevron-down me-1"></i>Sipariş detaylarını göster
              </summary>
              <div class="mt-2 ps-3">
                ${order.items.map(item => `
                  <div class="d-flex align-items-center mb-1">
                    <img src="${pickThumb(item)}" style="width: 30px; height: 30px; object-fit: cover; border-radius: 4px;" class="me-2">
                    <div class="flex-grow-1">
                      <small><strong>${item.title || 'Ürün'}</strong></small>
                      <small class="text-muted d-block">Adet: ${item.qty} × ${formatPrice(item.unit_price_minor, order.currency)}</small>
                    </div>
                    <small class="text-success"><strong>${formatPrice(item.total_minor, order.currency)}</strong></small>
                  </div>
                `).join('')}
              </div>
            </details>
          </div>
        ` : ''}

        <div class="mt-3">
          ${getOrderActions(order)}
        </div>
      </div>
    `;
  }

  function render(orders) {
    const container = document.getElementById('salesContainer');
    if (!container) return;

    if (!orders.length) {
      container.innerHTML = `
        <div class="empty-state text-center py-5">
          <i class="fas fa-shopping-box fa-3x text-muted mb-3"></i>
          <h5 class="text-muted">Henüz satış bulunmuyor</h5>
          <p class="text-muted">Ürünlerinizi satmaya başladığınızda siparişler burada görünecek.</p>
          <a href="/sell.html" class="btn btn-primary">
            <i class="fas fa-plus me-2"></i>İlan Ver
          </a>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h5>Gelen Siparişler (${orders.length})</h5>
        <div class="d-flex gap-2">
          <select class="form-select form-select-sm" id="salesStatusFilter" onchange="window.filterSalesOrders()">
            <option value="">Tüm Durumlar</option>
            <option value="pending">Bekleyenler</option>
            <option value="processing">İşlemde</option>
            <option value="shipped">Kargoda</option>
            <option value="delivered">Teslim Edildi</option>
            <option value="cancelled">İptal Edildi</option>
          </select>
          <button class="btn btn-outline-primary btn-sm" onclick="window.loadSalesTab()">
            <i class="fas fa-sync-alt"></i>
          </button>
        </div>
      </div>
      <div id="salesOrdersList">
        ${orders.map(order => createOrderHTML(order)).join('')}
      </div>
    `;
  }

  // Global functions
  window.updateSaleOrderStatus = async function(orderId, newStatus) {
    try {
      await updateOrderStatus(orderId, newStatus);
      alert(`✅ Sipariş durumu '${getStatusText(newStatus)}' olarak güncellendi.`);
      window.loadSalesTab(); // Refresh
    } catch (error) {
      console.error('Error updating order status:', error);
      alert(`❌ Sipariş güncellenemedi: ${error.message}`);
    }
  };

  window.showSaleTrackingInput = function(orderId) {
    const trackingDiv = document.getElementById(`sales-tracking-${orderId}`);
    if (trackingDiv) {
      trackingDiv.style.display = 'block';
    }
  };

  window.shipSaleOrder = async function(orderId) {
    const trackingNumber = document.getElementById(`sales-tracking-number-${orderId}`).value;
    if (!trackingNumber.trim()) {
      alert('Lütfen takip numarası girin.');
      return;
    }

    try {
      await updateOrderStatus(orderId, 'shipped', trackingNumber);
      alert('✅ Sipariş kargoya verildi ve takip numarası eklendi.');
      window.loadSalesTab(); // Refresh
    } catch (error) {
      console.error('Error shipping order:', error);
      alert(`❌ Kargo işlemi başarısız: ${error.message}`);
    }
  };

  window.filterSalesOrders = function() {
    const filter = document.getElementById('salesStatusFilter').value;
    const orderItems = document.querySelectorAll('#salesOrdersList .order-item');

    orderItems.forEach(item => {
      if (!filter) {
        item.style.display = 'block';
      } else {
        const orderStatus = item.dataset.status;
        item.style.display = orderStatus === filter ? 'block' : 'none';
      }
    });
  };

  window.loadSalesTab = async function() {
    const container = document.getElementById('salesContainer');
    if (!container) return;

    container.innerHTML = `
      <div class="text-center py-4">
        <i class="fas fa-spinner fa-spin fa-2x text-muted"></i>
        <p class="mt-2 text-muted">Satışlar yükleniyor...</p>
      </div>
    `;

    try {
      const orders = await fetchSales();
      render(orders);
    } catch (error) {
      console.error('Error loading sales:', error);
      container.innerHTML = `
        <div class="alert alert-danger">
          <i class="fas fa-exclamation-triangle me-2"></i>
          Satışlar yüklenirken hata oluştu. Lütfen tekrar deneyin.
        </div>
      `;
    }
  };

  // Initialize if sales tab is active
  if (window.location.search.includes('tab=sales')) {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        window.loadSalesTab();
      }, 100);
    });
  }

})();