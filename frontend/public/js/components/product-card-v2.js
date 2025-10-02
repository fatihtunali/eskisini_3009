// Unified Product Card Component
// Single consistent view for all product displays across the project
// Based on profile.html mylistings view

(function() {
  'use strict';

  // HTML escape function
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Format price function (Turkish Lira)
  function formatPrice(priceMinor, currency = 'TRY') {
    if (priceMinor == null) return 'Fiyat belirtilmemiş';

    const price = (Number(priceMinor) || 0) / 100;
    try {
      return price.toLocaleString('tr-TR', { style: 'currency', currency: currency || 'TRY' });
    } catch {
      return `${price.toLocaleString('tr-TR')} ${escapeHtml(currency || 'TRY')}`;
    }
  }

  // Format date function - relative time
  function formatDate(dateString) {
    if (!dateString) return '';

    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Bugün';
    } else if (diffDays === 1) {
      return 'Dün';
    } else if (diffDays < 7) {
      return `${diffDays} gün önce`;
    } else {
      return date.toLocaleDateString('tr-TR');
    }
  }

  // Format date - full date only
  function formatFullDate(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('tr-TR');
  }

  // Get status info
  function getStatusInfo(status) {
    const st = status || 'active';
    const statusMap = {
      'active': { text: 'Aktif', class: 'success' },
      'sold': { text: 'Satıldı', class: 'secondary' },
      'pending_review': { text: 'İnceleme Bekliyor', class: 'info' },
      'rejected': { text: 'Reddedildi', class: 'danger' },
      'pending': { text: 'Beklemede', class: 'warning' },
      'paused': { text: 'Pasif', class: 'secondary' },
      'inactive': { text: 'Pasif', class: 'secondary' },
      'pasif': { text: 'Pasif', class: 'secondary' },
      'draft': { text: 'Taslak', class: 'muted' }
    };
    return statusMap[st] || { text: 'Taslak', class: 'muted' };
  }

  /**
   * UNIFIED LISTING CARD - New 2-Row Layout
   * [Image] Row 1: Product Name + Category (left) | Price (right)
   * [Image] Row 2: View Count + Favorite + Shop (left) | Details Button (right)
   * Note: My Listings page keeps action buttons instead of Details button
   */
  function renderListingCard(product, options = {}) {
    const showActions = options.showActions !== false; // Default true for My Listings
    const showStatus = options.showStatus !== false; // Default true
    const hideBuyButton = options.hideBuyButton === true; // Hide "Satın Al" for own shop

    const img = product.thumb_url || product.cover_url || product.cover || '/assets/placeholder.png';
    const href = product.slug ? `/listing.html?slug=${encodeURIComponent(product.slug)}` : `/listing.html?id=${encodeURIComponent(product.id)}`;
    const priceStr = formatPrice(product.price_minor, product.currency);

    const statusInfo = getStatusInfo(product.status);
    const viewCount = product.view_count || 0;
    // Get seller name from database fields: owner_business_name (shop) or owner_display_name (user)
    const sellerName = product.owner_business_name || product.owner_display_name || product.seller_name || product.shop_name || 'Satıcı';

    return `
      <div class="listing-card">
        <div class="listing-content">
          <img class="listing-image" src="${img}" alt="${escapeHtml(product.title || '')}" onerror="this.src='/assets/placeholder.png'">

          <div class="listing-info-wrapper">
            <!-- Row 1: Product Name + Category (left) | Price (right) -->
            <div class="listing-row-1">
              <div class="listing-left-1">
                <h3 class="listing-title"><a href="${href}">${escapeHtml(product.title || 'İsimsiz İlan')}</a></h3>
                <span class="listing-category">${escapeHtml(product.category_name || 'Kategori')}</span>
                ${showStatus ? `<span class="badge bg-${statusInfo.class}">${statusInfo.text}</span>` : ''}
              </div>
              <div class="listing-right-1">
                <div class="listing-price">${priceStr}</div>
              </div>
            </div>

            <!-- Row 2: View Count + Favorite + Shop (left) | Details/Actions (right) -->
            <div class="listing-row-2">
              <div class="listing-left-2">
                <span class="listing-views"><i class="fas fa-eye"></i> ${viewCount}</span>
                <button class="favorite-btn-inline" onclick="toggleFavorite(${product.id}, this); event.preventDefault();" title="Favorilere ekle">
                  <i class="far fa-heart"></i>
                </button>
                ${!showActions ? `<span class="listing-seller"><i class="fas fa-store"></i> ${escapeHtml(sellerName)}</span>` : ''}
              </div>
              <div class="listing-right-2">
                ${!showActions ? `
                  <div class="listing-buttons-group">
                    ${!hideBuyButton ? `
                      <button class="btn btn-sm btn-success btn-add-to-cart" data-listing-id="${product.id}" title="Sepete ekle">
                        <i class="fas fa-shopping-cart me-1"></i>Satın Al
                      </button>
                    ` : ''}
                    <a class="btn btn-sm btn-primary" href="${href}">
                      <i class="fas fa-eye me-1"></i>Detaylar
                    </a>
                  </div>
                ` : `
                  <div class="listing-actions-row">
                    <a class="btn btn-sm" href="${href}" title="İlanı görüntüle">
                      <i class="fas fa-eye me-1"></i>Görüntüle
                    </a>
                    ${options.showEdit ? `
                    <a class="btn btn-sm ghost" href="/sell.html?edit=${encodeURIComponent(product.id)}" title="İlanı düzenle">
                      <i class="fas fa-edit me-1"></i>Düzenle
                    </a>
                    ` : ''}
                    ${options.showStatusButtons ? `
                      ${product.status === 'active' ? `
                        <button class="btn btn-sm btn-outline-warning" onclick="toggleListingStatus(${product.id}, 'paused', this)" title="İlanı duraklat">
                          <i class="fas fa-pause me-1"></i>Duraklat
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="toggleListingStatus(${product.id}, 'sold', this)" title="Satıldı olarak işaretle">
                          <i class="fas fa-check me-1"></i>Satıldı
                        </button>
                      ` : product.status === 'paused' ? `
                        <button class="btn btn-sm btn-outline-success" onclick="toggleListingStatus(${product.id}, 'active', this)" title="İlanı aktifleştir">
                          <i class="fas fa-play me-1"></i>Aktifleştir
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="toggleListingStatus(${product.id}, 'sold', this)" title="Satıldı olarak işaretle">
                          <i class="fas fa-check me-1"></i>Satıldı
                        </button>
                      ` : ''}
                    ` : ''}
                    ${options.showDelete ? `
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteListingGlobal(${product.id}, this)" style="background-color:#dc3545;color:white;" title="İlanı sil">
                      <i class="fas fa-trash me-1"></i>Sil
                    </button>
                    ` : ''}
                  </div>
                `}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Backward compatibility - these now call the unified card
  function renderProductCard(product, options = {}) {
    return renderListingCard(product, { ...options, showActions: false, showStatus: false });
  }

  function renderProductListItem(product, options = {}) {
    return renderListingCard(product, { ...options, showActions: false, showStatus: false });
  }

  // Create DOM element function for advanced-search compatibility
  function createProductCardElement(product) {
    const div = document.createElement('div');
    div.innerHTML = renderProductListItem(product);
    return div.firstElementChild;
  }

  // Global olarak erişilebilir yap
  window.ProductCard = {
    // Main unified card
    renderListingCard: renderListingCard,

    // Backward compatibility
    renderCard: renderProductCard,
    renderListItem: renderProductListItem,
    create: createProductCardElement,

    // Utility functions
    escapeHtml: escapeHtml,
    formatPrice: formatPrice,
    formatDate: formatDate,
    formatFullDate: formatFullDate,
    getStatusInfo: getStatusInfo
  };

  // Global favorite toggle function (her sayfada aynı)
  window.toggleFavorite = function(productId, btn) {
    console.log('Toggle favorite called for product:', productId);

    // If FAV system is available, use it
    if (window.FAV && window.FAV.toggleFavButton) {
      // Set up button for FAV system
      btn.dataset.listingId = productId;

      // Call FAV system directly
      window.FAV.toggleFavButton(btn);
      console.log('Using FAV system for toggle');
    } else {
      // Simple fallback toggle
      btn.classList.toggle('active');

      if (btn.classList.contains('active')) {
        btn.innerHTML = '<i class="fas fa-heart"></i>';
        btn.title = 'Favorilerden çıkar';
      } else {
        btn.innerHTML = '<i class="far fa-heart"></i>';
        btn.title = 'Favorilere ekle';
      }

      console.log('Using fallback toggle (FAV system not available)');
    }
  };

  // Global listing status toggle function
  window.toggleListingStatus = async function(listingId, newStatus, btnElement) {
    if (!confirm(`İlanı ${newStatus === 'active' ? 'aktifleştir' : newStatus === 'paused' ? 'duraklat' : 'satıldı olarak işaretle'}mek istediğinize emin misiniz?`)) return;

    const originalHtml = btnElement.innerHTML;
    btnElement.disabled = true;
    btnElement.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Güncelleniyor...';

    try {
      const API_BASE = window.getCorrectApiBase ? window.getCorrectApiBase() : (window.APP && window.APP.API_BASE) || '';
      const response = await fetch(`${API_BASE}/api/listings/${listingId}/status`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        // Show success message
        const successMsg = document.createElement('div');
        successMsg.className = 'alert alert-success position-fixed';
        successMsg.style.top = '20px';
        successMsg.style.right = '20px';
        successMsg.style.zIndex = '9999';
        successMsg.innerHTML = `<i class="fas fa-check me-2"></i>İlan durumu güncellendi!`;
        document.body.appendChild(successMsg);
        setTimeout(() => successMsg.remove(), 3000);

        // Refresh the page to show updated status
        setTimeout(() => location.reload(), 1000);
      } else {
        throw new Error('Durum güncellenemedi');
      }
    } catch(e) {
      console.error(e);
      alert('İlan durumu güncellenemedi: ' + (e.message || 'Bilinmeyen hata'));
      btnElement.disabled = false;
      btnElement.innerHTML = originalHtml;
    }
  };

  // Global listing delete function
  window.deleteListingGlobal = async function(listingId, btnElement) {
    if (!confirm('Bu ilanı kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return;

    const originalHtml = btnElement.innerHTML;
    btnElement.disabled = true;
    btnElement.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Siliniyor...';

    try {
      const API_BASE = window.getCorrectApiBase ? window.getCorrectApiBase() : (window.APP && window.APP.API_BASE) || '';
      const response = await fetch(`${API_BASE}/api/listings/${listingId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        // Show success message
        const successMsg = document.createElement('div');
        successMsg.className = 'alert alert-success position-fixed';
        successMsg.style.top = '20px';
        successMsg.style.right = '20px';
        successMsg.style.zIndex = '9999';
        successMsg.innerHTML = `<i class="fas fa-check me-2"></i>İlan başarıyla silindi!`;
        document.body.appendChild(successMsg);
        setTimeout(() => successMsg.remove(), 3000);

        // Remove the listing from the page
        const listingElement = btnElement.closest('.list-product-item, .product-card');
        if (listingElement) {
          listingElement.style.transition = 'opacity 0.5s ease';
          listingElement.style.opacity = '0';
          setTimeout(() => listingElement.remove(), 500);
        }
      } else {
        throw new Error(data.error || 'İlan silinemedi');
      }
    } catch(e) {
      console.error(e);
      alert('İlan silinemedi: ' + (e.message || 'Bilinmeyen hata'));
      btnElement.disabled = false;
      btnElement.innerHTML = originalHtml;
    }
  };

})();