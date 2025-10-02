// Seller Profile Page JavaScript
(function() {
  'use strict';

  class SellerProfilePage {
    constructor() {
      console.log('SellerProfilePage: Constructor called');
      this.sellerId = null;
      this.sellerData = null;
      this.currentTab = 'listings';
      this.currentPage = 1;
      this.itemsPerPage = 12;

      this.init();
    }

    async init() {
      await this.loadPartials();
      this.getSellerId();

      if (this.sellerId) {
        await this.loadSellerData();
        this.setupEventListeners();
        this.loadTabContent();
      } else {
        this.showError('Satıcı bulunamadı');
      }
    }

    async loadPartials() {
      if (typeof includePartials === 'function') {
        await includePartials();
      }
    }

    getSellerId() {
      const urlParams = new URLSearchParams(window.location.search);
      this.sellerId = urlParams.get('id') || urlParams.get('seller') || urlParams.get('user');

      if (!this.sellerId) {
        const pathParts = window.location.pathname.split('/');
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart && !lastPart.includes('.html')) {
          this.sellerId = lastPart;
        }
      }
    }

    async loadSellerData() {
      try {
        console.log('Loading seller data for ID:', this.sellerId);
        const response = await fetch(`${window.getCorrectApiBase ? window.getCorrectApiBase() : (window.APP && window.APP.API_BASE) || ''}/api/sellers/${this.sellerId}`);
        console.log('Seller API response:', response.status);

        if (response.ok) {
          this.sellerData = await response.json();
          console.log('Seller data loaded:', this.sellerData);
          this.renderSellerInfo();
        } else {
          throw new Error('Satıcı bilgileri yüklenemedi');
        }
      } catch (error) {
        console.error('Error loading seller data:', error);
        this.showError('Satıcı bilgileri yüklenirken hata oluştu');
      }
    }

    renderSellerInfo() {
      if (!this.sellerData) return;

      const seller = this.sellerData.seller || this.sellerData;

      // Basic info
      document.getElementById('sellerDisplayName').textContent = seller.display_name || seller.business_name || 'İsimsiz Satıcı';
      document.getElementById('sellerLocation').innerHTML = `<i class="fas fa-map-marker-alt me-2"></i>${seller.city || 'Türkiye'}`;

      // Avatar
      const avatar = document.getElementById('sellerAvatar');
      if (avatar) {
        avatar.src = seller.logo_url || seller.avatar_url || '/assets/default-avatar.png';
        avatar.onerror = () => avatar.src = '/assets/default-avatar.png';
      }

      // Badge
      const badge = document.getElementById('sellerBadge');
      if (seller.is_verified && badge) {
        badge.classList.remove('d-none');
        badge.classList.add('bg-success');
        badge.innerHTML = '<i class="fas fa-check"></i>';
      }

      // Stats
      document.getElementById('totalSales').textContent = seller.total_sales || '0';
      document.getElementById('avgRating').textContent = seller.rating_avg ? Number(seller.rating_avg).toFixed(1) : '—';
      document.getElementById('activeListings').textContent = seller.active_listings || '0';

      // Verifications
      this.renderVerifications(seller);

      // Page title
      document.title = `${seller.display_name || seller.business_name || 'Satıcı'} | Eskisini Ver Yenisini Al`;

      // About tab
      const description = document.getElementById('sellerDescription');
      if (description && seller.description) {
        description.textContent = seller.description;
      }

      // Member since
      const memberSince = document.getElementById('memberSince');
      if (memberSince && seller.created_at) {
        memberSince.textContent = this.formatDate(seller.created_at);
      }
    }

    renderVerifications(seller) {
      const container = document.getElementById('sellerVerifications');
      if (!container) return;

      const badges = [];

      if (seller.is_verified) {
        badges.push('<span class="badge bg-success"><i class="fas fa-check-circle me-1"></i>Doğrulanmış</span>');
      }

      if (seller.seller_type === 'super') {
        badges.push('<span class="badge bg-warning"><i class="fas fa-crown me-1"></i>Süper Satıcı</span>');
      } else if (seller.seller_type === 'active') {
        badges.push('<span class="badge bg-info"><i class="fas fa-star me-1"></i>Aktif Satıcı</span>');
      }

      if (seller.phone_verified) {
        badges.push('<span class="badge bg-primary"><i class="fas fa-phone me-1"></i>Telefon</span>');
      }

      if (seller.email_verified) {
        badges.push('<span class="badge bg-secondary"><i class="fas fa-envelope me-1"></i>E-posta</span>');
      }

      container.innerHTML = badges.join(' ');
    }

    setupEventListeners() {
      // Listen for auth:login event to re-render with owner permissions
      document.addEventListener('auth:login', () => {
        console.log('🔐 Auth login detected, reloading listings with owner check...');
        this.loadListings();
      });

      // Tab navigation
      document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab => {
        tab.addEventListener('shown.bs.tab', (e) => {
          const target = e.target.getAttribute('data-bs-target');
          if (target === '#nav-listings') {
            this.currentTab = 'listings';
            this.loadListings();
          } else if (target === '#nav-reviews') {
            this.currentTab = 'reviews';
            this.loadReviews();
          }
        });
      });

      // Sort change
      const sortSelect = document.getElementById('sortSelect');
      if (sortSelect) {
        sortSelect.addEventListener('change', () => {
          this.currentPage = 1;
          this.loadListings();
        });
      }

      // Message button
      const btnMessage = document.getElementById('btnMessage');
      if (btnMessage) {
        btnMessage.addEventListener('click', () => {
          window.location.href = `/messages.html?seller=${this.sellerId}`;
        });
      }

      // Report button
      const btnReport = document.getElementById('btnReport');
      if (btnReport) {
        btnReport.addEventListener('click', () => {
          // TODO: Implement report functionality
          alert('Şikayet sistemi yakında aktif olacak');
        });
      }
    }

    loadTabContent() {
      // Load default tab content
      this.loadListings();
    }

    async loadListings() {
      try {
        const sortBy = document.getElementById('sortSelect')?.value || 'newest';
        const url = `${window.getCorrectApiBase ? window.getCorrectApiBase() : (window.APP && window.APP.API_BASE) || ''}/api/listings/search?seller_id=${this.sellerId}&status=active&sort=${sortBy}&page=${this.currentPage}&size=${this.itemsPerPage}`;
        console.log('Loading listings from:', url);
        const response = await fetch(url);

        if (response.ok) {
          const data = await response.json();
          console.log('Listings response data:', data);
          const listings = data.items || [];
          const total = listings.length || 0;
          console.log('Total listings count:', total);

          this.renderListings(listings);
          this.renderPagination(data.paging || {});
          this.updateListingsCount(total);
        } else {
          throw new Error('İlanlar yüklenemedi');
        }
      } catch (error) {
        console.error('Error loading listings:', error);
        this.showListingsError();
      }
    }

    renderListings(listings) {
      const container = document.getElementById('listingsGrid');
      if (!container) return;

      if (!listings.length) {
        container.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
            <i class="fas fa-box-open fa-3x text-muted mb-3"></i>
            <h5>Bu satıcının henüz aktif ilanı yok</h5>
            <p class="text-muted">Yakında yeni ilanlar eklenebilir</p>
          </div>
        `;
        return;
      }

      // Check if ProductCard component is available
      if (window.ProductCard && window.ProductCard.renderListingCard) {
        // Get current user from window.currentUser (set by header.js)
        const currentUser = window.currentUser || null;

        // Check if the logged-in user is the owner of this shop
        // User ID should match seller ID (fatihtunali is user_id=4 and also seller_id=4)
        const isOwnShop = currentUser &&
                         currentUser.id &&
                         parseInt(currentUser.id) === parseInt(this.sellerId);

        console.log('🔍 Owner check:', {
          isOwnShop,
          currentUserId: currentUser?.id,
          pageSellerId: this.sellerId,
          userName: currentUser?.full_name,
          userHasShop: currentUser?.has_shop,
          windowCurrentUser: window.currentUser ? 'SET' : 'NULL'
        });

        const html = listings.map(listing => {
          const product = {
            id: listing.id,
            slug: listing.slug,
            title: listing.title,
            price_minor: listing.price_minor,
            currency: listing.currency || 'TRY',
            cover_url: listing.cover_url,
            location_city: listing.location_city || listing.city || 'Türkiye',
            view_count: listing.view_count || 0,
            created_at: listing.created_at,
            category_name: listing.category_name || '',
            status: listing.status || 'active'
          };

          // If owner viewing their own shop: Show My Listings style (Edit/Delete/Status buttons)
          // If public/other user viewing: Show public style (Buy/Details buttons like index.html)
          if (isOwnShop) {
            return window.ProductCard.renderListingCard(product, {
              showActions: true,      // Show action buttons instead of buy button
              showStatus: true,       // Show status badges
              showEdit: true,         // Show edit button
              showDelete: true,       // Show delete button
              showStatusButtons: true // Show pause/activate/sold buttons
            });
          } else {
            return window.ProductCard.renderListingCard(product, {
              showActions: false,     // Show buy/details buttons
              showStatus: false       // Hide status badges
            });
          }
        }).join('');

        container.innerHTML = html;
        console.log('✅ Listings rendered:', listings.length, '| Mode:', isOwnShop ? 'MY LISTINGS (Owner)' : 'PUBLIC (Visitor)');
      } else {
        console.error('❌ ProductCard component not available in seller-profile.js!');
        container.innerHTML = '<div style="text-align: center; padding: 2rem;"><p class="text-danger">ProductCard component yüklenemedi.</p></div>';
      }
    }

    updateListingsCount(total) {
      const counter = document.getElementById('listingsCount');
      if (counter) {
        counter.textContent = `${total} ilan bulundu`;
      }
    }

    renderPagination(pagination) {
      const container = document.getElementById('paginationControls');
      if (!container || !pagination.total_pages || pagination.total_pages <= 1) {
        container.innerHTML = '';
        return;
      }

      let html = '';
      const currentPage = pagination.current_page || 1;
      const totalPages = pagination.total_pages;

      // Previous button
      if (currentPage > 1) {
        html += `<li class="page-item"><a class="page-link" href="#" data-page="${currentPage - 1}">Önceki</a></li>`;
      }

      // Page numbers
      const startPage = Math.max(1, currentPage - 2);
      const endPage = Math.min(totalPages, currentPage + 2);

      for (let i = startPage; i <= endPage; i++) {
        const active = i === currentPage ? 'active' : '';
        html += `<li class="page-item ${active}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
      }

      // Next button
      if (currentPage < totalPages) {
        html += `<li class="page-item"><a class="page-link" href="#" data-page="${currentPage + 1}">Sonraki</a></li>`;
      }

      container.innerHTML = html;

      // Add click events
      container.querySelectorAll('[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          this.currentPage = parseInt(e.target.dataset.page);
          this.loadListings();
        });
      });
    }

    async loadReviews() {
      try {
        const response = await fetch(
          `${window.getCorrectApiBase ? window.getCorrectApiBase() : (window.APP && window.APP.API_BASE) || ''}/api/sellers/${this.sellerId}/reviews`
        );

        if (response.ok) {
          const data = await response.json();
          this.renderReviews(data.reviews || []);
          this.renderRatingDistribution(data.distribution || {});
        } else {
          throw new Error('Değerlendirmeler yüklenemedi');
        }
      } catch (error) {
        console.error('Error loading reviews:', error);
        this.showReviewsError();
      }
    }

    renderReviews(reviews) {
      const container = document.getElementById('reviewsList');
      if (!container) return;

      if (!reviews.length) {
        container.innerHTML = `
          <div class="text-center py-5">
            <i class="fas fa-star-half-alt fa-3x text-muted mb-3"></i>
            <h5>Henüz değerlendirme yok</h5>
            <p class="text-muted">Bu satıcı için henüz değerlendirme yapılmamış</p>
          </div>
        `;
        return;
      }

      const html = reviews.map(review => `
        <div class="review-item">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div class="d-flex align-items-center">
              <img src="${review.reviewer_avatar || '/assets/default-avatar.png'}"
                   alt="${review.reviewer_name}"
                   class="rounded-circle me-2"
                   width="40" height="40"
                   onerror="this.src='/assets/default-avatar.png'">
              <div>
                <h6 class="mb-0">${review.reviewer_name || 'Anonim'}</h6>
                <small class="text-muted">${this.formatDate(review.created_at)}</small>
              </div>
            </div>
            <div class="review-rating">
              ${this.generateStars(review.rating)}
            </div>
          </div>

          ${review.review_text ? `<p class="mb-0">${review.review_text}</p>` : ''}
        </div>
      `).join('');

      container.innerHTML = html;
    }

    renderRatingDistribution(distribution) {
      const container = document.getElementById('ratingDistribution');
      if (!container) return;

      const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);

      if (total === 0) {
        container.innerHTML = '<p class="text-muted small">Henüz değerlendirme yok</p>';
        return;
      }

      let html = '';
      for (let i = 5; i >= 1; i--) {
        const count = distribution[i] || 0;
        const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

        html += `
          <div class="d-flex align-items-center mb-2">
            <span class="me-2">${i} ${this.generateStars(i)}</span>
            <div class="flex-grow-1 me-2">
              <div class="progress" style="height: 8px;">
                <div class="progress-bar bg-warning" style="width: ${percentage}%"></div>
              </div>
            </div>
            <small class="text-muted">${count}</small>
          </div>
        `;
      }

      container.innerHTML = html;
    }

    generateStars(rating) {
      const fullStars = Math.floor(rating);
      const hasHalfStar = rating % 1 !== 0;
      let html = '';

      for (let i = 0; i < fullStars; i++) {
        html += '<i class="fas fa-star text-warning"></i>';
      }

      if (hasHalfStar) {
        html += '<i class="fas fa-star-half-alt text-warning"></i>';
      }

      const emptyStars = 5 - Math.ceil(rating);
      for (let i = 0; i < emptyStars; i++) {
        html += '<i class="far fa-star text-warning"></i>';
      }

      return html;
    }

    showError(message) {
      document.body.innerHTML = `
        <div class="container py-5">
          <div class="text-center">
            <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
            <h3>Bir hata oluştu</h3>
            <p class="text-muted">${message}</p>
            <a href="/" class="btn btn-primary">Ana Sayfaya Dön</a>
          </div>
        </div>
      `;
    }

    showListingsError() {
      const container = document.getElementById('listingsGrid');
      if (container) {
        container.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
            <i class="fas fa-exclamation-triangle fa-2x text-warning mb-3"></i>
            <p>İlanlar yüklenirken hata oluştu</p>
            <button class="btn btn-outline-primary" onclick="location.reload()">Tekrar Dene</button>
          </div>
        `;
      }
    }

    showReviewsError() {
      const container = document.getElementById('reviewsList');
      if (container) {
        container.innerHTML = `
          <div class="text-center py-4">
            <i class="fas fa-exclamation-triangle fa-2x text-warning mb-3"></i>
            <p>Değerlendirmeler yüklenirken hata oluştu</p>
            <button class="btn btn-outline-primary" onclick="location.reload()">Tekrar Dene</button>
          </div>
        `;
      }
    }

    formatDate(dateString) {
      if (!dateString) return '—';

      try {
        const date = new Date(dateString);
        return date.toLocaleDateString('tr-TR', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      } catch {
        return '—';
      }
    }
  }

  // Initialize when DOM is ready
  function initSellerProfile() {
    console.log('🎯 Initializing SellerProfilePage...');
    new SellerProfilePage();
  }

  if (document.readyState === 'loading') {
    // DOM hasn't loaded yet
    document.addEventListener('DOMContentLoaded', initSellerProfile);
  } else {
    // DOM already loaded (script loaded late via dependency manager)
    initSellerProfile();
  }

})();