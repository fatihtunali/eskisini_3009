// frontend/public/js/pages/search.js
// Search page functionality

(async function() {
  'use strict';

  // API base URL
  const API_BASE = window.getCorrectApiBase ? window.getCorrectApiBase() : (window.APP && window.APP.API_BASE) || '';

  // DOM elements
  const elements = {
    searchForm: document.getElementById('searchForm'),
    searchInput: document.getElementById('searchInput'),
    searchTitle: document.getElementById('searchTitle'),
    searchDescription: document.getElementById('searchDescription'),
    resultsCount: document.getElementById('resultsCount'),
    loadingState: document.getElementById('loadingState'),
    searchResults: document.getElementById('searchResults'),
    noResults: document.getElementById('noResults'),
    categoryFilter: document.getElementById('categoryFilter'),
    cityFilter: document.getElementById('cityFilter'),
    sortFilter: document.getElementById('sortFilter'),
    tradeFilter: document.getElementById('tradeFilter')
  };

  // Current search state
  let currentQuery = '';
  let currentFilters = {
    category: '',
    city: '',
    sort: 'newest',
    trade: '',
    seller_id: ''
  };

  // API helper function
  async function apiRequest(url, options = {}) {
    try {
      console.log('API Request:', `${API_BASE}${url}`);
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

      const data = await response.json();
      console.log('API Response:', data);
      return data;
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  // Get URL parameters
  function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      q: params.get('q') || '',
      cat: params.get('cat') || '',
      city: params.get('city') || '',
      sort: params.get('sort') || 'newest',
      trade: params.get('trade') || '',
      seller_id: params.get('seller_id') || ''
    };
  }

  // Update URL with current search parameters
  function updateUrl() {
    const params = new URLSearchParams();

    if (currentQuery) params.set('q', currentQuery);
    if (currentFilters.category) params.set('cat', currentFilters.category);
    if (currentFilters.city) params.set('city', currentFilters.city);
    if (currentFilters.sort !== 'newest') params.set('sort', currentFilters.sort);
    if (currentFilters.trade) params.set('trade', currentFilters.trade);

    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState({}, '', newUrl);
  }

  // Load categories for filter dropdown
  async function loadCategories() {
    try {
      const response = await apiRequest('/api/categories/main');
      if (response.ok && response.categories) {
        response.categories.forEach(category => {
          const option = document.createElement('option');
          option.value = category.slug;
          option.textContent = category.name;
          elements.categoryFilter.appendChild(option);
        });
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }

  // Perform search
  async function performSearch() {
    showLoading();

    try {
      // Build search URL
      const searchParams = new URLSearchParams();
      if (currentQuery) searchParams.set('q', currentQuery);
      if (currentFilters.category) searchParams.set('cat', currentFilters.category);
      if (currentFilters.city) searchParams.set('city', currentFilters.city);
      if (currentFilters.sort) searchParams.set('sort', currentFilters.sort);
      if (currentFilters.trade) searchParams.set('trade', currentFilters.trade);
      if (currentFilters.seller_id) searchParams.set('seller_id', currentFilters.seller_id);
      searchParams.set('limit', '24');

      const response = await apiRequest(`/api/listings/search?${searchParams.toString()}`);

      if (response.ok) {
        const items = response.items || [];
        displayResults(items, currentQuery);

        // Get seller name from first item if filtering by seller
        const sellerName = currentFilters.seller_id && items.length > 0 ? items[0].owner_display_name : null;
        updateSearchInfo(items.length, currentQuery, sellerName);
      } else {
        showNoResults();
      }
    } catch (error) {
      console.error('Search failed:', error);
      showError();
    }

    updateUrl();
  }

  // Display search results
  function displayResults(items, query) {
    hideLoading();

    if (!items || items.length === 0) {
      showNoResults();
      return;
    }

    elements.searchResults.style.display = 'block';
    elements.noResults.style.display = 'none';

    // Use unified ProductCard component for consistent rendering
    if (window.ProductCard && window.ProductCard.renderListingCard) {
      elements.searchResults.innerHTML = items.map(item =>
        window.ProductCard.renderListingCard(item, {
          showActions: false,
          showStatus: false
        })
      ).join('');
    } else {
      // Fallback rendering if ProductCard is not available
      elements.searchResults.innerHTML = items.map(item => {
        const price = item.price_minor ? `${(item.price_minor / 100).toLocaleString('tr-TR')} ${item.currency || 'TRY'}` : 'Fiyat belirtilmemiş';
        const image = item.cover_url || '/assets/placeholder.png';
        const href = item.slug ? `/listing.html?slug=${item.slug}` : `/listing.html?id=${item.id}`;

        return `
          <a href="${href}" class="result-card">
            <div class="result-image">
              <img src="${image}" alt="${item.title}" onerror="this.src='/assets/placeholder.png'">
            </div>
            <div class="result-info">
              <div class="result-category">${item.category_slug || 'Kategori'}</div>
              <div class="result-title">${item.title}</div>
              <div class="result-price">₺${price}</div>
              <div class="result-location">
                <i class="fas fa-map-marker-alt"></i>
                ${item.location_city || 'Konum belirtilmemiş'}
              </div>
            </div>
          </a>
        `;
      }).join('');
    }
  }

  // Update search info section
  function updateSearchInfo(count, query, sellerName = null) {
    if (currentFilters.seller_id) {
      const sellerText = sellerName ? `${sellerName}'in İlanları` : 'Satıcının İlanları';
      elements.searchTitle.textContent = sellerText;
      elements.searchDescription.textContent = `Bu satıcıya ait ${count} ilan gösteriliyor`;
      elements.resultsCount.textContent = `${count} ilan`;
      document.title = `${sellerText} | Eskisini Ver Yenisini Al`;
    } else if (query) {
      elements.searchTitle.textContent = `"${query}" için arama sonuçları`;
      elements.searchDescription.textContent = `${count} sonuç bulundu`;
      elements.resultsCount.textContent = `${count} sonuç`;
      document.title = `"${query}" Arama Sonuçları | Eskisini Ver Yenisini Al`;
    } else {
      elements.searchTitle.textContent = 'Tüm ilanlar';
      elements.searchDescription.textContent = `${count} ilan gösteriliyor`;
      elements.resultsCount.textContent = `${count} sonuç`;
      document.title = 'Tüm İlanlar | Eskisini Ver Yenisini Al';
    }
  }

  // Show loading state
  function showLoading() {
    elements.loadingState.style.display = 'block';
    elements.searchResults.style.display = 'none';
    elements.noResults.style.display = 'none';
  }

  // Hide loading state
  function hideLoading() {
    elements.loadingState.style.display = 'none';
  }

  // Show no results state
  function showNoResults() {
    hideLoading();
    elements.searchResults.style.display = 'none';
    elements.noResults.style.display = 'block';
  }

  // Show error state
  function showError() {
    hideLoading();
    elements.searchResults.style.display = 'none';
    elements.noResults.innerHTML = `
      <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
      <h3>Bir hata oluştu</h3>
      <p>Arama sırasında bir hata oluştu. Lütfen tekrar deneyin.</p>
    `;
    elements.noResults.style.display = 'block';
  }

  // Setup event listeners
  function setupEventListeners() {
    // Search form
    if (elements.searchForm) {
      elements.searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        currentQuery = elements.searchInput.value.trim();
        performSearch();
      });
    }

    // Filter changes
    if (elements.categoryFilter) {
      elements.categoryFilter.addEventListener('change', (e) => {
        currentFilters.category = e.target.value;
        performSearch();
      });
    }

    if (elements.cityFilter) {
      elements.cityFilter.addEventListener('change', (e) => {
        currentFilters.city = e.target.value;
        performSearch();
      });
    }

    if (elements.sortFilter) {
      elements.sortFilter.addEventListener('change', (e) => {
        currentFilters.sort = e.target.value;
        performSearch();
      });
    }

    if (elements.tradeFilter) {
      elements.tradeFilter.addEventListener('change', (e) => {
        currentFilters.trade = e.target.value;
        performSearch();
      });
    }
  }

  // Initialize search page
  async function init() {
    console.log('Initializing search page...');

    // Get initial parameters from URL
    const urlParams = getUrlParams();
    currentQuery = urlParams.q;
    currentFilters = {
      category: urlParams.cat,
      city: urlParams.city,
      sort: urlParams.sort,
      trade: urlParams.trade,
      seller_id: urlParams.seller_id
    };

    // Update form fields with URL parameters
    if (elements.searchInput) elements.searchInput.value = currentQuery;
    if (elements.categoryFilter) elements.categoryFilter.value = currentFilters.category;
    if (elements.cityFilter) elements.cityFilter.value = currentFilters.city;
    if (elements.sortFilter) elements.sortFilter.value = currentFilters.sort;
    if (elements.tradeFilter) elements.tradeFilter.value = currentFilters.trade;

    // Load categories for filter
    await loadCategories();

    // Setup event listeners
    setupEventListeners();

    // Perform initial search
    await performSearch();
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();