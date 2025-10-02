// Homepage functionality
(function() {
  // Get API_BASE with fallback detection
  let API_BASE = '';
  if (window.APP && window.APP.API_BASE) {
    API_BASE = window.APP.API_BASE;
  } else if (window.GLOBAL_API_BASE) {
    API_BASE = window.GLOBAL_API_BASE;
  } else if (window.API_BASE) {
    API_BASE = window.API_BASE;
  } else {
    // Fallback detection if APP object not ready yet
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      API_BASE = 'http://localhost:3000';
    } else if (hostname === 'test.eskisiniveryenisinial.com') {
      API_BASE = 'https://api.eskisiniveryenisinial.com';
    } else {
      // Production fallback - always use production API
      API_BASE = 'https://api.eskisiniveryenisinial.com';
    }
  }

  console.log('🏠 Index.js: Using API_BASE:', API_BASE);

  // HTML escape function
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Categories data - will be fetched from database
  let categories = [];

  // Featured sellers will be loaded from API
  let featuredSellers = [];

  // Current state
  let currentProducts = [];
  let currentCategory = null;
  let currentView = 'list'; // 'list' or 'grid'
  let currentSort = 'newest';
  let currentPage = 1;
  const itemsPerPage = 20;

  // Initialize when DOM is loaded AND dependencies are ready
  function startHomepage() {
    console.log('🚀 Index.js: Starting homepage initialization');
    console.log('🚀 Index.js: API_BASE available:', API_BASE);
    console.log('🚀 Index.js: window.APP:', window.APP);

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeHomepage);
    } else {
      initializeHomepage();
    }
  }

  // Wait for dependencies to be loaded before starting
  if (window.dependenciesLoadedTriggered) {
    console.log('🚀 Index.js: Dependencies already loaded, starting immediately');
    startHomepage();
  } else {
    console.log('🚀 Index.js: Waiting for dependencies to load...');
    document.addEventListener('dependenciesLoaded', function() {
      console.log('🚀 Index.js: Dependencies loaded event received, starting homepage');
      startHomepage();
    });
  }

  function initializeHomepage() {
    console.log('🚀 Index.js: initializeHomepage called');
    loadCategories();
    loadFeaturedSellers();
    loadFeaturedProducts();
    setupEventListeners();
    console.log('🚀 Index.js: initializeHomepage completed');
  }

  async function loadCategories() {
    console.log('🏷️ Index.js: Loading categories from API:', API_BASE);
    try {
      const url = `${API_BASE}/api/categories`;
      console.log('🏷️ Index.js: Fetching categories from:', url);

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      console.log('🏷️ Index.js: Categories response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        categories = data.categories || [];
        console.log('✅ Index.js: Categories loaded successfully:', categories.length, 'categories');
      } else {
        console.error('❌ Index.js: Failed to load categories, status:', response.status);
        console.error('❌ Index.js: Response text:', await response.text());
        categories = [];
      }

      renderCategories();
    } catch (error) {
      console.error('❌ Index.js: Error loading categories:', error);
      console.error('❌ Index.js: This likely means API server is not reachable');
      categories = [];
      renderCategories();
    }
  }

  function renderCategories() {
    console.log('🏷️ Index.js: renderCategories called');
    console.log('🏷️ Index.js: categories array:', categories);
    console.log('🏷️ Index.js: categories.length:', categories.length);

    const categoriesTree = document.getElementById('categoriesTree');
    console.log('🏷️ Index.js: categoriesTree element:', categoriesTree);

    if (!categoriesTree) {
      console.error('❌ Index.js: categoriesTree element not found!');
      return;
    }

    if (categories.length === 0) {
      console.log('🏷️ Index.js: No categories to display, showing loading message');
      categoriesTree.innerHTML = '<div class="text-muted p-3">Kategoriler yükleniyor...</div>';
      return;
    }

    // Only show parent categories (parent_id = null)
    const parentCategories = categories.filter(category => !category.parent_id);
    console.log('🏷️ Index.js: parentCategories:', parentCategories);
    console.log('🏷️ Index.js: parentCategories.length:', parentCategories.length);

    const html = parentCategories.map(category => `
      <div class="category-item-wrapper">
        <a href="#" class="category-link" data-category="${category.id}">
          ${category.name}
        </a>
      </div>
    `).join('');

    console.log('🏷️ Index.js: Generated HTML:', html.substring(0, 200) + '...');
    categoriesTree.innerHTML = html;
    console.log('✅ Index.js: Categories rendered successfully');
  }

  async function loadFeaturedSellers() {
    try {
      const response = await fetch(`${API_BASE}/api/sellers/featured`, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      if (response.ok) {
        const data = await response.json();
        featuredSellers = data.sellers || data || [];
        console.log('Loaded featured sellers:', featuredSellers);
      } else {
        console.warn('Failed to load featured sellers:', response.status);
        // Fallback to sample data
        featuredSellers = [
          { user_id: 3, display_name: 'TechStore', rating_avg: 4.8, active_listings: 156 },
          { user_id: 4, display_name: 'ModaPoint', rating_avg: 4.9, active_listings: 89 },
          { user_id: 5, display_name: 'ElektroMart', rating_avg: 4.7, active_listings: 203 },
          { user_id: 6, display_name: 'HomeDecor', rating_avg: 4.6, active_listings: 67 }
        ];
      }
    } catch (error) {
      console.error('Error loading featured sellers:', error);
      // Fallback to sample data
      featuredSellers = [
        { user_id: 3, display_name: 'TechStore', rating_avg: 4.8, active_listings: 156 },
        { user_id: 4, display_name: 'ModaPoint', rating_avg: 4.9, active_listings: 89 },
        { user_id: 5, display_name: 'ElektroMart', rating_avg: 4.7, active_listings: 203 },
        { user_id: 6, display_name: 'HomeDecor', rating_avg: 4.6, active_listings: 67 }
      ];
    }

    renderFeaturedSellers();
  }

  function renderFeaturedSellers() {
    const sellersContainer = document.getElementById('featuredSellers');
    if (!sellersContainer) return;

    if (!featuredSellers.length) {
      sellersContainer.innerHTML = `
        <div class="text-center text-muted py-3">
          <p>Henüz öne çıkan satıcı bulunmuyor</p>
        </div>
      `;
      return;
    }

    // Render sellers in grid layout matching the HTML CSS
    const sellersHtml = featuredSellers.map(seller => {
      const name = seller.display_name || seller.business_name || seller.full_name || 'Satıcı';
      const rating = seller.rating_avg ? Number(seller.rating_avg).toFixed(1) : '0.0';
      const listings = seller.active_listings || seller.products || 0;
      const avatar = seller.logo_url || seller.avatar_url;
      const initials = name.charAt(0).toUpperCase();

      return `
        <a href="/seller-profile.html?id=${seller.user_id}" class="seller-card">
          <div class="seller-avatar">
            ${avatar ?
              `<img src="${avatar}" alt="${escapeHtml(name)}" onerror="this.style.display='none'">` :
              initials
            }
          </div>
          <div class="seller-name">${escapeHtml(name)}</div>
          <div class="seller-stats">
            <span class="seller-stat">
              <i class="fas fa-box"></i> ${listings}
            </span>
            ${seller.review_count ? `
            <span class="seller-stat">
              <i class="fas fa-comment"></i> ${seller.review_count}
            </span>
            ` : ''}
          </div>
          <div class="seller-rating">
            <i class="fas fa-star"></i> ${rating}
          </div>
          ${seller.is_verified ? '<span class="seller-badge"><i class="fas fa-check-circle"></i> Onaylı</span>' : ''}
          ${seller.is_premium ? '<span class="seller-badge premium-badge"><i class="fas fa-crown"></i> Premium</span>' : ''}
        </a>
      `;
    }).join('');

    // Add placeholder card for premium seller spot
    const placeholderCard = `
      <a href="/pricing.html" class="seller-card seller-card-placeholder">
        <div class="seller-avatar seller-avatar-placeholder">
          <i class="fas fa-crown"></i>
        </div>
        <div class="seller-name">Sizin Yeriniz</div>
        <div class="seller-placeholder-text">
          Öne çıkan satıcı olun, daha fazla müşteriye ulaşın!
        </div>
        <div class="seller-placeholder-cta">
          <i class="fas fa-arrow-right"></i> Premium'a Geç
        </div>
      </a>
    `;

    const html = `
      <div class="sellers-grid">
        ${sellersHtml}
        ${placeholderCard}
      </div>
    `;

    sellersContainer.innerHTML = html;
  }

  async function loadFeaturedProducts() {
    console.log('🛍️ Index.js: loadFeaturedProducts START');
    console.log('🛍️ Index.js: API_BASE:', API_BASE);

    const loadingIndicator = document.getElementById('loadingIndicator');
    const productsList = document.getElementById('productsList');

    console.log('🛍️ Index.js: loadingIndicator element:', loadingIndicator);
    console.log('🛍️ Index.js: productsList element:', productsList);

    if (loadingIndicator) loadingIndicator.style.display = 'block';

    try {
      // Use search endpoint to get all listings, optionally filtered by category
      const url = `${API_BASE}/api/listings/search?page=${currentPage}&limit=${itemsPerPage}&sort=${currentSort}${currentCategory ? `&category=${currentCategory}` : ''}`;
      console.log('🛍️ Index.js: Fetching products from:', url);

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      console.log('🛍️ Index.js: Response status:', response.status);
      console.log('🛍️ Index.js: Response ok:', response.ok);

      if (response.ok) {
        const data = await response.json();
        console.log('🛍️ Index.js: Response data:', data);
        currentProducts = data.listings || data.items || [];
        console.log('🛍️ Index.js: Loaded products count:', currentProducts.length);
      } else {
        console.error('❌ Index.js: Failed to load products, status:', response.status);
        const errorText = await response.text();
        console.error('❌ Index.js: Error response:', errorText);
        currentProducts = [];
      }

      console.log('🛍️ Index.js: Calling renderProducts()');
      renderProducts();
      updateResultsCount();

    } catch (error) {
      console.error('❌ Index.js: Error loading products:', error);
      console.error('❌ Index.js: Error stack:', error.stack);
      currentProducts = [];
      renderProducts();
      updateResultsCount();
    } finally {
      if (loadingIndicator) loadingIndicator.style.display = 'none';
      console.log('🛍️ Index.js: loadFeaturedProducts COMPLETE');
    }
  }


  function renderProducts() {
    console.log('🛍️ Index.js: renderProducts called');
    console.log('🛍️ Index.js: window.ProductCard exists?', !!window.ProductCard);
    console.log('🛍️ Index.js: window.ProductCard:', window.ProductCard);

    const productsList = document.getElementById('productsList');
    if (!productsList) return;

    // Use consistent styling classes
    if (currentView === 'grid') {
      productsList.className = 'products-grid';
    } else {
      productsList.className = 'products-list list-view';
    }

    if (!currentProducts.length) {
      productsList.innerHTML = `
        <div class="text-center text-muted py-5">
          <i class="fas fa-search fa-3x mb-3"></i>
          <p>Henüz ürün bulunmuyor</p>
        </div>
      `;
      return;
    }

    // Check if ProductCard component is available
    if (!window.ProductCard) {
      console.error('❌ Index.js: ProductCard component not loaded yet!');
      console.error('window.ProductCard:', window.ProductCard);
      productsList.innerHTML = `
        <div class="text-center text-muted py-5">
          <i class="fas fa-spinner fa-spin fa-3x mb-3"></i>
          <p>Yükleniyor...</p>
        </div>
      `;
      return;
    }

    // Check if renderListingCard function exists
    if (typeof window.ProductCard.renderListingCard !== 'function') {
      console.error('❌ Index.js: ProductCard.renderListingCard is not a function!');
      console.error('window.ProductCard keys:', Object.keys(window.ProductCard));
      console.error('window.ProductCard.renderListingCard type:', typeof window.ProductCard.renderListingCard);
      productsList.innerHTML = `
        <div class="text-center text-danger py-5">
          <p>⚠️ Ürün gösterim hatası. Lütfen sayfayı yenileyin.</p>
        </div>
      `;
      return;
    }

    // Use the unified ProductCard component
    const html = currentProducts.map(product => {
      // Normalize product data to match component expectations
      const normalizedProduct = {
        ...product,
        location_city: product.location || product.location_city || 'Konum belirtilmemiş',
        slug: product.slug || null,
        category_name: product.category_name || product.category_slug || ''
      };

      // Use the new unified listing card
      return window.ProductCard.renderListingCard(normalizedProduct, {
        showActions: false,
        showStatus: false
      });
    }).join('');

    productsList.innerHTML = html;
  }

  function formatPrice(priceMinor, currency = 'TRY') {
    const price = (priceMinor || 0) / 100;
    return price.toLocaleString('tr-TR', {
      style: 'currency',
      currency: currency
    });
  }

  function formatDate(dateString) {
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

  function updateResultsCount() {
    const resultsCount = document.getElementById('resultsCount');
    if (resultsCount) {
      resultsCount.textContent = currentProducts.length;
    }
  }

  function setupEventListeners() {
    // Category clicks
    document.addEventListener('click', function(e) {
      if (e.target.matches('.category-link') || e.target.closest('.category-link')) {
        e.preventDefault();
        const categoryLink = e.target.closest('.category-link');
        const category = categoryLink.dataset.category;

        // Navigate to category page instead of filtering on homepage
        window.location.href = `/category.html?id=${category}`;
      }
    });

    // View toggle buttons
    const listViewBtn = document.getElementById('listView');
    const gridViewBtn = document.getElementById('gridView');

    if (listViewBtn) {
      listViewBtn.addEventListener('click', function() {
        currentView = 'list';
        listViewBtn.classList.add('active');
        if (gridViewBtn) gridViewBtn.classList.remove('active');
        renderProducts();
      });
    }

    if (gridViewBtn) {
      gridViewBtn.addEventListener('click', function() {
        currentView = 'grid';
        gridViewBtn.classList.add('active');
        if (listViewBtn) listViewBtn.classList.remove('active');
        renderProducts();
      });
    }

    // Sort change
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', function() {
        currentSort = this.value;
        loadFeaturedProducts();
      });
    }

    // Load more button
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', function() {
        currentPage++;
        loadFeaturedProducts();
      });
    }
  }

  function selectCategory(category) {
    currentCategory = category;

    // Update active states
    document.querySelectorAll('.category-link').forEach(item => {
      item.classList.remove('active');
    });

    const activeItem = document.querySelector(`.category-link[data-category="${category}"]`);
    if (activeItem) {
      activeItem.classList.add('active');
    }

    // Update content title
    const contentTitle = document.getElementById('contentTitle');
    if (contentTitle) {
      const categoryData = categories.find(cat => cat.id === category);
      if (subcategory && categoryData) {
        const subcategoryData = categoryData.subcategories.find(sub => sub.id === subcategory);
        contentTitle.textContent = subcategoryData ? subcategoryData.name : categoryData.name;
      } else if (categoryData) {
        contentTitle.textContent = categoryData.name;
      }
    }

    // Reload products for category
    currentPage = 1;
    loadFeaturedProducts();
  }

  // Global functions
  window.toggleFavorite = function(productId, btn) {
    btn.classList.toggle('active');

    // Here you would typically make an API call to add/remove from favorites
    // For now, just show visual feedback
    if (btn.classList.contains('active')) {
      btn.title = 'Favorilerden çıkar';
    } else {
      btn.title = 'Favorilere ekle';
    }
  };

})();