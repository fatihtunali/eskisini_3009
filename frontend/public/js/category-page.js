// Category page functionality
(function() {
  const API_BASE = window.getCorrectApiBase ? window.getCorrectApiBase() : (window.APP && window.APP.API_BASE) || '';

  // HTML escape function
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Current state
  let currentCategoryId = null;
  let currentSubcategoryId = null;
  let subcategories = [];
  let currentListings = [];
  // currentView kaldırıldı - sadece liste görünümü kullanılıyor
  let currentSort = 'newest';
  let currentPage = 1;
  const itemsPerPage = 20;

  // Get category ID from URL
  function getCategoryIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
  }

  // Initialize category page when dependencies are ready
  function startCategoryPage() {
    console.log('🚀 Category-page.js: Starting category page initialization');
    console.log('🚀 Category-page.js: API_BASE available:', API_BASE);

    function initCategory() {
      currentCategoryId = getCategoryIdFromUrl();
      if (currentCategoryId) {
        initializeCategoryPage();
      } else {
        // Redirect to homepage if no category ID
        window.location.href = '/';
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initCategory);
    } else {
      initCategory();
    }
  }

  // Wait for dependencies to be loaded before starting
  if (window.dependenciesLoadedTriggered) {
    console.log('🚀 Category-page.js: Dependencies already loaded, starting immediately');
    startCategoryPage();
  } else {
    console.log('🚀 Category-page.js: Waiting for dependencies to load...');
    document.addEventListener('dependenciesLoaded', function() {
      console.log('🚀 Category-page.js: Dependencies loaded event received, starting category');
      startCategoryPage();
    });
  }

  function initializeCategoryPage() {
    loadCategoryInfo();
    loadSubcategories();
    loadCategoryListings();
    setupEventListeners();
  }

  async function loadCategoryInfo() {
    try {
      // Get all categories and find the current one
      const response = await fetch(`${API_BASE}/api/categories`, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const allCategories = data.categories || [];

        // Find current category by ID
        const category = allCategories.find(cat =>
          cat.id && cat.id.toString() === currentCategoryId.toString()
        );

        if (category) {
          updatePageTitle(category);
        }
      }
    } catch (error) {
      console.error('Error loading category info:', error);
    }
  }

  async function loadSubcategories() {
    try {
      // Get all categories first, then filter for subcategories of current category
      const response = await fetch(`${API_BASE}/api/categories`, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const allCategories = data.categories || [];

        // Filter to get only subcategories where parent_id equals current category ID
        subcategories = allCategories.filter(category =>
          category.parent_id && category.parent_id.toString() === currentCategoryId.toString()
        );

        renderSubcategories();
      }
    } catch (error) {
      console.error('Error loading subcategories:', error);
      subcategories = [];
      renderSubcategories();
    }
  }

  async function loadCategoryListings() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const productsList = document.getElementById('productsList');
    const emptyState = document.getElementById('emptyState');

    if (loadingIndicator) loadingIndicator.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';

    try {
      const categoryParam = currentSubcategoryId || currentCategoryId;
      const response = await fetch(`${API_BASE}/api/listings/search?category=${categoryParam}&page=${currentPage}&limit=${itemsPerPage}&sort=${currentSort}`, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      if (response.ok) {
        const data = await response.json();
        currentListings = data.listings || data.items || [];
      } else {
        currentListings = [];
      }

      renderListings();
      updateResultsCount();

      // Show empty state if no listings
      if (currentListings.length === 0 && emptyState) {
        emptyState.style.display = 'block';
      }

    } catch (error) {
      console.error('Error loading listings:', error);
      currentListings = [];
      renderListings();
      updateResultsCount();
      if (emptyState) emptyState.style.display = 'block';
    } finally {
      if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
  }

  function updatePageTitle(category) {
    const categoryTitle = document.getElementById('categoryTitle');
    const listingsTitle = document.getElementById('listingsTitle');

    if (categoryTitle && category) {
      categoryTitle.innerHTML = `<i class="fas fa-list me-2"></i>${category.name} - Alt Kategoriler`;
    }

    if (listingsTitle && category) {
      listingsTitle.textContent = `${category.name} İlanları`;
    }

    // Update page title
    document.title = `${category.name} - Eskisini Ver Yenisini Al`;
  }

  function renderSubcategories() {
    const subcategoriesTree = document.getElementById('subcategoriesTree');
    if (!subcategoriesTree) return;

    if (subcategories.length === 0) {
      subcategoriesTree.innerHTML = '<div class="text-muted p-3">Bu kategoride alt kategori bulunmuyor.</div>';
      return;
    }

    const html = subcategories.map(subcategory => `
      <div class="category-item-wrapper">
        <a href="#" class="category-link" data-subcategory="${subcategory.id}">
          ${subcategory.name}
        </a>
      </div>
    `).join('');

    subcategoriesTree.innerHTML = html;

    // Add "All" option at the top
    const allOption = `
      <div class="category-item-wrapper">
        <a href="#" class="category-link ${!currentSubcategoryId ? 'active' : ''}" data-subcategory="">
          <strong>Tüm ${document.querySelector('#categoryTitle')?.textContent?.replace(' - Alt Kategoriler', '') || 'Kategoriler'}</strong>
        </a>
      </div>
    `;
    subcategoriesTree.innerHTML = allOption + html;
  }

  function renderListings() {
    const productsList = document.getElementById('productsList');
    if (!productsList) return;

    // Ana sayfayla tutarlı şekilde sadece liste görünümü kullan
    productsList.className = 'products-list-view';

    if (!currentListings.length) {
      productsList.innerHTML = `
        <div class="text-center text-muted py-5">
          <i class="fas fa-search fa-3x mb-3"></i>
          <p>Bu kategoride henüz ilan bulunmuyor</p>
        </div>
      `;
      return;
    }

    // Check if ProductCard component is available
    if (!window.ProductCard) {
      console.error('❌ Category-page.js: ProductCard component not loaded yet!');
      productsList.innerHTML = `
        <div class="text-center text-muted py-5">
          <i class="fas fa-spinner fa-spin fa-3x mb-3"></i>
          <p>Yükleniyor...</p>
        </div>
      `;
      return;
    }

    // Use the unified listing card
    const html = currentListings.map(listing => {
      // Normalize data
      const normalized = {
        ...listing,
        category_name: listing.category_name || listing.category_slug || '',
        location_city: listing.location_city || listing.location || ''
      };

      return window.ProductCard.renderListingCard(normalized, {
        showActions: false,
        showStatus: false
      });
    }).join('');
    productsList.innerHTML = html;
  }

  // formatPrice ve formatDate artık ProductCard component'te

  function updateResultsCount() {
    const resultsCount = document.getElementById('resultsCount');
    if (resultsCount) {
      resultsCount.textContent = currentListings.length;
    }
  }

  function setupEventListeners() {
    // Subcategory clicks
    document.addEventListener('click', function(e) {
      if (e.target.matches('.category-link') || e.target.closest('.category-link')) {
        e.preventDefault();
        const categoryLink = e.target.closest('.category-link');
        const subcategory = categoryLink.dataset.subcategory;

        selectSubcategory(subcategory);
      }
    });

    // View toggle buttons kaldırıldı - sadece liste görünümü kullanılıyor

    // Sort change
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', function() {
        currentSort = this.value;
        loadCategoryListings();
      });
    }

    // Load more button
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', function() {
        currentPage++;
        loadCategoryListings();
      });
    }
  }

  function selectSubcategory(subcategory) {
    currentSubcategoryId = subcategory || null;

    // Update active states
    document.querySelectorAll('.category-link').forEach(link => {
      link.classList.remove('active');
    });

    const activeItem = document.querySelector(`[data-subcategory="${subcategory || ''}"]`);
    if (activeItem) {
      activeItem.classList.add('active');
    }

    // Update listings title
    const listingsTitle = document.getElementById('listingsTitle');
    if (listingsTitle) {
      if (subcategory) {
        const subcategoryData = subcategories.find(sub => sub.id == subcategory);
        listingsTitle.textContent = subcategoryData ? `${subcategoryData.name} İlanları` : 'İlanlar';
      } else {
        // Show parent category name
        listingsTitle.textContent = `${document.querySelector('#categoryTitle')?.textContent?.replace(' - Alt Kategoriler', '') || ''} İlanları`;
      }
    }

    // Reload listings for subcategory
    currentPage = 1;
    loadCategoryListings();
  }

  // toggleFavorite artık ProductCard component'te

})();