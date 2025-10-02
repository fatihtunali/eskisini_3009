// Advanced Search and Filter System
// Eskisini Ver Yenisini Al - Enhanced Search Functionality

(function(window) {
  'use strict';

  const API_BASE = window.getCorrectApiBase ? window.getCorrectApiBase() : (window.APP && window.APP.API_BASE) || '';

  // Advanced Search Configuration
  const SearchConfig = {
    // Debounce delay for real-time search (ms)
    debounceDelay: 300,

    // Maximum number of results per page
    pageSize: 20,

    // Search suggestions configuration
    suggestions: {
      enabled: true,
      maxSuggestions: 5,
      minQueryLength: 2
    },

    // Auto-complete configuration
    autoComplete: {
      enabled: true,
      delay: 200,
      minLength: 3,
      maxResults: 8
    },

    // Filter configurations
    filters: {
      price: {
        enabled: true,
        ranges: [
          { label: 'Tümü', min: null, max: null },
          { label: '0-100 TL', min: 0, max: 100 },
          { label: '100-500 TL', min: 100, max: 500 },
          { label: '500-1000 TL', min: 500, max: 1000 },
          { label: '1000-5000 TL', min: 1000, max: 5000 },
          { label: '5000+ TL', min: 5000, max: null }
        ]
      },
      condition: {
        enabled: true,
        options: [
          { value: '', label: 'Tüm Durumlar' },
          { value: 'new', label: 'Sıfır' },
          { value: 'like_new', label: 'Sıfıra Yakın' },
          { value: 'good', label: 'İyi' },
          { value: 'fair', label: 'Orta' },
          { value: 'poor', label: 'Kötü' }
        ]
      },
      dateRange: {
        enabled: true,
        options: [
          { value: '', label: 'Tüm Zamanlar' },
          { value: '1d', label: 'Son 1 Gün' },
          { value: '3d', label: 'Son 3 Gün' },
          { value: '1w', label: 'Son 1 Hafta' },
          { value: '1m', label: 'Son 1 Ay' },
          { value: '3m', label: 'Son 3 Ay' }
        ]
      },
      trade: {
        enabled: true,
        options: [
          { value: '', label: 'Tüm İlanlar' },
          { value: 'true', label: 'Takas Kabul Eden' },
          { value: 'false', label: 'Sadece Satış' }
        ]
      }
    },

    // Sort options
    sortOptions: [
      { value: 'newest', label: 'En Yeni' },
      { value: 'oldest', label: 'En Eski' },
      { value: 'price_asc', label: 'Fiyat (Düşük → Yüksek)' },
      { value: 'price_desc', label: 'Fiyat (Yüksek → Düşük)' },
      { value: 'popularity', label: 'Popülerlik' },
      { value: 'relevance', label: 'İlgililik' },
      { value: 'distance', label: 'Uzaklık' }
    ]
  };

  // Advanced Search Class
  class AdvancedSearch {
    constructor(container, options = {}) {
      this.container = typeof container === 'string' ? document.querySelector(container) : container;
      this.options = { ...SearchConfig, ...options };
      this.searchState = {
        query: '',
        filters: {},
        sort: 'newest',
        page: 1,
        results: [],
        totalResults: 0,
        isLoading: false
      };

      // Debounced search function
      this.debouncedSearch = this.debounce(this.performSearch.bind(this), this.options.debounceDelay);

      this.init();
    }

    init() {
      this.createSearchInterface();
      this.bindEvents();
      this.loadInitialData();
    }

    createSearchInterface() {
      const searchHTML = `
        <div class="advanced-search-container">
          <!-- Main Search Bar -->
          <div class="main-search-section">
            <div class="search-input-wrapper">
              <input type="text"
                     class="advanced-search-input"
                     placeholder="Ne arıyorsunuz? (ürün adı, marka, model...)"
                     autocomplete="off">
              <button class="search-btn" type="button">
                <i class="fas fa-search"></i>
                <span>Ara</span>
              </button>
              <button class="clear-search-btn" type="button" style="display: none;">
                <i class="fas fa-times"></i>
              </button>
            </div>

            <!-- Search Suggestions -->
            <div class="search-suggestions" style="display: none;"></div>
          </div>

          <!-- Advanced Filters Panel -->
          <div class="advanced-filters-panel">
            <div class="filters-toggle">
              <button class="toggle-filters-btn">
                <i class="fas fa-sliders-h"></i>
                <span>Gelişmiş Filtreler</span>
                <i class="fas fa-chevron-down toggle-icon"></i>
              </button>
            </div>

            <div class="filters-content" style="display: none;">
              <div class="filters-grid">
                <!-- Category Filter -->
                <div class="filter-group">
                  <label class="filter-label">
                    <i class="fas fa-tags"></i> Kategori
                  </label>
                  <select class="filter-select" data-filter="category">
                    <option value="">Tüm Kategoriler</option>
                  </select>
                </div>

                <!-- Price Range Filter -->
                <div class="filter-group">
                  <label class="filter-label">
                    <i class="fas fa-money-bill-wave"></i> Fiyat Aralığı
                  </label>
                  <div class="price-filter-container">
                    <select class="filter-select price-range-select" data-filter="priceRange">
                      <option value="">Fiyat Seçin</option>
                    </select>
                    <div class="custom-price-range" style="display: none;">
                      <input type="number" class="price-input" data-filter="minPrice" placeholder="Min">
                      <span class="price-separator">-</span>
                      <input type="number" class="price-input" data-filter="maxPrice" placeholder="Max">
                      <span class="price-currency">TL</span>
                    </div>
                  </div>
                </div>

                <!-- Location Filter -->
                <div class="filter-group">
                  <label class="filter-label">
                    <i class="fas fa-map-marker-alt"></i> Konum
                  </label>
                  <select class="filter-select" data-filter="city">
                    <option value="">Tüm Şehirler</option>
                  </select>
                </div>

                <!-- Condition Filter -->
                <div class="filter-group">
                  <label class="filter-label">
                    <i class="fas fa-certificate"></i> Durum
                  </label>
                  <select class="filter-select" data-filter="condition">
                    <option value="">Tüm Durumlar</option>
                  </select>
                </div>

                <!-- Date Range Filter -->
                <div class="filter-group">
                  <label class="filter-label">
                    <i class="fas fa-calendar"></i> İlan Tarihi
                  </label>
                  <select class="filter-select" data-filter="dateRange">
                    <option value="">Tüm Zamanlar</option>
                  </select>
                </div>

                <!-- Trade Filter -->
                <div class="filter-group">
                  <label class="filter-label">
                    <i class="fas fa-exchange-alt"></i> Takas
                  </label>
                  <select class="filter-select" data-filter="trade">
                    <option value="">Tüm İlanlar</option>
                  </select>
                </div>

                <!-- Distance Filter -->
                <div class="filter-group">
                  <label class="filter-label">
                    <i class="fas fa-location-arrow"></i> Mesafe
                  </label>
                  <select class="filter-select" data-filter="distance">
                    <option value="">Tüm Mesafeler</option>
                    <option value="5">5 km</option>
                    <option value="10">10 km</option>
                    <option value="25">25 km</option>
                    <option value="50">50 km</option>
                    <option value="100">100 km</option>
                  </select>
                </div>
              </div>

              <!-- Filter Actions -->
              <div class="filter-actions">
                <button class="clear-filters-btn">
                  <i class="fas fa-times"></i> Filtreleri Temizle
                </button>
                <button class="apply-filters-btn">
                  <i class="fas fa-check"></i> Filtreleri Uygula
                </button>
              </div>
            </div>
          </div>

          <!-- Search Results Header -->
          <div class="search-results-header">
            <div class="results-info">
              <h2 class="results-title">Arama Sonuçları</h2>
              <p class="results-count">Sonuçlar yükleniyor...</p>
            </div>

            <div class="results-controls">
              <!-- Sort Options -->
              <div class="sort-controls">
                <label class="sort-label">Sıralama:</label>
                <select class="sort-select" data-filter="sort">
                  ${this.options.sortOptions.map(option =>
                    `<option value="${option.value}">${option.label}</option>`
                  ).join('')}
                </select>
              </div>

              <!-- View Toggle -->
              <div class="view-toggle">
                <button class="view-btn" data-view="grid">
                  <i class="fas fa-th"></i>
                </button>
                <button class="view-btn active" data-view="list">
                  <i class="fas fa-list"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- Active Filters Display -->
          <div class="active-filters" style="display: none;">
            <span class="active-filters-label">Aktif Filtreler:</span>
            <div class="active-filters-list"></div>
          </div>

          <!-- Search Results Container -->
          <div class="search-results-container">
            <div class="loading-state" style="display: none;">
              <div class="loading-spinner"></div>
              <p>Arama yapılıyor...</p>
            </div>

            <div class="search-results list-view products-list"></div>

            <div class="no-results" style="display: none;">
              <i class="fas fa-search fa-3x"></i>
              <h3>Sonuç bulunamadı</h3>
              <p>Aramanız için herhangi bir ilan bulunamadı. Farklı anahtar kelimeler deneyin.</p>
            </div>
          </div>

          <!-- Pagination -->
          <div class="search-pagination" style="display: none;"></div>
        </div>
      `;

      this.container.innerHTML = searchHTML;
      this.cacheElements();
      this.populateFilterOptions();
    }

    cacheElements() {
      this.elements = {
        searchInput: this.container.querySelector('.advanced-search-input'),
        searchBtn: this.container.querySelector('.search-btn'),
        clearSearchBtn: this.container.querySelector('.clear-search-btn'),
        suggestions: this.container.querySelector('.search-suggestions'),
        toggleFiltersBtn: this.container.querySelector('.toggle-filters-btn'),
        filtersContent: this.container.querySelector('.filters-content'),
        filterSelects: this.container.querySelectorAll('.filter-select'),
        priceInputs: this.container.querySelectorAll('.price-input'),
        clearFiltersBtn: this.container.querySelector('.clear-filters-btn'),
        applyFiltersBtn: this.container.querySelector('.apply-filters-btn'),
        resultsTitle: this.container.querySelector('.results-title'),
        resultsCount: this.container.querySelector('.results-count'),
        sortSelect: this.container.querySelector('.sort-select'),
        viewBtns: this.container.querySelectorAll('.view-btn'),
        activeFilters: this.container.querySelector('.active-filters'),
        activeFiltersList: this.container.querySelector('.active-filters-list'),
        loadingState: this.container.querySelector('.loading-state'),
        searchResults: this.container.querySelector('.search-results'),
        noResults: this.container.querySelector('.no-results'),
        pagination: this.container.querySelector('.search-pagination')
      };
    }

    populateFilterOptions() {
      // Populate price ranges
      const priceSelect = this.container.querySelector('[data-filter="priceRange"]');
      this.options.filters.price.ranges.forEach(range => {
        const option = document.createElement('option');
        option.value = range.min && range.max ? `${range.min}-${range.max}` : '';
        option.textContent = range.label;
        priceSelect.appendChild(option);
      });

      // Populate condition options
      const conditionSelect = this.container.querySelector('[data-filter="condition"]');
      this.options.filters.condition.options.forEach(option => {
        const optionEl = document.createElement('option');
        optionEl.value = option.value;
        optionEl.textContent = option.label;
        conditionSelect.appendChild(optionEl);
      });

      // Populate date range options
      const dateSelect = this.container.querySelector('[data-filter="dateRange"]');
      this.options.filters.dateRange.options.forEach(option => {
        const optionEl = document.createElement('option');
        optionEl.value = option.value;
        optionEl.textContent = option.label;
        dateSelect.appendChild(optionEl);
      });

      // Populate trade options
      const tradeSelect = this.container.querySelector('[data-filter="trade"]');
      this.options.filters.trade.options.forEach(option => {
        const optionEl = document.createElement('option');
        optionEl.value = option.value;
        optionEl.textContent = option.label;
        tradeSelect.appendChild(optionEl);
      });
    }

    async loadInitialData() {
      try {
        // Load categories
        await this.loadCategories();

        // Load cities
        await this.loadCities();

        // Initialize from URL parameters
        this.initializeFromUrl();

        // Perform initial search to show all listings by default
        this.performSearch();
      } catch (error) {
        console.error('Failed to load initial data:', error);
      }
    }

    async loadCategories() {
      try {
        const response = await this.apiRequest('/api/categories/main');
        if (response.ok && response.categories) {
          const categorySelect = this.container.querySelector('[data-filter="category"]');
          response.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.slug;
            option.textContent = category.name;
            categorySelect.appendChild(option);
          });
        }
      } catch (error) {
        console.error('Failed to load categories:', error);
      }
    }

    async loadCities() {
      try {
        const citySelect = this.container.querySelector('[data-filter="city"]');

        // Use the Turkish cities data from cities-tr.js
        if (window.CITIES_TR && Array.isArray(window.CITIES_TR)) {
          window.CITIES_TR.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            citySelect.appendChild(option);
          });
        }
      } catch (error) {
        console.error('Failed to load cities:', error);
      }
    }

    bindEvents() {
      // Search input events
      this.elements.searchInput.addEventListener('input', (e) => {
        this.searchState.query = e.target.value;
        this.updateClearButton();

        if (this.options.suggestions.enabled) {
          this.showSuggestions(e.target.value);
        }

        this.debouncedSearch();
      });

      this.elements.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.performSearch();
        }
      });

      // Search button
      this.elements.searchBtn.addEventListener('click', () => {
        this.performSearch();
      });

      // Clear search button
      this.elements.clearSearchBtn.addEventListener('click', () => {
        this.clearSearch();
      });

      // Toggle advanced filters
      this.elements.toggleFiltersBtn.addEventListener('click', () => {
        this.toggleAdvancedFilters();
      });

      // Filter changes
      this.elements.filterSelects.forEach(select => {
        select.addEventListener('change', () => {
          this.updateFilters();
        });
      });

      this.elements.priceInputs.forEach(input => {
        input.addEventListener('change', () => {
          this.updateFilters();
        });
      });

      // Filter actions
      this.elements.clearFiltersBtn.addEventListener('click', () => {
        this.clearAllFilters();
      });

      this.elements.applyFiltersBtn.addEventListener('click', () => {
        this.performSearch();
      });

      // Sort change
      this.elements.sortSelect.addEventListener('change', (e) => {
        this.searchState.sort = e.target.value;
        this.performSearch();
      });

      // View toggle
      this.elements.viewBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          this.toggleView(btn.dataset.view);
        });
      });
    }

    initializeFromUrl() {
      const params = new URLSearchParams(window.location.search);

      this.searchState.query = params.get('q') || '';
      this.elements.searchInput.value = this.searchState.query;

      // Set filters from URL
      params.forEach((value, key) => {
        if (key !== 'q') {
          this.searchState.filters[key] = value;

          // Update UI elements
          const element = this.container.querySelector(`[data-filter="${key}"]`);
          if (element) {
            element.value = value;
          }
        }
      });

      this.updateClearButton();
      this.updateActiveFilters();
    }

    async performSearch() {
      if (this.searchState.isLoading) return;

      this.searchState.isLoading = true;
      this.showLoading(true);

      try {
        const searchParams = this.buildSearchParams();
        const url = this.buildSearchUrl(searchParams);
        const response = await this.apiRequest(url);

        if (response.ok) {
          this.searchState.results = response.items || [];
          this.searchState.totalResults = response.items ? response.items.length : 0;

          this.displayResults();
          this.updateResultsInfo();
          this.updatePagination();
          this.updateUrl();
        } else {
          throw new Error(response.error || 'Arama başarısız');
        }
      } catch (error) {
        console.error('Search failed:', error);
        this.showError('Arama sırasında bir hata oluştu. Lütfen tekrar deneyin.');
      } finally {
        this.searchState.isLoading = false;
        this.showLoading(false);
      }
    }

    buildSearchParams() {
      const params = {
        q: this.searchState.query, // Use 'q' parameter for search query
        page: this.searchState.page,
        limit: this.options.pageSize,
        sort: this.searchState.sort,
        ...this.searchState.filters
      };

      // Remove empty values
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null || params[key] === undefined) {
          delete params[key];
        }
      });

      return params;
    }

    buildSearchUrl(params) {
      const url = new URL('/api/listings', `${API_BASE}`);

      // Add parameters to URL
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, value);
        }
      });

      return url.pathname + url.search;
    }

    convertToProductFormat(listing) {
      return {
        id: listing.id,
        slug: listing.slug,
        title: listing.title,
        price_minor: listing.price_minor,
        currency: listing.currency || 'TRY',
        cover_url: listing.cover_url,
        thumb_url: listing.thumb_url,
        location_city: listing.location_city,
        view_count: listing.view_count || 0,
        created_at: listing.created_at,
        category_name: listing.category_name || '',
        category_slug: listing.category_slug,
        condition: listing.condition,
        allow_trade: listing.allow_trade,
        is_featured: listing.is_featured,
        status: listing.status || 'active',
        owner_business_name: listing.owner_business_name || listing.seller_business_name || '',
        owner_display_name: listing.owner_display_name || listing.seller_display_name || listing.seller_name || ''
      };
    }

    displayResults() {
      if (this.searchState.results.length === 0) {
        this.elements.noResults.style.display = 'block';
        this.elements.searchResults.style.display = 'none';
        return;
      }

      this.elements.noResults.style.display = 'none';
      this.elements.searchResults.style.display = 'block';

      // Use the unified listing card for consistent styling
      if (window.ProductCard && window.ProductCard.renderListingCard) {
        const productsHTML = this.searchState.results.map(listing => {
          const product = this.convertToProductFormat(listing);
          return window.ProductCard.renderListingCard(product, {
            showActions: false,
            showStatus: false
          });
        }).join('');

        this.elements.searchResults.innerHTML = productsHTML;
      } else {
        // Fallback to simple display
        this.elements.searchResults.innerHTML = '';
        this.searchState.results.forEach(listing => {
          const listingElement = this.createListingElement(listing);
          this.elements.searchResults.appendChild(listingElement);
        });
      }
    }

    createListingElement(listing) {
      const element = document.createElement('div');
      element.className = 'search-result-item';
      element.innerHTML = `
        <a href="/listing.html?id=${listing.id}" class="result-link">
          <div class="result-image">
            ${listing.images && listing.images.length > 0
              ? `<img src="${listing.images[0]}" alt="${listing.title}">`
              : '<i class="fas fa-image fa-2x text-muted"></i>'
            }
          </div>
          <div class="result-content">
            <h3 class="result-title">${this.escapeHtml(listing.title)}</h3>
            <p class="result-price">${this.formatPrice(listing.price_minor, listing.currency)}</p>
            <p class="result-location">
              <i class="fas fa-map-marker-alt"></i>
              ${this.escapeHtml(listing.city || 'Konum belirtilmemiş')}
            </p>
          </div>
        </a>
      `;
      return element;
    }

    // Utility methods
    debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }

    async apiRequest(url, options = {}) {
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
    }

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    formatPrice(priceMinor, currency = 'TRY') {
      const price = (priceMinor || 0) / 100;
      return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: currency
      }).format(price);
    }

    updateClearButton() {
      this.elements.clearSearchBtn.style.display =
        this.searchState.query ? 'block' : 'none';
    }

    clearSearch() {
      this.searchState.query = '';
      this.elements.searchInput.value = '';
      this.updateClearButton();
      this.performSearch();
    }

    showLoading(show) {
      this.elements.loadingState.style.display = show ? 'block' : 'none';
    }

    showError(message) {
      // Could implement a toast or modal error display
      console.error(message);
    }

    updateResultsInfo() {
      const count = this.searchState.totalResults;
      const query = this.searchState.query;

      this.elements.resultsTitle.textContent = query
        ? `"${query}" için arama sonuçları`
        : 'Tüm ilanlar';

      this.elements.resultsCount.textContent =
        `${count} sonuç bulundu`;
    }

    updateUrl() {
      const params = new URLSearchParams();

      if (this.searchState.query) {
        params.set('q', this.searchState.query);
      }

      Object.entries(this.searchState.filters).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        }
      });

      const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
      window.history.replaceState({}, '', newUrl);
    }

    // Additional methods for filter management, pagination, etc.
    toggleQuickFilter(btn) {
      btn.classList.toggle('active');
      const filter = btn.dataset.filter;
      const value = btn.dataset.value;

      if (btn.classList.contains('active')) {
        this.searchState.filters[filter] = value;
      } else {
        delete this.searchState.filters[filter];
      }

      this.updateActiveFilters();
      this.performSearch();
    }

    toggleAdvancedFilters() {
      const content = this.elements.filtersContent;
      const icon = this.elements.toggleFiltersBtn.querySelector('.toggle-icon');

      if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.style.transform = 'rotate(180deg)';
      } else {
        content.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
      }
    }

    updateFilters() {
      this.elements.filterSelects.forEach(select => {
        const filter = select.dataset.filter;
        const value = select.value;

        if (value) {
          this.searchState.filters[filter] = value;
        } else {
          delete this.searchState.filters[filter];
        }
      });

      this.elements.priceInputs.forEach(input => {
        const filter = input.dataset.filter;
        const value = input.value;

        if (value) {
          this.searchState.filters[filter] = value;
        } else {
          delete this.searchState.filters[filter];
        }
      });

      this.updateActiveFilters();
    }

    updateActiveFilters() {
      const hasFilters = Object.keys(this.searchState.filters).length > 0;

      if (hasFilters) {
        this.elements.activeFilters.style.display = 'block';
        this.renderActiveFilters();
      } else {
        this.elements.activeFilters.style.display = 'none';
      }
    }

    renderActiveFilters() {
      this.elements.activeFiltersList.innerHTML = '';

      Object.entries(this.searchState.filters).forEach(([key, value]) => {
        const filterTag = document.createElement('span');
        filterTag.className = 'active-filter-tag';
        filterTag.innerHTML = `
          ${this.getFilterDisplayName(key, value)}
          <button class="remove-filter-btn" data-filter="${key}">
            <i class="fas fa-times"></i>
          </button>
        `;

        filterTag.querySelector('.remove-filter-btn').addEventListener('click', () => {
          this.removeFilter(key);
        });

        this.elements.activeFiltersList.appendChild(filterTag);
      });
    }

    getFilterDisplayName(key, value) {
      // Convert filter key and value to human-readable format
      const filterNames = {
        category: 'Kategori',
        city: 'Şehir',
        condition: 'Durum',
        priceRange: 'Fiyat',
        dateRange: 'Tarih',
        trade: 'Takas',
        featured: 'Öne Çıkan'
      };

      return `${filterNames[key] || key}: ${value}`;
    }

    removeFilter(filterKey) {
      delete this.searchState.filters[filterKey];

      // Update UI
      const element = this.container.querySelector(`[data-filter="${filterKey}"]`);
      if (element) {
        element.value = '';
      }

      // Update quick filter buttons
      const quickBtn = this.container.querySelector(`.quick-filter-btn[data-filter="${filterKey}"]`);
      if (quickBtn) {
        quickBtn.classList.remove('active');
      }

      this.updateActiveFilters();
      this.performSearch();
    }

    clearAllFilters() {
      this.searchState.filters = {};

      // Reset all filter inputs
      this.elements.filterSelects.forEach(select => {
        select.value = '';
      });

      this.elements.priceInputs.forEach(input => {
        input.value = '';
      });

      // Reset quick filter buttons
      this.elements.quickFilters.forEach(btn => {
        btn.classList.remove('active');
      });

      this.updateActiveFilters();
      this.performSearch();
    }

    toggleView(viewType) {
      this.elements.viewBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewType);
      });

      this.elements.searchResults.className = `search-results ${viewType}-view ${viewType === 'list' ? 'products-list' : ''}`;
    }

    updatePagination() {
      // Implement pagination UI
      const totalPages = Math.ceil(this.searchState.totalResults / this.options.pageSize);

      if (totalPages <= 1) {
        this.elements.pagination.style.display = 'none';
        return;
      }

      this.elements.pagination.style.display = 'block';
      this.elements.pagination.innerHTML = this.createPaginationHTML(totalPages);

      // Bind pagination events
      this.elements.pagination.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const page = parseInt(btn.dataset.page);
          if (page !== this.searchState.page) {
            this.searchState.page = page;
            this.performSearch();
          }
        });
      });
    }

    createPaginationHTML(totalPages) {
      let html = '<div class="pagination-container">';

      // Previous button
      if (this.searchState.page > 1) {
        html += `<button class="page-btn prev-btn" data-page="${this.searchState.page - 1}">
          <i class="fas fa-chevron-left"></i> Önceki
        </button>`;
      }

      // Page numbers
      const startPage = Math.max(1, this.searchState.page - 2);
      const endPage = Math.min(totalPages, this.searchState.page + 2);

      for (let i = startPage; i <= endPage; i++) {
        html += `<button class="page-btn ${i === this.searchState.page ? 'active' : ''}" data-page="${i}">
          ${i}
        </button>`;
      }

      // Next button
      if (this.searchState.page < totalPages) {
        html += `<button class="page-btn next-btn" data-page="${this.searchState.page + 1}">
          Sonraki <i class="fas fa-chevron-right"></i>
        </button>`;
      }

      html += '</div>';
      return html;
    }

    async showSuggestions(query) {
      if (!query || query.length < this.options.suggestions.minQueryLength) {
        this.elements.suggestions.style.display = 'none';
        return;
      }

      try {
        const response = await this.apiRequest(`/api/search/suggestions?q=${encodeURIComponent(query)}`);
        if (response.ok && response.suggestions) {
          this.renderSuggestions(response.suggestions);
        }
      } catch (error) {
        console.error('Failed to load suggestions:', error);
      }
    }

    renderSuggestions(suggestions) {
      if (suggestions.length === 0) {
        this.elements.suggestions.style.display = 'none';
        return;
      }

      this.elements.suggestions.innerHTML = suggestions
        .slice(0, this.options.suggestions.maxSuggestions)
        .map(suggestion => `
          <div class="suggestion-item" data-suggestion="${this.escapeHtml(suggestion)}">
            <i class="fas fa-search"></i>
            <span>${this.escapeHtml(suggestion)}</span>
          </div>
        `).join('');

      this.elements.suggestions.style.display = 'block';

      // Bind suggestion click events
      this.elements.suggestions.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
          this.searchState.query = item.dataset.suggestion;
          this.elements.searchInput.value = this.searchState.query;
          this.elements.suggestions.style.display = 'none';
          this.performSearch();
        });
      });
    }
  }

  // Export to global scope
  window.AdvancedSearch = AdvancedSearch;
  window.SearchConfig = SearchConfig;

})(window);