// frontend/public/js/pages/listing.js
// İlan detay sayfası modülü

(async function() {
  'use strict';

  // API base URL'ini al
  const API_BASE = window.getCorrectApiBase ? window.getCorrectApiBase() : (window.APP && window.APP.API_BASE) || '';

  // Utility functions
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => parent.querySelectorAll(selector);

  // URL'den slug veya id parametresini al
  const urlParams = new URLSearchParams(window.location.search);
  const slug = urlParams.get('slug');
  const id = urlParams.get('id');

  if (!slug && !id) {
    showError('İlan bulunamadı');
    return;
  }

  // Dom elementleri
  const elements = {
    title: $('#title'),
    meta: $('#meta'),
    price: $('#price'),
    badges: $('#badges'),
    desc: $('#desc'),
    gallery: $('#gallery'),
    sellerName: $('#sellerName'),
    sellerShopName: $('#sellerShopName'),
    sellerUsername: $('#sellerUsername'),
    sellerAvatar: $('#sellerAvatar'),
    sellerMemberSince: $('#sellerMemberSince'),
    sellerRating: $('#sellerRating'),
    sellerSales: $('#sellerSales'),
    sellerCity: $('#sellerCity'),
    sellerVerified: $('#sellerVerified'),
    btnBuy: $('#btnBuy'),
    btnTrade: $('#btnTrade'),
    btnFav: $('#btnFav'),
    btnEdit: $('#btnEdit'),
    btnMessageSeller: $('#btnMessageSeller'),
    btnSellerListings: $('#btnSellerListings'),
    btnSellerListingsText: $('#btnSellerListingsText'),
    ownerActions: $('#ownerActions'),
    publicActions: $('#publicActions')
  };

  // Listing data
  let currentListing = null;
  let currentUser = null;

  // API helper function
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

  // Load listing data
  async function loadListing() {
    try {
      // slug varsa slug ile, yoksa id ile API çağrısı yap
      const identifier = slug || id;
      const response = await apiRequest(`/api/listings/${encodeURIComponent(identifier)}`);
      console.log('API Response:', response);

      if (response && response.listing) {
        currentListing = response;
        renderListing();
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Load listing error:', error);
      showError('İlan yüklenirken hata oluştu');
    }
  }

  // Load current user
  async function loadCurrentUser() {
    try {
      currentUser = await apiRequest('/api/auth/me');
    } catch (error) {
      console.log('User not logged in');
    }
  }

  // Render listing
  function renderListing() {
    if (!currentListing) return;

    const listing = currentListing.listing;
    const seller = listing.owner_public;

    // Title and meta
    if (elements.title) {
      elements.title.textContent = listing.title;
      document.title = `${listing.title} | Eskisini Ver Yenisini Al`;
    }

    // Meta information
    if (elements.meta) {
      elements.meta.innerHTML = `
        <div class="meta-item">
          <i class="fas fa-calendar-alt"></i>
          <span>${formatDate(listing.created_at)}</span>
        </div>
        <div class="meta-item">
          <i class="fas fa-map-marker-alt"></i>
          <span>${listing.location_city || 'Konum belirtilmemiş'}</span>
        </div>
        <div class="meta-item">
          <i class="fas fa-eye"></i>
          <span>${listing.view_count || 0} görüntülenme</span>
        </div>
      `;
    }

    // Price
    if (elements.price) {
      const currency = listing.currency === 'TRY' ? '₺' : '$';
      const price = (listing.price_minor / 100).toLocaleString();
      elements.price.textContent = `${currency}${price}`;
    }

    // Badges
    if (elements.badges) {
      const badges = [];

      // Status badge (sadece owner görsün)
      if (listing.is_owner && listing.status) {
        const statusInfo = getStatusInfo(listing.status);
        badges.push(`<span class="badge ${statusInfo.class}">${statusInfo.text}</span>`);
      }

      if (listing.condition_grade) {
        badges.push(`<span class="condition-badge condition-${listing.condition_grade}">${formatCondition(listing.condition_grade)}</span>`);
      }
      if (listing.allow_trade) {
        badges.push(`<span class="condition-badge" style="background: #ecfdf5; color: #059669;">🔄 Takasa Uygun</span>`);
      }
      elements.badges.innerHTML = badges.join('');
    }

    // Description
    if (elements.desc) {
      elements.desc.innerHTML = listing.description_md ?
        parseMarkdown(listing.description_md) :
        '<p>Açıklama bulunmamaktadır.</p>';
    }

    // Gallery
    if (elements.gallery) {
      const images = listing.images || [];
      const imageUrls = images.map(img => img.file_url || img.thumb_url).filter(Boolean);
      renderGallery(imageUrls);
    }

    // Seller information
    if (seller) {
      renderSeller(seller);
    }

    // Track shop view event (only if seller has a shop)
    const hasStore = seller?.business_name;
    if (seller && hasStore && seller.shop_id) {
      trackShopEvent('view', seller.shop_id, listing.id);
      console.log(`🏪 Tracking shop view for shop ${seller.shop_id}`);

      // Setup contact tracking with delay to ensure DOM is ready
      setTimeout(() => {
        const messageBtn = document.getElementById('btnMessageSeller');
        if (messageBtn) {
          messageBtn.addEventListener('click', () => {
            trackShopEvent('contact_click', seller.shop_id, listing.id);
            console.log(`📞 Tracking contact click for shop ${seller.shop_id}`);
          });
          console.log('✅ Contact tracking setup for shop', seller.shop_id);
        } else {
          console.log('❌ Message button not found for tracking');
        }
      }, 100);
    }

    // Action buttons
    setupActionButtons();

    // Owner controls
    setupOwnerControls();
  }

  // Render gallery
  function renderGallery(images) {
    if (!images || images.length === 0) {
      elements.gallery.innerHTML = `
        <div class="main-image" style="display: flex; align-items: center; justify-content: center; background: #f8fafc; color: #9ca3af;">
          <div style="text-align: center;">
            <i class="fas fa-image" style="font-size: 3rem; margin-bottom: 1rem;"></i>
            <p>Görsel bulunmamaktadır</p>
          </div>
        </div>
      `;
      return;
    }

    elements.gallery.innerHTML = `
      <img src="${images[0]}" alt="Ürün görseli" class="main-image" id="mainImage">
      ${images.length > 1 ? `
        <div class="thumbnail-strip">
          ${images.map((img, index) => `
            <img src="${img}" alt="Ürün görseli ${index + 1}"
                 onclick="changeMainImage('${img}')"
                 class="thumbnail ${index === 0 ? 'active' : ''}">
          `).join('')}
        </div>
      ` : ''}
    `;
  }

  // Change main image
  window.changeMainImage = function(src) {
    const mainImg = $('#mainImage');
    const thumbs = $$('.thumbnail');

    if (mainImg) mainImg.src = src;

    thumbs.forEach(thumb => {
      thumb.classList.toggle('active', thumb.src === src);
    });
  };

  // Render seller
  function renderSeller(seller) {
    if (!seller) return;

    // Debug: Log seller object to console
    console.log('🛍️ Full Seller data:', seller);
    console.log('🛍️ Seller keys:', Object.keys(seller));

    // Check if seller has a store (business_name indicates a store)
    const hasStore = seller.business_name;
    console.log('🏪 Has store:', hasStore);
    console.log('🏪 business_name:', seller.business_name);
    console.log('🏪 display_name:', seller.display_name);

    // Set store attribute on seller card
    const sellerCard = $('#sellerCard');
    if (sellerCard) {
      sellerCard.setAttribute('data-store', hasStore ? 'true' : 'false');
    }

    // New HTML elements for restructured layout
    const sellerShopName = $('#sellerShopName');
    const sellerNameElement = $('#sellerName');

    // Always get the person's name first
    const personName = seller.display_name || seller.username || 'İsimsiz Satıcı';

    if (hasStore) {
      // STORE MODE: Show business information
      const storeName = seller.business_name;

      // Line 2: Shop/Store Name (actual store name)
      if (sellerShopName) sellerShopName.textContent = storeName;

      // Line 3: Store Owner's Name (the actual person)
      if (sellerNameElement) sellerNameElement.textContent = personName;

      // Dynamic button text for store
      if (elements.btnSellerListingsText) {
        const shortStoreName = storeName.split(' ')[0];
        elements.btnSellerListingsText.textContent = `${shortStoreName} Mağaza İlanları`;
      }

    } else {
      // INDIVIDUAL MODE: Show personal information
      const shopName = `${personName}'nın Dükkanı`;

      // Line 2: Shop Name (person's virtual shop)
      if (sellerShopName) sellerShopName.textContent = shopName;

      // Line 3: Seller Name (the person)
      if (sellerNameElement) sellerNameElement.textContent = personName;

      // Dynamic button text for individual
      if (elements.btnSellerListingsText) {
        const firstName = personName.split(' ')[0];
        elements.btnSellerListingsText.textContent = `${firstName}'nın Tüm İlanları`;
      }
    }

    // Common avatar logic
    if (elements.sellerAvatar) {
      const logoUrl = hasStore ? (seller.store_logo || seller.logo_url || seller.avatar_url) : (seller.avatar_url || seller.logo_url);
      elements.sellerAvatar.src = logoUrl || '/assets/default-avatar.png';
      elements.sellerAvatar.onerror = () => {
        elements.sellerAvatar.src = '/assets/default-avatar.png';
        elements.sellerAvatar.onerror = null;
      };
    }

    // Member since - for stores show different text
    if (elements.sellerMemberSince) {
      if (hasStore) {
        elements.sellerMemberSince.textContent = seller.member_since ? `Kayıt: ${formatDate(seller.member_since)}` : '';
      } else {
        elements.sellerMemberSince.textContent = seller.member_since ? `Üye: ${formatDate(seller.member_since)}` : '';
      }
    }

    // Common stats
    if (elements.sellerRating) {
      if (seller.rating_avg) {
        const rating = parseFloat(seller.rating_avg);
        elements.sellerRating.innerHTML = `${rating.toFixed(1)}<span class="rating-stars">⭐</span>`;
      } else {
        elements.sellerRating.textContent = '—';
      }
    }
    if (elements.sellerSales) elements.sellerSales.textContent = seller.sales_count || '0';
    if (elements.sellerCity) elements.sellerCity.textContent = seller.city || currentListing.listing.location_city || 'Türkiye';

    // Verified badge
    if (elements.sellerVerified && seller.verified) {
      elements.sellerVerified.hidden = false;
    }

    // Seller action buttons
    if (elements.btnMessageSeller) {
      // Send both user and listing parameters for better context
      elements.btnMessageSeller.href = `/thread.html?user=${seller.id}&listing=${currentListing.listing.id}`;
      // Track contact click for shops
      if (seller.business_name && seller.shop_id) {
        elements.btnMessageSeller.onclick = () => {
          trackShopEvent('contact_click', seller.shop_id, currentListing.listing.id);
          console.log(`📞 Tracking contact click for shop ${seller.shop_id}`);
          // Allow default behavior (navigation) to continue
          return true;
        };
      }
    }
    if (elements.btnSellerListings) {
      elements.btnSellerListings.href = `/seller-profile.html?id=${seller.id}`;
    }
  }

  // Setup action buttons
  function setupActionButtons() {
    if (!currentListing) return;

    const listing = currentListing.listing;
    const isOwner = listing.is_owner || (currentUser && currentUser.user && listing.owner_public && currentUser.user.id === listing.owner_public.id);

    // Get new buttons
    const btnAddToCart = document.getElementById('btnAddToCart');
    const btnBuyNow = document.getElementById('btnBuyNow');

    // Add listing ID to buttons
    if (btnAddToCart) {
      btnAddToCart.dataset.listingId = listing.id;
      if (isOwner) {
        btnAddToCart.textContent = 'Kendi İlanınız';
        btnAddToCart.disabled = true;
      }
    }

    if (btnBuyNow) {
      btnBuyNow.dataset.listingId = listing.id;
      if (isOwner) {
        btnBuyNow.textContent = 'Kendi İlanınız';
        btnBuyNow.disabled = true;
      }
    }

    // Legacy buy button (if exists)
    if (elements.btnBuy) {
      if (isOwner) {
        elements.btnBuy.textContent = 'Kendi İlanınız';
        elements.btnBuy.disabled = true;
      } else {
        elements.btnBuy.onclick = handleBuy;
      }
    }

    // Trade button
    if (elements.btnTrade) {
      if (isOwner) {
        elements.btnTrade.textContent = 'Kendi İlanınız';
        elements.btnTrade.disabled = true;
      } else if (!listing.allow_trade) {
        elements.btnTrade.textContent = 'Takas Mümkün Değil';
        elements.btnTrade.disabled = true;
      } else {
        elements.btnTrade.onclick = handleTrade;
      }
    }

    // Favorite button
    if (elements.btnFav) {
      if (isOwner) {
        elements.btnFav.style.display = 'none';
      } else {
        elements.btnFav.onclick = handleFavorite;
        updateFavoriteButton();
      }
    }
  }

  // Handle buy
  async function handleBuy() {
    if (!currentUser) {
      window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.href);
      return;
    }

    if (confirm('Bu ürünü satın almak istediğinizden emin misiniz?')) {
      try {
        const listing = currentListing.listing;
        await apiRequest('/api/orders', {
          method: 'POST',
          body: JSON.stringify({
            listing_id: listing.id,
            qty: 1
          })
        });

        alert('Siparişiniz oluşturuldu! Profilinizden takip edebilirsiniz.');
        window.location.href = '/profile.html?tab=orders';
      } catch (error) {
        alert('Satın alma işlemi başarısız. Lütfen tekrar deneyin.');
      }
    }
  }

  // Handle trade
  async function handleTrade() {
    if (!currentUser) {
      window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.href);
      return;
    }

    const tradeText = prompt('Takas teklifinizi yazın (hangi ürünü veriyorsunuz?):');
    if (!tradeText) return;

    const cashAdjust = prompt('Ek nakit teklifi (TL, opsiyonel):') || '0';

    try {
      const listing = currentListing.listing;
      await apiRequest('/api/trade/offer', {
        method: 'POST',
        body: JSON.stringify({
          listing_id: listing.id,
          offered_text: tradeText,
          cash_adjust_minor: parseInt(cashAdjust) * 100
        })
      });

      alert('Takas teklifiniz gönderildi!');
    } catch (error) {
      alert('Takas teklifi gönderilemedi. Lütfen tekrar deneyin.');
    }
  }

  // Handle favorite
  async function handleFavorite() {
    if (!currentUser) {
      window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.href);
      return;
    }

    try {
      const listing = currentListing.listing;
      const isFavorited = elements.btnFav.classList.contains('favorited');

      if (isFavorited) {
        await apiRequest(`/api/favorites/${listing.id}`, {
          method: 'DELETE'
        });
      } else {
        await apiRequest(`/api/favorites/${listing.id}`, {
          method: 'POST'
        });
      }

      updateFavoriteButton();
    } catch (error) {
      alert('İşlem başarısız. Lütfen tekrar deneyin.');
    }
  }

  // Update favorite button
  async function updateFavoriteButton() {
    if (!currentUser || !elements.btnFav || !currentListing) return;

    try {
      const listing = currentListing.listing;
      const favorites = await apiRequest('/api/favorites/my');
      const favData = favorites.data || favorites.favorites || [];
      const isFavorited = Array.isArray(favData) && favData.some(fav => fav.listing_id === listing.id);

      elements.btnFav.classList.toggle('favorited', isFavorited);
      elements.btnFav.innerHTML = isFavorited ?
        '<i class="fas fa-heart"></i> Favorilerden Çıkar' :
        '<i class="far fa-heart"></i> Favoriye Ekle';
    } catch (error) {
      console.error('Favorite status update failed:', error);
    }
  }

  // Utility functions
  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('tr-TR');
  }

  function formatCondition(condition) {
    const conditions = {
      'new': 'Yeni',
      'like_new': 'Çok İyi',
      'good': 'İyi',
      'fair': 'Orta',
      'poor': 'Zayıf'
    };
    return conditions[condition] || condition;
  }

  function parseMarkdown(text) {
    // Basit markdown parse (gerçek uygulamada marked.js vs kullanılabilir)
    return text
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  }

  function getStatusInfo(status) {
    const statusMap = {
      'active': { text: 'Aktif', class: 'badge-success' },
      'sold': { text: 'Satıldı', class: 'badge-warning' },
      'pending_review': { text: 'İnceleme Bekliyor', class: 'badge-info' },
      'rejected': { text: 'Reddedildi', class: 'badge-danger' },
      'paused': { text: 'Pasif', class: 'badge-secondary' },
      'draft': { text: 'Taslak', class: 'badge-secondary' }
    };
    return statusMap[status] || { text: status, class: 'badge-secondary' };
  }

  function showError(message) {
    const main = $('main');
    if (main) {
      main.innerHTML = `
        <div class="container section text-center">
          <h1>Hata</h1>
          <p>${message}</p>
          <a href="/" class="btn btn-primary">Ana Sayfaya Dön</a>
        </div>
      `;
    }
  }

  // Setup owner controls
  function setupOwnerControls() {
    const listing = currentListing?.listing;
    if (!listing || !listing.is_owner) {
      return;
    }

    // Show owner actions, hide public actions
    if (elements.ownerActions) {
      elements.ownerActions.style.display = '';
    }
    if (elements.publicActions) {
      elements.publicActions.style.display = 'none';
    }

    // Setup edit button
    if (elements.btnEdit) {
      elements.btnEdit.href = `/sell.html?edit=${listing.id}`;
    }
  }

  // Delete current listing function (global)
  window.deleteCurrentListing = async function() {
    if (!listing || !listing.id) {
      alert('İlan bilgisi bulunamadı');
      return;
    }

    if (!confirm('Bu ilanı kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
      return;
    }

    const deleteBtn = $('#btnDelete');
    if (deleteBtn) {
      deleteBtn.disabled = true;
      deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Siliniyor...';
    }

    try {
      const response = await fetch(`${API_BASE}/api/listings/${listing.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        alert('İlan başarıyla silindi');
        // Redirect to profile or homepage
        window.location.href = '/profile.html?tab=mylistings';
      } else {
        throw new Error(data.error || 'İlan silinemedi');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('İlan silinemedi: ' + (error.message || 'Bilinmeyen hata'));

      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Sil';
      }
    }
  };

  // Shop Statistics Tracking
  async function trackShopEvent(eventType, shopId, listingId = null) {
    try {
      const response = await fetch(`${API_BASE}/api/shop/track-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          event_type: eventType,
          shop_id: shopId,
          listing_id: listingId
        })
      });

      if (response.ok) {
        console.log(`📊 Tracked: ${eventType} for shop ${shopId}`);
      }
    } catch (error) {
      console.error('Tracking error:', error);
      // Don't show errors to user for tracking
    }
  }

  // Initialize
  async function init() {
    await loadCurrentUser();
    await loadListing();
  }

  // Initialize listing page when dependencies are ready
  function startListing() {
    console.log('🚀 Listing.js: Starting listing page initialization');
    console.log('🚀 Listing.js: API_BASE available:', API_BASE);

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  // Wait for dependencies to be loaded before starting
  if (window.dependenciesLoadedTriggered) {
    console.log('🚀 Listing.js: Dependencies already loaded, starting immediately');
    startListing();
  } else {
    console.log('🚀 Listing.js: Waiting for dependencies to load...');
    document.addEventListener('dependenciesLoaded', function() {
      console.log('🚀 Listing.js: Dependencies loaded event received, starting listing');
      startListing();
    });
  }

})();