// Admin Panel JavaScript
(function() {
  'use strict';

  const API_BASE = window.getCorrectApiBase ? window.getCorrectApiBase() : (window.APP && window.APP.API_BASE) || 'http://localhost:3000';

  console.log('🔧 Admin Panel - API_BASE:', API_BASE);
  console.log('🔧 Admin Panel - window.getCorrectApiBase:', typeof window.getCorrectApiBase);

  let currentTab = 'pending';
  let currentPage = 1;
  let currentListingId = null;
  let currentUserId = null;
  let selectedListings = new Set();
  let selectedUsers = new Set();

  // Initialize
  function initAdminPanel() {
    console.log('🎯 Initializing admin panel...');
    checkAdminAuth();
    loadStats();
    loadListings();
    setupEventListeners();
  }

  // Run initialization - handle both cases: DOM ready or not
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminPanel);
  } else {
    // DOM already loaded, run immediately
    initAdminPanel();
  }

  // Check if user is admin
  async function checkAdminAuth() {
    try {
      const response = await fetch(`${API_BASE}/api/auth/me`, {
        credentials: 'include'
      });

      if (!response.ok) {
        // User is not logged in - redirect to login
        redirectToLogin();
        return;
      }

      const data = await response.json();
      const user = data.user || data;

      // User is logged in but check if admin
      if (!user.is_admin) {
        alert('Bu sayfaya erişim yetkiniz bulunmamaktadır. Admin yetkisi gereklidir.');
        window.location.href = '/';
        return;
      }

      // User is admin - proceed
      document.getElementById('adminUserName').textContent = user.full_name || 'Admin';
      console.log('Admin authenticated:', user.email);
    } catch (error) {
      console.error('Auth check error:', error);
      // Network error or other issue - redirect to login
      redirectToLogin();
    }
  }

  function redirectToLogin() {
    window.location.href = '/admin-login.html';
  }

  // Load admin stats
  async function loadStats() {
    try {
      const response = await fetch(`${API_BASE}/api/admin/stats`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        const stats = data.stats;

        document.getElementById('statPending').textContent = stats.pending_listings || 0;
        document.getElementById('statActive').textContent = stats.active_listings || 0;
        document.getElementById('statRejected').textContent = stats.rejected_listings || 0;
        document.getElementById('statUsers').textContent = stats.total_users || 0;
        document.getElementById('pendingCount').textContent = stats.pending_listings || 0;
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  // Load listings
  async function loadListings() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const listingsContainer = document.getElementById('listingsContainer');

    loadingIndicator.style.display = 'block';

    try {
      const searchTerm = document.getElementById('searchInput').value;
      const statusFilter = document.getElementById('statusFilter').value;

      let url;
      const params = new URLSearchParams({
        page: currentPage,
        limit: 20
      });

      if (currentTab === 'pending') {
        url = `${API_BASE}/api/admin/listings/pending`;
      } else {
        url = `${API_BASE}/api/admin/listings`;
        if (statusFilter) params.append('status', statusFilter);
        if (searchTerm) params.append('search', searchTerm);
      }

      const response = await fetch(`${url}?${params}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        renderListings(data.listings);
        renderPagination(data.pagination);
      } else {
        throw new Error('Failed to load listings');
      }
    } catch (error) {
      console.error('Error loading listings:', error);
      listingsContainer.innerHTML = '<div class="alert alert-danger">İlanlar yüklenemedi: ' + error.message + '</div>';
    } finally {
      loadingIndicator.style.display = 'none';
    }
  }

  // Render listings
  function renderListings(listings) {
    const container = document.getElementById('listingsContainer');

    if (!listings || listings.length === 0) {
      container.innerHTML = '<div class="alert alert-info">Gösterilecek ilan bulunamadı.</div>';
      return;
    }

    const html = listings.map(listing => {
      const statusClass = getStatusClass(listing.status);
      const statusText = getStatusText(listing.status);
      const price = formatPrice(listing.price_minor, listing.currency);
      const date = new Date(listing.created_at).toLocaleDateString('tr-TR');

      return `
        <div class="listing-card">
          <div class="row align-items-center">
            <div class="col-md-1">
              <input type="checkbox" class="form-check-input listing-checkbox" value="${listing.id}" onchange="updateSelectedListings()">
            </div>
            <div class="col-md-2">
              ${listing.cover_url ?
                `<img src="${listing.cover_url}" alt="İlan görseli" class="img-fluid rounded" style="max-height: 80px; object-fit: cover;">` :
                '<div class="bg-light rounded d-flex align-items-center justify-content-center" style="height: 80px; width: 80px;"><i class="fas fa-image text-muted"></i></div>'
              }
            </div>
            <div class="col-md-5">
              <h6 class="mb-1">
                <a href="/listing.html?id=${listing.id}" target="_blank" class="text-decoration-none">
                  ${escapeHtml(listing.title)}
                </a>
              </h6>
              <p class="text-muted mb-1 small">${escapeHtml(listing.category_name || 'Kategori')}</p>
              <p class="text-muted mb-0 small">
                <i class="fas fa-user me-1"></i>${escapeHtml(listing.owner_name)} (${escapeHtml(listing.owner_email)})
                <span class="ms-3"><i class="fas fa-calendar me-1"></i>${date}</span>
              </p>
            </div>
            <div class="col-md-2 text-center">
              <div class="fw-bold text-primary">${price}</div>
              <span class="status-badge status-${listing.status}">${statusText}</span>
            </div>
            <div class="col-md-2 text-end">
              ${listing.status === 'pending_review' ? `
                <button class="btn btn-warning btn-sm me-1" onclick="aiCheckListing(${listing.id})" title="AI Kontrol">
                  <i class="fas fa-robot"></i>
                </button>
                <button class="btn btn-approve btn-sm me-1" onclick="approveListing(${listing.id})" title="Onayla">
                  <i class="fas fa-check"></i>
                </button>
                <button class="btn btn-reject btn-sm" onclick="showRejectModal(${listing.id})" title="Reddet">
                  <i class="fas fa-times"></i>
                </button>
              ` : ''}
              <a href="/listing.html?id=${listing.id}" target="_blank" class="btn btn-outline-primary btn-sm" title="İlanı Gör">
                <i class="fas fa-eye"></i>
              </a>
            </div>
          </div>
          ${listing.image_count > 0 ? `<small class="text-muted"><i class="fas fa-images me-1"></i>${listing.image_count} görsel</small>` : ''}
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  }

  // Render pagination
  function renderPagination(pagination) {
    const container = document.getElementById('pagination');

    if (!pagination || pagination.pages <= 1) {
      container.innerHTML = '';
      return;
    }

    let html = '';

    // Previous button
    if (pagination.page > 1) {
      html += `<li class="page-item"><a class="page-link" href="#" onclick="changePage(${pagination.page - 1})">Önceki</a></li>`;
    }

    // Page numbers
    for (let i = Math.max(1, pagination.page - 2); i <= Math.min(pagination.pages, pagination.page + 2); i++) {
      html += `<li class="page-item ${i === pagination.page ? 'active' : ''}">
        <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
      </li>`;
    }

    // Next button
    if (pagination.page < pagination.pages) {
      html += `<li class="page-item"><a class="page-link" href="#" onclick="changePage(${pagination.page + 1})">Sonraki</a></li>`;
    }

    container.innerHTML = html;
  }

  // Setup event listeners
  function setupEventListeners() {
    // Tab clicks
    document.querySelectorAll('#adminTabs .nav-link').forEach(tab => {
      tab.addEventListener('click', function(e) {
        e.preventDefault();
        const newTab = this.dataset.tab;

        if (newTab !== currentTab) {
          document.querySelectorAll('#adminTabs .nav-link').forEach(t => t.classList.remove('active'));
          this.classList.add('active');
          currentTab = newTab;
          currentPage = 1;

          if (newTab === 'analytics') {
            showAnalytics();
          } else if (newTab === 'ai-dashboard') {
            showAIDashboard();
          } else if (newTab === 'user-management') {
            showUserManagement();
          } else if (newTab === 'category-management') {
            showCategoryManagement();
          } else if (newTab === 'security-logs') {
            showSecurityLogs();
          } else if (newTab === 'tests') {
            showTestRunner();
          } else {
            hideAnalytics();
            hideAIDashboard();
            hideUserManagement();
            hideCategoryManagement();
            hideSecurityLogs();
            hideTestRunner();
            loadListings();
          }
        }
      });
    });

    // Search input
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        currentPage = 1;
        loadListings();
      }
    });

    // User search input
    const userSearchInput = document.getElementById('userSearchInput');
    if (userSearchInput) {
      userSearchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          currentPage = 1;
          loadUsers();
        }
      });
    }
  }

  // Utility functions
  function getStatusClass(status) {
    const classes = {
      'pending_review': 'pending',
      'active': 'active',
      'rejected': 'rejected',
      'sold': 'secondary'
    };
    return classes[status] || 'secondary';
  }

  function getStatusText(status) {
    const texts = {
      'pending_review': 'İnceleme Bekliyor',
      'active': 'Aktif',
      'rejected': 'Reddedildi',
      'sold': 'Satıldı',
      'paused': 'Duraklatıldı'
    };
    return texts[status] || status;
  }

  function formatPrice(priceMinor, currency = 'TRY') {
    if (!priceMinor) return 'Fiyat belirtilmemiş';
    const price = (priceMinor / 100).toLocaleString('tr-TR');
    const symbol = currency === 'TRY' ? '₺' : '$';
    return `${symbol}${price}`;
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Global functions
  window.changePage = function(page) {
    currentPage = page;
    loadListings();
  };

  window.approveListing = async function(listingId) {
    if (!confirm('Bu ilanı onaylamak istediğinizden emin misiniz?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/admin/listings/${listingId}/approve`, {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        loadStats();
        loadListings();
      } else {
        throw new Error('Onaylama işlemi başarısız');
      }
    } catch (error) {
      alert('Hata: ' + error.message);
    }
  };

  window.showRejectModal = function(listingId) {
    currentListingId = listingId;
    document.getElementById('rejectionReason').value = '';
    new bootstrap.Modal(document.getElementById('rejectionModal')).show();
  };

  window.confirmReject = async function() {
    const reason = document.getElementById('rejectionReason').value.trim();

    if (!reason) {
      alert('Lütfen reddetme sebebini belirtiniz.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/admin/listings/${currentListingId}/reject`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });

      if (response.ok) {
        bootstrap.Modal.getInstance(document.getElementById('rejectionModal')).hide();
        loadStats();
        loadListings();
      } else {
        throw new Error('Reddetme işlemi başarısız');
      }
    } catch (error) {
      alert('Hata: ' + error.message);
    }
  };

  window.aiCheckListing = async function(listingId) {
    const button = event.target.closest('button');
    const originalText = button.innerHTML;

    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    button.disabled = true;

    try {
      const response = await fetch(`${API_BASE}/api/admin/listings/${listingId}/ai-check`, {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        const aiCheck = data.aiCheck;

        let alertClass = 'alert-info';
        if (aiCheck.riskLevel === 'high') alertClass = 'alert-danger';
        else if (aiCheck.riskLevel === 'medium') alertClass = 'alert-warning';
        else alertClass = 'alert-success';

        const resultHtml = `
          <div class="alert ${alertClass} mt-2">
            <h6><i class="fas fa-robot me-2"></i>OpenAI İçerik Analizi</h6>
            ${aiCheck.autoAction ? `
              <div class="alert alert-info mb-3" style="margin: 10px 0;">
                <strong>${aiCheck.autoActionMessage}</strong>
                ${aiCheck.newStatus !== 'pending_review' ? `<br><small>Durum güncellendi: <strong>${aiCheck.newStatus}</strong></small>` : ''}
              </div>
            ` : ''}
            <div class="row">
              <div class="col-md-6">
                <p class="mb-1"><strong>Risk Seviyesi:</strong>
                  <span class="badge ${aiCheck.riskLevel === 'high' ? 'bg-danger' : aiCheck.riskLevel === 'medium' ? 'bg-warning' : 'bg-success'}">${aiCheck.riskLevel.toUpperCase()}</span>
                </p>
                <p class="mb-1"><strong>Güven:</strong> ${aiCheck.confidence}</p>
                <p class="mb-1"><strong>Kaynak:</strong> ${aiCheck.source === 'openai' ? '🤖 OpenAI GPT-4' : aiCheck.source === 'openai-moderation' ? '🛡️ OpenAI Moderation' : '⚡ Fallback'}</p>
              </div>
              <div class="col-md-6">
                <p class="mb-1"><strong>Öneri:</strong> ${aiCheck.recommendation}</p>
                ${aiCheck.flagReason ? `<p class="mb-1"><strong>Sebep:</strong> ${aiCheck.flagReason}</p>` : ''}
              </div>
            </div>
            ${aiCheck.flaggedKeywords && aiCheck.flaggedKeywords.length > 0 ? `<p class="mb-0 mt-2"><strong>🚨 Tespit Edilen:</strong> <code>${aiCheck.flaggedKeywords.join(', ')}</code></p>` : ''}
          </div>
        `;

        // Add result below the listing card
        const listingCard = button.closest('.listing-card');
        let existingResult = listingCard.querySelector('.ai-result');
        if (existingResult) existingResult.remove();

        const resultDiv = document.createElement('div');
        resultDiv.className = 'ai-result';
        resultDiv.innerHTML = resultHtml;
        listingCard.appendChild(resultDiv);

        // Auto-scroll to result
        resultDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // If auto-action was taken, refresh listings after 3 seconds
        if (aiCheck.autoAction && aiCheck.newStatus !== 'pending_review') {
          setTimeout(() => {
            loadStats();
            loadListings();
          }, 3000);
        }

      } else {
        throw new Error('AI kontrolü başarısız');
      }
    } catch (error) {
      alert('Hata: ' + error.message);
    } finally {
      button.innerHTML = originalText;
      button.disabled = false;
    }
  };

  // Analytics Dashboard functions
  function showAnalytics() {
    document.getElementById('listingsContainer').style.display = 'none';
    document.getElementById('loadingIndicator').style.display = 'none';
    document.getElementById('pagination').style.display = 'none';
    document.getElementById('listingFilters').style.display = 'none';
    document.getElementById('userFilters').style.display = 'none';
    document.getElementById('analyticsContainer').style.display = 'block';
    loadAnalytics();
  }

  function hideAnalytics() {
    document.getElementById('analyticsContainer').style.display = 'none';
    document.getElementById('listingsContainer').style.display = 'block';
    document.getElementById('pagination').style.display = 'block';
    document.getElementById('listingFilters').style.display = 'block';
  }

  // AI Dashboard functions
  function showAIDashboard() {
    document.getElementById('listingsContainer').style.display = 'none';
    document.getElementById('loadingIndicator').style.display = 'none';
    document.getElementById('pagination').style.display = 'none';
    document.getElementById('listingFilters').style.display = 'none'; // Hide listing filters
    document.getElementById('analyticsContainer').style.display = 'none';
    document.getElementById('aiDashboardContainer').style.display = 'block';
    loadAIStats();
  }

  function hideAIDashboard() {
    document.getElementById('aiDashboardContainer').style.display = 'none';
    document.getElementById('categoryManagementContainer').style.display = 'none';
    document.getElementById('securityLogsContainer').style.display = 'none';
    document.getElementById('listingsContainer').style.display = 'block';
    document.getElementById('pagination').style.display = 'block';
    document.getElementById('listingFilters').style.display = 'block'; // Show listing filters
  }

  async function loadAIStats() {
    try {
      const response = await fetch(`${API_BASE}/api/admin/ai-stats`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        const stats = data.aiStats;

        // Update overview stats
        document.getElementById('aiAutoApproved').textContent = stats.overview.auto_approved || 0;
        document.getElementById('aiAutoRejected').textContent = stats.overview.auto_rejected || 0;
        document.getElementById('aiFlagged').textContent = stats.overview.flagged_manual || 0;
        document.getElementById('aiAvgConfidence').textContent =
          stats.overview.avg_confidence ? `${Math.round(stats.overview.avg_confidence)}%` : '-';

        // Update risk level chart
        updateRiskLevelChart(stats.riskLevels);

        // Update confidence chart
        updateConfidenceChart(stats.confidenceDistribution);

        // Update recent checks table
        updateRecentChecksTable(stats.recentChecks);

      } else {
        throw new Error('AI istatistikleri yüklenemedi');
      }
    } catch (error) {
      console.error('Error loading AI stats:', error);
    }
  }

  function updateRiskLevelChart(riskLevels) {
    const container = document.getElementById('riskLevelChart');
    let html = '';

    riskLevels.forEach(item => {
      const riskLevel = item.risk_level?.replace(/"/g, '') || 'unknown';
      const count = item.count;
      const color = riskLevel === 'low' ? 'success' :
                   riskLevel === 'medium' ? 'warning' :
                   riskLevel === 'high' ? 'danger' : 'secondary';

      html += `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="badge bg-${color}">${riskLevel.toUpperCase()}</span>
          <strong>${count}</strong>
        </div>
      `;
    });

    container.innerHTML = html || '<p class="text-muted">Henüz veri yok</p>';
  }

  function updateConfidenceChart(confidenceDistribution) {
    const container = document.getElementById('confidenceChart');
    let html = '';

    confidenceDistribution.forEach(item => {
      const range = item.confidence_range;
      const count = item.count;
      const color = range.startsWith('90') ? 'success' :
                   range.startsWith('80') ? 'info' :
                   range.startsWith('70') ? 'warning' :
                   'danger';

      html += `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="badge bg-${color}">${range}</span>
          <strong>${count}</strong>
        </div>
      `;
    });

    container.innerHTML = html || '<p class="text-muted">Henüz veri yok</p>';
  }

  function updateRecentChecksTable(recentChecks) {
    const tbody = document.querySelector('#recentChecksTable tbody');
    let html = '';

    recentChecks.forEach(check => {
      const confidence = check.confidence || 0;
      const riskLevel = check.risk_level?.replace(/"/g, '') || 'unknown';
      const autoAction = check.auto_action?.replace(/"/g, '') || 'none';
      const aiSource = check.ai_source?.replace(/"/g, '') || 'unknown';
      const date = new Date(check.ai_check_date).toLocaleString('tr-TR');

      const riskColor = riskLevel === 'low' ? 'success' :
                       riskLevel === 'medium' ? 'warning' : 'danger';
      const actionColor = autoAction === 'auto_approved' ? 'success' :
                         autoAction === 'auto_rejected' ? 'danger' : 'warning';
      const sourceIcon = aiSource === 'openai' ? '🤖' : '⚡';

      html += `
        <tr>
          <td><a href="/listing.html?id=${check.id}" target="_blank">${escapeHtml(check.title.substring(0, 30))}...</a></td>
          <td><span class="badge bg-info">${confidence}%</span></td>
          <td><span class="badge bg-${riskColor}">${riskLevel}</span></td>
          <td><span class="badge bg-${actionColor}">${autoAction.replace('_', ' ')}</span></td>
          <td>${sourceIcon} ${aiSource}</td>
          <td><small>${date}</small></td>
        </tr>
      `;
    });

    tbody.innerHTML = html || '<tr><td colspan="6" class="text-center text-muted">Henüz AI kontrolü yapılmamış</td></tr>';
  }

  window.logout = async function() {
    if (!confirm('Çıkış yapmak istediğinizden emin misiniz?')) return;

    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout error:', error);
    }

    window.location.href = '/';
  };

  // User Management functions
  function showUserManagement() {
    document.getElementById('listingsContainer').style.display = 'none';
    document.getElementById('analyticsContainer').style.display = 'none';
    document.getElementById('aiDashboardContainer').style.display = 'none';
    document.getElementById('loadingIndicator').style.display = 'none';
    document.getElementById('pagination').style.display = 'none';
    document.getElementById('listingFilters').style.display = 'none'; // Hide listing filters
    document.getElementById('userManagementContainer').style.display = 'block';
    loadUsers();
  }

  function hideUserManagement() {
    document.getElementById('userManagementContainer').style.display = 'none';
    document.getElementById('categoryManagementContainer').style.display = 'none';
    document.getElementById('securityLogsContainer').style.display = 'none';
    document.getElementById('listingsContainer').style.display = 'block';
    document.getElementById('pagination').style.display = 'block';
    document.getElementById('listingFilters').style.display = 'block'; // Show listing filters
  }

  async function loadUsers() {
    try {
      const searchTerm = document.getElementById('userSearchInput').value;
      const statusFilter = document.getElementById('userStatusFilter').value;
      const kycStatusFilter = document.getElementById('kycStatusFilter').value;
      const planFilter = document.getElementById('planFilter').value;

      const params = new URLSearchParams({
        page: currentPage,
        limit: 20
      });

      if (statusFilter) params.append('status', statusFilter);
      if (kycStatusFilter) params.append('kyc_status', kycStatusFilter);
      if (planFilter) params.append('plan', planFilter);
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`${API_BASE}/api/admin/users?${params}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        renderUsers(data.users);
        renderUserPagination(data.pagination);
      } else {
        throw new Error('Failed to load users');
      }
    } catch (error) {
      console.error('Error loading users:', error);
      document.getElementById('usersContainer').innerHTML = '<div class="alert alert-danger">Kullanıcılar yüklenemedi: ' + error.message + '</div>';
    }
  }

  function getKycBadge(kycStatus) {
    switch(kycStatus) {
      case 'verified': return '<span class="badge bg-success mb-1"><i class="fas fa-check-circle me-1"></i>KYC Doğrulandı</span>';
      case 'pending': return '<span class="badge bg-warning mb-1"><i class="fas fa-clock me-1"></i>KYC Bekliyor</span>';
      case 'rejected': return '<span class="badge bg-danger mb-1"><i class="fas fa-times-circle me-1"></i>KYC Reddedildi</span>';
      default: return '<span class="badge bg-secondary mb-1"><i class="fas fa-user-slash me-1"></i>KYC Yok</span>';
    }
  }

  function getPlanBadge(planCode) {
    switch(planCode) {
      case 'premium': return '<span class="badge bg-warning mb-1"><i class="fas fa-crown me-1"></i>Premium</span>';
      case 'pro': return '<span class="badge bg-danger mb-1"><i class="fas fa-star me-1"></i>Pro</span>';
      case 'basic': return '<span class="badge bg-info mb-1"><i class="fas fa-layer-group me-1"></i>Temel</span>';
      default: return '<span class="badge bg-light text-dark mb-1"><i class="fas fa-gift me-1"></i>Ücretsiz</span>';
    }
  }

  function renderUsers(users) {
    const container = document.getElementById('usersContainer');

    if (!users || users.length === 0) {
      container.innerHTML = '<div class="alert alert-info">Gösterilecek kullanıcı bulunamadı.</div>';
      return;
    }

    const html = users.map(user => {
      const joinDate = new Date(user.created_at).toLocaleDateString('tr-TR');
      const lastLogin = user.last_login ? new Date(user.last_login).toLocaleDateString('tr-TR') : 'Hiç giriş yapmadı';

      return `
        <div class="listing-card">
          <div class="row align-items-center">
            <div class="col-md-1">
              <input type="checkbox" class="form-check-input user-checkbox" value="${user.id}" onchange="updateSelectedUsers()">
            </div>
            <div class="col-md-1">
              <div class="bg-light rounded-circle d-flex align-items-center justify-content-center" style="width: 50px; height: 50px;">
                <i class="fas fa-user text-muted"></i>
              </div>
            </div>
            <div class="col-md-4">
              <h6 class="mb-1">${escapeHtml(user.full_name)}</h6>
              <p class="text-muted mb-1 small">${escapeHtml(user.email)}</p>
              <p class="text-muted mb-0 small">
                ${user.location_city ? `<i class="fas fa-map-marker-alt me-1"></i>${escapeHtml(user.location_city)}` : ''}
                ${user.phone ? `<span class="ms-3"><i class="fas fa-phone me-1"></i>${escapeHtml(user.phone)}</span>` : ''}
              </p>
            </div>
            <div class="col-md-3">
              <div class="d-flex flex-column">
                ${user.status === 'suspended' ?
                  '<span class="badge bg-danger mb-1">Askıya Alınmış</span>' :
                  '<span class="badge bg-success mb-1">Aktif</span>'
                }
                ${getKycBadge(user.kyc_status)}
                ${getPlanBadge(user.current_plan_code)}
                ${user.can_sell ? '<span class="badge bg-info mb-1">Satış Yapabilir</span>' : '<span class="badge bg-secondary mb-1">Satış Yasak</span>'}
              </div>
            </div>
            <div class="col-md-2 text-center">
              <div class="small">
                <div class="fw-bold text-primary">${user.total_listings || 0} İlan</div>
                <div class="text-success">${user.active_listings || 0} Aktif</div>
                <div class="text-warning">${user.sold_listings || 0} Satıldı</div>
              </div>
            </div>
            <div class="col-md-1 text-end">
              <div class="dropdown">
                <button class="btn btn-outline-primary btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown">
                  <i class="fas fa-cog"></i>
                </button>
                <ul class="dropdown-menu">
                  <li><a class="dropdown-item" href="#" onclick="showUserDetails(${user.id})">
                    <i class="fas fa-eye me-1"></i>Detayları Gör
                  </a></li>
                  ${!user.email_verified ? `
                    <li><a class="dropdown-item" href="#" onclick="verifyUser(${user.id})">
                      <i class="fas fa-check me-1"></i>E-postayı Doğrula
                    </a></li>
                  ` : ''}
                  ${!user.is_suspended ? `
                    <li><a class="dropdown-item text-danger" href="#" onclick="showSuspendUserModal(${user.id})">
                      <i class="fas fa-ban me-1"></i>Askıya Al
                    </a></li>
                  ` : `
                    <li><a class="dropdown-item text-success" href="#" onclick="unsuspendUser(${user.id})">
                      <i class="fas fa-check me-1"></i>Askıyı Kaldır
                    </a></li>
                  `}
                  ${!user.is_admin ? `
                    <li><a class="dropdown-item" href="#" onclick="makeAdmin(${user.id})">
                      <i class="fas fa-crown me-1"></i>Admin Yap
                    </a></li>
                  ` : `
                    <li><a class="dropdown-item text-warning" href="#" onclick="removeAdmin(${user.id})">
                      <i class="fas fa-user me-1"></i>Admin Yetkisini Kaldır
                    </a></li>
                  `}
                </ul>
              </div>
            </div>
          </div>
          <div class="row mt-2">
            <div class="col-md-6">
              <small class="text-muted"><i class="fas fa-calendar me-1"></i>Kayıt: ${joinDate}</small>
            </div>
            <div class="col-md-6">
              <small class="text-muted"><i class="fas fa-clock me-1"></i>Son giriş: ${lastLogin}</small>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  }

  function renderUserPagination(pagination) {
    const container = document.getElementById('userPagination');

    if (!pagination || pagination.pages <= 1) {
      container.innerHTML = '';
      return;
    }

    let html = '';

    // Previous button
    if (pagination.page > 1) {
      html += `<li class="page-item"><a class="page-link" href="#" onclick="changeUserPage(${pagination.page - 1})">Önceki</a></li>`;
    }

    // Page numbers
    for (let i = Math.max(1, pagination.page - 2); i <= Math.min(pagination.pages, pagination.page + 2); i++) {
      html += `<li class="page-item ${i === pagination.page ? 'active' : ''}">
        <a class="page-link" href="#" onclick="changeUserPage(${i})">${i}</a>
      </li>`;
    }

    // Next button
    if (pagination.page < pagination.pages) {
      html += `<li class="page-item"><a class="page-link" href="#" onclick="changeUserPage(${pagination.page + 1})">Sonraki</a></li>`;
    }

    container.innerHTML = html;
  }

  window.changeUserPage = function(page) {
    currentPage = page;
    loadUsers();
  };

  window.loadUsers = loadUsers;

  window.showUserDetails = async function(userId) {
    try {
      const response = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        const user = data.user;

        const joinDate = new Date(user.created_at).toLocaleDateString('tr-TR');
        const lastLogin = user.last_login ? new Date(user.last_login).toLocaleDateString('tr-TR') : 'Hiç giriş yapmadı';

        const html = `
          <div class="row">
            <div class="col-md-6">
              <h5><i class="fas fa-user me-2"></i>Kullanıcı Bilgileri</h5>
              <table class="table table-sm">
                <tr><td><strong>Ad Soyad:</strong></td><td>${escapeHtml(user.full_name)}</td></tr>
                <tr><td><strong>E-posta:</strong></td><td>${escapeHtml(user.email)}</td></tr>
                <tr><td><strong>Telefon:</strong></td><td>${user.phone ? escapeHtml(user.phone) : '-'}</td></tr>
                <tr><td><strong>Şehir:</strong></td><td>${user.location_city ? escapeHtml(user.location_city) : '-'}</td></tr>
                <tr><td><strong>Kayıt Tarihi:</strong></td><td>${joinDate}</td></tr>
                <tr><td><strong>Son Giriş:</strong></td><td>${lastLogin}</td></tr>
                <tr><td><strong>E-posta Durumu:</strong></td><td>
                  ${user.email_verified ? '<span class="badge bg-success">Doğrulandı</span>' : '<span class="badge bg-warning">Doğrulanmadı</span>'}
                </td></tr>
                <tr><td><strong>Hesap Durumu:</strong></td><td>
                  ${user.is_suspended ? '<span class="badge bg-danger">Askıya Alınmış</span>' : '<span class="badge bg-success">Aktif</span>'}
                </td></tr>
                ${user.is_suspended && user.suspension_reason ? `<tr><td><strong>Askıya Alma Sebebi:</strong></td><td>${escapeHtml(user.suspension_reason)}</td></tr>` : ''}
                <tr><td><strong>Yetki:</strong></td><td>
                  ${user.is_admin ? '<span class="badge bg-primary">Admin</span>' : '<span class="badge bg-secondary">Kullanıcı</span>'}
                </td></tr>
              </table>
            </div>
            <div class="col-md-6">
              <h5><i class="fas fa-chart-bar me-2"></i>İlan İstatistikleri</h5>
              <table class="table table-sm">
                <tr><td><strong>Toplam İlan:</strong></td><td>${user.total_listings || 0}</td></tr>
                <tr><td><strong>Aktif İlan:</strong></td><td>${user.active_listings || 0}</td></tr>
                <tr><td><strong>Satılan İlan:</strong></td><td>${user.sold_listings || 0}</td></tr>
                <tr><td><strong>Reddedilen İlan:</strong></td><td>${user.rejected_listings || 0}</td></tr>
              </table>

              ${user.recentListings && user.recentListings.length > 0 ? `
                <h6><i class="fas fa-list me-2"></i>Son İlanları</h6>
                <div style="max-height: 200px; overflow-y: auto;">
                  ${user.recentListings.map(listing => {
                    const listingDate = new Date(listing.created_at).toLocaleDateString('tr-TR');
                    const price = formatPrice(listing.price_minor, listing.currency);
                    const statusText = getStatusText(listing.status);
                    return `
                      <div class="card mb-2">
                        <div class="card-body p-2">
                          <h6 class="card-title mb-1">
                            <a href="/listing.html?id=${listing.id}" target="_blank" class="text-decoration-none">
                              ${escapeHtml(listing.title)}
                            </a>
                          </h6>
                          <p class="card-text mb-0">
                            <small class="text-muted">
                              ${price} • ${statusText} • ${listingDate}
                            </small>
                          </p>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              ` : '<p class="text-muted">Henüz ilan yayınlamadı.</p>'}
            </div>
          </div>
        `;

        document.getElementById('userDetailsContent').innerHTML = html;
        new bootstrap.Modal(document.getElementById('userDetailsModal')).show();

      } else {
        throw new Error('Kullanıcı detayları yüklenemedi');
      }
    } catch (error) {
      alert('Hata: ' + error.message);
    }
  };

  window.verifyUser = async function(userId) {
    if (!confirm('Bu kullanıcının e-postasını doğrulamak istediğinizden emin misiniz?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/admin/users/${userId}/verify`, {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        loadUsers();
      } else {
        throw new Error('E-posta doğrulama işlemi başarısız');
      }
    } catch (error) {
      alert('Hata: ' + error.message);
    }
  };

  window.showSuspendUserModal = function(userId) {
    currentUserId = userId;
    document.getElementById('suspensionReason').value = '';
    new bootstrap.Modal(document.getElementById('suspendUserModal')).show();
  };

  window.confirmSuspendUser = async function() {
    const reason = document.getElementById('suspensionReason').value.trim();

    if (!reason) {
      alert('Lütfen askıya alma sebebini belirtiniz.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/admin/users/${currentUserId}/suspend`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });

      if (response.ok) {
        bootstrap.Modal.getInstance(document.getElementById('suspendUserModal')).hide();
        loadUsers();
      } else {
        throw new Error('Askıya alma işlemi başarısız');
      }
    } catch (error) {
      alert('Hata: ' + error.message);
    }
  };

  window.unsuspendUser = async function(userId) {
    if (!confirm('Bu kullanıcının askısını kaldırmak istediğinizden emin misiniz?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/admin/users/${userId}/unsuspend`, {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        loadUsers();
      } else {
        throw new Error('Askıyı kaldırma işlemi başarısız');
      }
    } catch (error) {
      alert('Hata: ' + error.message);
    }
  };

  window.makeAdmin = async function(userId) {
    if (!confirm('Bu kullanıcıya admin yetkisi vermek istediğinizden emin misiniz?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/admin/users/${userId}/make-admin`, {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        loadUsers();
      } else {
        throw new Error('Admin yetkisi verme işlemi başarısız');
      }
    } catch (error) {
      alert('Hata: ' + error.message);
    }
  };

  window.removeAdmin = async function(userId) {
    if (!confirm('Bu kullanıcının admin yetkisini kaldırmak istediğinizden emin misiniz?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/admin/users/${userId}/remove-admin`, {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        loadUsers();
      } else {
        throw new Error('Admin yetkisi kaldırma işlemi başarısız');
      }
    } catch (error) {
      alert('Hata: ' + error.message);
    }
  };

  // Bulk Operations Functions
  window.updateSelectedListings = function() {
    selectedListings.clear();
    document.querySelectorAll('.listing-checkbox:checked').forEach(checkbox => {
      selectedListings.add(parseInt(checkbox.value));
    });

    const count = selectedListings.size;
    document.getElementById('selectedListingsCount').textContent = count;

    const bulkActions = document.getElementById('bulkActionsListing');
    if (count > 0) {
      bulkActions.style.display = 'block';
    } else {
      bulkActions.style.display = 'none';
    }

    // Update select all button text
    const total = document.querySelectorAll('.listing-checkbox').length;
    const selectAllText = document.getElementById('selectAllListingsText');
    if (count === total && total > 0) {
      selectAllText.textContent = 'Seçimleri Temizle';
    } else {
      selectAllText.textContent = 'Tümünü Seç';
    }
  };

  window.updateSelectedUsers = function() {
    selectedUsers.clear();
    document.querySelectorAll('.user-checkbox:checked').forEach(checkbox => {
      selectedUsers.add(parseInt(checkbox.value));
    });

    const count = selectedUsers.size;
    document.getElementById('selectedUsersCount').textContent = count;

    const bulkActions = document.getElementById('bulkActionsUsers');
    if (count > 0) {
      bulkActions.style.display = 'block';
    } else {
      bulkActions.style.display = 'none';
    }

    // Update select all button text
    const total = document.querySelectorAll('.user-checkbox').length;
    const selectAllText = document.getElementById('selectAllUsersText');
    if (count === total && total > 0) {
      selectAllText.textContent = 'Seçimleri Temizle';
    } else {
      selectAllText.textContent = 'Tümünü Seç';
    }
  };

  window.toggleSelectAllListings = function() {
    const checkboxes = document.querySelectorAll('.listing-checkbox');
    const selectAllText = document.getElementById('selectAllListingsText');

    if (selectAllText.textContent === 'Tümünü Seç') {
      checkboxes.forEach(cb => cb.checked = true);
    } else {
      checkboxes.forEach(cb => cb.checked = false);
    }

    updateSelectedListings();
  };

  window.toggleSelectAllUsers = function() {
    const checkboxes = document.querySelectorAll('.user-checkbox');
    const selectAllText = document.getElementById('selectAllUsersText');

    if (selectAllText.textContent === 'Tümünü Seç') {
      checkboxes.forEach(cb => cb.checked = true);
    } else {
      checkboxes.forEach(cb => cb.checked = false);
    }

    updateSelectedUsers();
  };

  window.bulkActionListings = async function(action) {
    if (selectedListings.size === 0) {
      alert('Lütfen işlem yapmak istediğiniz ilanları seçin.');
      return;
    }

    if (!confirm(`Seçili ${selectedListings.size} ilan için "${action}" işlemini gerçekleştirmek istediğinizden emin misiniz?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/admin/listings/bulk-action`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: action,
          listingIds: Array.from(selectedListings)
        })
      });

      if (response.ok) {
        const result = await response.json();

        if (action === 'ai-check') {
          // Show AI check results
          let successMessage = `${result.processed} ilanın AI kontrolü tamamlandı.`;
          if (result.results) {
            const autoApproved = result.results.filter(r => r.result.autoAction === 'auto_approved').length;
            const autoRejected = result.results.filter(r => r.result.autoAction === 'auto_rejected').length;
            successMessage += `\n\n🚀 Otomatik onaylanan: ${autoApproved}\n🚫 Otomatik reddedilen: ${autoRejected}`;
          }
          alert(successMessage);
        } else {
          alert(`${result.processed} ilan başarıyla işlendi.`);
        }

        // Clear selections and reload
        selectedListings.clear();
        document.querySelectorAll('.listing-checkbox:checked').forEach(cb => cb.checked = false);
        updateSelectedListings();
        loadListings();
        loadStats();

      } else {
        throw new Error('Toplu işlem başarısız');
      }
    } catch (error) {
      console.error('Bulk action error:', error);
      alert('Hata: ' + error.message);
    }
  };

  window.bulkActionUsers = async function(action) {
    if (selectedUsers.size === 0) {
      alert('Lütfen işlem yapmak istediğiniz kullanıcıları seçin.');
      return;
    }

    if (!confirm(`Seçili ${selectedUsers.size} kullanıcı için "${action}" işlemini gerçekleştirmek istediğinizden emin misiniz?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/admin/users/bulk-action`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: action,
          userIds: Array.from(selectedUsers)
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`${result.processed} kullanıcı başarıyla işlendi.`);

        // Clear selections and reload
        selectedUsers.clear();
        document.querySelectorAll('.user-checkbox:checked').forEach(cb => cb.checked = false);
        updateSelectedUsers();
        loadUsers();

      } else {
        throw new Error('Toplu işlem başarısız');
      }
    } catch (error) {
      console.error('Bulk user action error:', error);
      alert('Hata: ' + error.message);
    }
  };

  window.showBulkRejectModal = function() {
    if (selectedListings.size === 0) {
      alert('Lütfen reddetmek istediğiniz ilanları seçin.');
      return;
    }

    document.getElementById('bulkRejectCount').textContent = selectedListings.size;
    document.getElementById('bulkRejectionReason').value = '';
    new bootstrap.Modal(document.getElementById('bulkRejectModal')).show();
  };

  window.confirmBulkReject = async function() {
    const reason = document.getElementById('bulkRejectionReason').value.trim();

    if (!reason) {
      alert('Lütfen reddetme sebebini belirtiniz.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/admin/listings/bulk-action`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'reject',
          listingIds: Array.from(selectedListings),
          reason: reason
        })
      });

      if (response.ok) {
        const result = await response.json();
        bootstrap.Modal.getInstance(document.getElementById('bulkRejectModal')).hide();
        alert(`${result.processed} ilan başarıyla reddedildi.`);

        // Clear selections and reload
        selectedListings.clear();
        document.querySelectorAll('.listing-checkbox:checked').forEach(cb => cb.checked = false);
        updateSelectedListings();
        loadListings();
        loadStats();

      } else {
        throw new Error('Toplu reddetme işlemi başarısız');
      }
    } catch (error) {
      console.error('Bulk reject error:', error);
      alert('Hata: ' + error.message);
    }
  };

  window.showBulkSuspendModal = function() {
    if (selectedUsers.size === 0) {
      alert('Lütfen askıya almak istediğiniz kullanıcıları seçin.');
      return;
    }

    document.getElementById('bulkSuspendCount').textContent = selectedUsers.size;
    document.getElementById('bulkSuspensionReason').value = '';
    new bootstrap.Modal(document.getElementById('bulkSuspendModal')).show();
  };

  window.confirmBulkSuspend = async function() {
    const reason = document.getElementById('bulkSuspensionReason').value.trim();

    if (!reason) {
      alert('Lütfen askıya alma sebebini belirtiniz.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/admin/users/bulk-action`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'suspend',
          userIds: Array.from(selectedUsers),
          reason: reason
        })
      });

      if (response.ok) {
        const result = await response.json();
        bootstrap.Modal.getInstance(document.getElementById('bulkSuspendModal')).hide();
        alert(`${result.processed} kullanıcı başarıyla askıya alındı.`);

        // Clear selections and reload
        selectedUsers.clear();
        document.querySelectorAll('.user-checkbox:checked').forEach(cb => cb.checked = false);
        updateSelectedUsers();
        loadUsers();

      } else {
        throw new Error('Toplu askıya alma işlemi başarısız');
      }
    } catch (error) {
      console.error('Bulk suspend error:', error);
      alert('Hata: ' + error.message);
    }
  };

  // Analytics functions
  async function loadAnalytics() {
    try {
      const response = await fetch(`${API_BASE}/api/admin/stats/detailed`, {
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Analytics verisi alınamadı');

      const data = await response.json();
      const analytics = data.analytics;

      // Update basic stats
      document.getElementById('totalUsers').textContent = analytics.basicStats.total_users || 0;
      document.getElementById('verifiedUsers').textContent = analytics.basicStats.verified_users || 0;
      document.getElementById('soldListings').textContent = analytics.basicStats.sold_listings || 0;

      // Calculate total revenue
      const totalRevenue = analytics.revenueStats.reduce((sum, day) => sum + (day.daily_revenue || 0), 0);
      document.getElementById('totalRevenue').textContent = totalRevenue.toFixed(2) + ' TL';

      // Create charts
      createGrowthChart(analytics.growthStats);
      createCategoryChart(analytics.categoryStats);
      createTopSellersTable(analytics.topSellers);
      createRecentActivityList(analytics.recentActivity);

    } catch (error) {
      console.error('Analytics loading error:', error);
    }
  }

  function createGrowthChart(growthData) {
    const ctx = document.getElementById('growthChart').getContext('2d');

    // Process data for chart
    const dates = [...new Set(growthData.map(item => item.date))].sort();
    const userGrowth = dates.map(date => {
      const item = growthData.find(d => d.date === date && d.type === 'users');
      return item ? item.new_users : 0;
    });
    const listingGrowth = dates.map(date => {
      const item = growthData.find(d => d.date === date && d.type === 'listings');
      return item ? item.new_listings : 0;
    });

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: dates.map(date => new Date(date).toLocaleDateString('tr-TR')),
        datasets: [
          {
            label: 'Yeni Kullanıcılar',
            data: userGrowth,
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1
          },
          {
            label: 'Yeni İlanlar',
            data: listingGrowth,
            borderColor: 'rgb(255, 99, 132)',
            tension: 0.1
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Son 30 Gün Büyüme Trendi'
          }
        }
      }
    });
  }

  function createCategoryChart(categoryData) {
    const ctx = document.getElementById('categoryChart').getContext('2d');

    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: categoryData.map(cat => cat.category_name),
        datasets: [{
          data: categoryData.map(cat => cat.listing_count),
          backgroundColor: [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
            '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF',
            '#4BC0C0', '#FF6384'
          ]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Kategori Dağılımı'
          }
        }
      }
    });
  }

  function createTopSellersTable(topSellers) {
    const container = document.getElementById('topSellersTable');
    if (!topSellers.length) {
      container.innerHTML = '<p class="text-muted">Henüz satış yapan kullanıcı yok.</p>';
      return;
    }

    const table = `
      <div class="table-responsive">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>Satıcı</th>
              <th>Satış</th>
              <th>Puan</th>
              <th>Aktif İlan</th>
            </tr>
          </thead>
          <tbody>
            ${topSellers.map(seller => `
              <tr>
                <td>
                  <div class="fw-bold">${seller.full_name}</div>
                  <small class="text-muted">${seller.email}</small>
                </td>
                <td><span class="badge bg-success">${seller.sales_count}</span></td>
                <td>${seller.rating_avg ? seller.rating_avg.toFixed(1) : 'N/A'}</td>
                <td>${seller.active_listings}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    container.innerHTML = table;
  }

  function createRecentActivityList(recentActivity) {
    const container = document.getElementById('recentActivityList');
    if (!recentActivity.length) {
      container.innerHTML = '<p class="text-muted">Son 24 saatte aktivite yok.</p>';
      return;
    }

    const activityHtml = recentActivity.map(activity => {
      const icon = activity.activity_type === 'user_registration' ? 'fa-user-plus' : 'fa-plus-circle';
      const color = activity.activity_type === 'user_registration' ? 'text-success' : 'text-primary';
      const time = new Date(activity.timestamp).toLocaleString('tr-TR');

      return `
        <div class="d-flex align-items-center mb-2">
          <i class="fas ${icon} ${color} me-2"></i>
          <div class="flex-grow-1">
            <div class="fw-bold">${activity.title}</div>
            <small class="text-muted">${time}</small>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = activityHtml;
  }

  // Category Management functions
  function showCategoryManagement() {
    document.getElementById('listingsContainer').style.display = 'none';
    document.getElementById('analyticsContainer').style.display = 'none';
    document.getElementById('aiDashboardContainer').style.display = 'none';
    document.getElementById('userManagementContainer').style.display = 'none';
    document.getElementById('loadingIndicator').style.display = 'none';
    document.getElementById('pagination').style.display = 'none';
    document.getElementById('listingFilters').style.display = 'none';
    document.getElementById('categoryManagementContainer').style.display = 'block';
    loadCategories();
    setupCategoryForm();
  }

  function hideCategoryManagement() {
    document.getElementById('categoryManagementContainer').style.display = 'none';
    document.getElementById('securityLogsContainer').style.display = 'none';
    document.getElementById('listingsContainer').style.display = 'block';
    document.getElementById('pagination').style.display = 'block';
    document.getElementById('listingFilters').style.display = 'block';
  }

  function setupCategoryForm() {
    const form = document.getElementById('addCategoryForm');
    if (form && !form.hasAttribute('data-listener-added')) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await addCategory();
      });
      form.setAttribute('data-listener-added', 'true');

      // Auto-generate slug from name
      const nameInput = document.getElementById('categoryName');
      if (nameInput && !nameInput.hasAttribute('data-listener-added')) {
        nameInput.addEventListener('input', (e) => {
          const slug = e.target.value.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .trim();
          document.getElementById('categorySlug').value = slug;
        });
        nameInput.setAttribute('data-listener-added', 'true');
      }
    }
  }

  async function loadCategories() {
    try {
      const response = await fetch(`${API_BASE}/api/admin/categories`, {
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Kategoriler yüklenemedi');

      const data = await response.json();
      renderCategories(data.categories);
      updateCategoryStats(data.categories);
      updateParentSelect(data.categories);

    } catch (error) {
      console.error('Category loading error:', error);
      document.getElementById('categoriesContainer').innerHTML =
        '<div class="alert alert-danger">Kategoriler yüklenemedi: ' + error.message + '</div>';
    }
  }

  function renderCategories(categories) {
    const container = document.getElementById('categoriesContainer');

    if (!categories.length) {
      container.innerHTML = '<div class="alert alert-info">Henüz kategori bulunmuyor.</div>';
      return;
    }

    const html = `
      <div class="table-responsive">
        <table class="table table-hover">
          <thead>
            <tr>
              <th>Kategori</th>
              <th>Slug</th>
              <th>Üst Kategori</th>
              <th>İlan Sayısı</th>
              <th>Sıra</th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            ${categories.map(category => `
              <tr>
                <td>
                  <div class="fw-bold">${escapeHtml(category.name)}</div>
                  ${category.description ? `<small class="text-muted">${escapeHtml(category.description)}</small>` : ''}
                </td>
                <td><code>${escapeHtml(category.slug)}</code></td>
                <td>${category.parent_name ? escapeHtml(category.parent_name) : '<span class="text-muted">Ana Kategori</span>'}</td>
                <td>
                  <span class="badge bg-primary">${category.listing_count}</span>
                  <small class="text-muted">(<span class="text-success">${category.active_listings}</span> aktif)</small>
                </td>
                <td>
                  <span class="badge bg-info">${category.sort_order}</span>
                </td>
                <td>
                  <button class="btn btn-sm btn-outline-primary me-1" onclick="editCategory(${category.id})">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-danger" onclick="deleteCategory(${category.id})"
                          ${category.listing_count > 0 ? 'disabled title="Bu kategoride ilanlar var"' : ''}>
                    <i class="fas fa-trash"></i>
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = html;
  }

  function updateCategoryStats(categories) {
    const stats = {
      total: categories.length,
      mainCategories: categories.filter(c => !c.parent_id).length,
      totalListings: categories.reduce((sum, c) => sum + c.listing_count, 0),
      activeListings: categories.reduce((sum, c) => sum + c.active_listings, 0)
    };

    document.getElementById('categoryStatsContainer').innerHTML = `
      <div class="row text-center">
        <div class="col-6">
          <div class="stat-number text-primary">${stats.total}</div>
          <div class="text-muted small">Toplam Kategori</div>
        </div>
        <div class="col-6">
          <div class="stat-number text-success">${stats.mainCategories}</div>
          <div class="text-muted small">Ana Kategori</div>
        </div>
        <div class="col-6">
          <div class="stat-number text-info">${stats.totalListings}</div>
          <div class="text-muted small">Toplam İlan</div>
        </div>
        <div class="col-6">
          <div class="stat-number text-warning">${stats.activeListings}</div>
          <div class="text-muted small">Aktif İlan</div>
        </div>
      </div>
    `;
  }

  function updateParentSelect(categories) {
    const select = document.getElementById('categoryParent');
    const mainCategories = categories.filter(c => !c.parent_id);

    select.innerHTML = '<option value="">Ana Kategori</option>';
    mainCategories.forEach(category => {
      select.innerHTML += `<option value="${category.id}">${escapeHtml(category.name)}</option>`;
    });
  }

  async function addCategory() {
    try {
      const formData = {
        name: document.getElementById('categoryName').value,
        slug: document.getElementById('categorySlug').value,
        description: document.getElementById('categoryDescription').value,
        parent_id: document.getElementById('categoryParent').value || null,
        sort_order: parseInt(document.getElementById('categorySortOrder').value) || 0
      };

      const response = await fetch(`${API_BASE}/api/admin/categories`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        document.getElementById('addCategoryForm').reset();
        document.getElementById('categorySortOrder').value = '0';
        loadCategories();
        alert('Kategori başarıyla eklendi!');
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Kategori eklenemedi');
      }
    } catch (error) {
      alert('Hata: ' + error.message);
    }
  }

  window.editCategory = async function(id) {
    try {
      // Get category data
      const response = await fetch(`${API_BASE}/api/admin/categories`, {
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Kategori verisi alınamadı');

      const data = await response.json();
      const category = data.categories.find(c => c.id === id);

      if (!category) throw new Error('Kategori bulunamadı');

      // Populate modal
      document.getElementById('editCategoryId').value = category.id;
      document.getElementById('editCategoryName').value = category.name;
      document.getElementById('editCategorySlug').value = category.slug;
      document.getElementById('editCategoryDescription').value = category.description || '';
      document.getElementById('editCategorySortOrder').value = category.sort_order || 0;

      // Update parent select
      const editParentSelect = document.getElementById('editCategoryParent');
      const mainCategories = data.categories.filter(c => !c.parent_id && c.id !== id);

      editParentSelect.innerHTML = '<option value="">Ana Kategori</option>';
      mainCategories.forEach(cat => {
        const selected = category.parent_id === cat.id ? 'selected' : '';
        editParentSelect.innerHTML += `<option value="${cat.id}" ${selected}>${escapeHtml(cat.name)}</option>`;
      });

      // Show modal
      const modal = new bootstrap.Modal(document.getElementById('editCategoryModal'));
      modal.show();

      // Auto-generate slug from name in edit modal
      const editNameInput = document.getElementById('editCategoryName');
      if (!editNameInput.hasAttribute('data-edit-listener-added')) {
        editNameInput.addEventListener('input', (e) => {
          const slug = e.target.value.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .trim();
          document.getElementById('editCategorySlug').value = slug;
        });
        editNameInput.setAttribute('data-edit-listener-added', 'true');
      }

    } catch (error) {
      alert('Hata: ' + error.message);
    }
  };

  window.updateCategory = async function() {
    try {
      const id = document.getElementById('editCategoryId').value;
      const formData = {
        name: document.getElementById('editCategoryName').value,
        slug: document.getElementById('editCategorySlug').value,
        description: document.getElementById('editCategoryDescription').value,
        parent_id: document.getElementById('editCategoryParent').value || null,
        sort_order: parseInt(document.getElementById('editCategorySortOrder').value) || 0
      };

      const response = await fetch(`${API_BASE}/api/admin/categories/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const modal = bootstrap.Modal.getInstance(document.getElementById('editCategoryModal'));
        modal.hide();
        loadCategories();
        alert('Kategori başarıyla güncellendi!');
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Kategori güncellenemedi');
      }
    } catch (error) {
      alert('Hata: ' + error.message);
    }
  };

  window.deleteCategory = async function(id) {
    if (!confirm('Bu kategoriyi silmek istediğinizden emin misiniz?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/admin/categories/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        loadCategories();
        alert('Kategori başarıyla silindi!');
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Kategori silinemedi');
      }
    } catch (error) {
      alert('Hata: ' + error.message);
    }
  };

  window.loadCategories = loadCategories;

  // Security & Logs functions
  let currentSecurityTab = 'security-events';

  function showSecurityLogs() {
    document.getElementById('listingsContainer').style.display = 'none';
    document.getElementById('analyticsContainer').style.display = 'none';
    document.getElementById('aiDashboardContainer').style.display = 'none';
    document.getElementById('userManagementContainer').style.display = 'none';
    document.getElementById('categoryManagementContainer').style.display = 'none';
    document.getElementById('loadingIndicator').style.display = 'none';
    document.getElementById('pagination').style.display = 'none';
    document.getElementById('listingFilters').style.display = 'none';
    document.getElementById('securityLogsContainer').style.display = 'block';
    loadSecurityEvents();
    setupSecurityTabs();
  }

  function hideSecurityLogs() {
    document.getElementById('securityLogsContainer').style.display = 'none';
    document.getElementById('listingsContainer').style.display = 'block';
    document.getElementById('pagination').style.display = 'block';
    document.getElementById('listingFilters').style.display = 'block';
  }

  function setupSecurityTabs() {
    document.querySelectorAll('#securityTabs .nav-link').forEach(tab => {
      tab.addEventListener('click', function(e) {
        e.preventDefault();
        const newTab = this.dataset.securityTab;

        if (newTab !== currentSecurityTab) {
          document.querySelectorAll('#securityTabs .nav-link').forEach(t => t.classList.remove('active'));
          this.classList.add('active');
          currentSecurityTab = newTab;

          // Hide all containers
          document.getElementById('securityEventsContainer').style.display = 'none';
          document.getElementById('activityLogsContainer').style.display = 'none';
          document.getElementById('adminSessionsContainer').style.display = 'none';

          // Show selected container
          if (newTab === 'security-events') {
            document.getElementById('securityEventsContainer').style.display = 'block';
            loadSecurityEvents();
          } else if (newTab === 'activity-logs') {
            document.getElementById('activityLogsContainer').style.display = 'block';
            loadActivityLogs();
          } else if (newTab === 'admin-sessions') {
            document.getElementById('adminSessionsContainer').style.display = 'block';
            loadAdminSessions();
          }
        }
      });
    });
  }

  async function loadSecurityEvents() {
    try {
      const eventType = document.getElementById('eventTypeFilter')?.value || '';
      const severity = document.getElementById('severityFilter')?.value || '';
      const resolved = document.getElementById('resolvedFilter')?.value || '';

      const params = new URLSearchParams({
        page: 1,
        limit: 20
      });

      if (eventType) params.append('event_type', eventType);
      if (severity) params.append('severity', severity);
      if (resolved) params.append('resolved', resolved);

      const response = await fetch(`${API_BASE}/api/admin/security/events?${params}`, {
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Security events yüklenemedi');

      const data = await response.json();
      renderSecurityEvents(data.events);
      updateSecurityStats(data.stats);

    } catch (error) {
      console.error('Security events loading error:', error);
      document.getElementById('securityEventsTable').innerHTML =
        '<div class="alert alert-danger">Security events yüklenemedi: ' + error.message + '</div>';
    }
  }

  function renderSecurityEvents(events) {
    const container = document.getElementById('securityEventsTable');

    if (!events.length) {
      container.innerHTML = '<div class="alert alert-info">Güvenlik olayı bulunmuyor.</div>';
      return;
    }

    const html = `
      <div class="table-responsive">
        <table class="table table-hover">
          <thead>
            <tr>
              <th>Olay</th>
              <th>Kullanıcı</th>
              <th>Seviye</th>
              <th>IP</th>
              <th>Tarih</th>
              <th>Durum</th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            ${events.map(event => `
              <tr>
                <td>
                  <div class="fw-bold">${getEventTypeText(event.event_type)}</div>
                  <small class="text-muted">${escapeHtml(event.description || '')}</small>
                </td>
                <td>
                  ${event.full_name ? `
                    <div class="fw-bold">${escapeHtml(event.full_name)}</div>
                    <small class="text-muted">${escapeHtml(event.email)}</small>
                  ` : '<span class="text-muted">Bilinmiyor</span>'}
                </td>
                <td>${getSeverityBadge(event.severity)}</td>
                <td><code>${event.ip_address || 'N/A'}</code></td>
                <td>${new Date(event.created_at).toLocaleString('tr-TR')}</td>
                <td>
                  ${event.resolved ?
                    '<span class="badge bg-success">Çözüldü</span>' :
                    '<span class="badge bg-warning">Bekliyor</span>'
                  }
                </td>
                <td>
                  ${!event.resolved ? `
                    <button class="btn btn-sm btn-outline-success" onclick="resolveSecurityEvent(${event.id})">
                      <i class="fas fa-check"></i> Çöz
                    </button>
                  ` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = html;
  }

  function getEventTypeText(type) {
    const types = {
      'login_failed': 'Başarısız Giriş',
      'login_success': 'Başarılı Giriş',
      'password_changed': 'Şifre Değişimi',
      'suspicious_activity': 'Şüpheli Aktivite',
      'account_locked': 'Hesap Kilidi',
      'data_breach': 'Veri İhlali'
    };
    return types[type] || type;
  }

  function getSeverityBadge(severity) {
    const severities = {
      'critical': '<span class="badge bg-danger">Kritik</span>',
      'high': '<span class="badge bg-warning">Yüksek</span>',
      'medium': '<span class="badge bg-info">Orta</span>',
      'low': '<span class="badge bg-secondary">Düşük</span>'
    };
    return severities[severity] || severity;
  }

  function updateSecurityStats(stats) {
    document.getElementById('securityCritical').textContent = stats.critical_count || 0;
    document.getElementById('securityHigh').textContent = stats.high_count || 0;
    document.getElementById('failedLogins').textContent = stats.failed_logins_24h || 0;
  }

  async function loadActivityLogs() {
    try {
      const action = document.getElementById('actionFilter')?.value || '';
      const resourceType = document.getElementById('resourceFilter')?.value || '';
      const search = document.getElementById('activitySearchInput')?.value || '';

      const params = new URLSearchParams({
        page: 1,
        limit: 20
      });

      if (action) params.append('action', action);
      if (resourceType) params.append('resource_type', resourceType);
      if (search) params.append('search', search);

      const response = await fetch(`${API_BASE}/api/admin/security/activity-logs?${params}`, {
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Activity logs yüklenemedi');

      const data = await response.json();
      renderActivityLogs(data.logs);
      document.getElementById('totalActions').textContent = data.stats.total_actions || 0;

    } catch (error) {
      console.error('Activity logs loading error:', error);
      document.getElementById('activityLogsTable').innerHTML =
        '<div class="alert alert-danger">Activity logs yüklenemedi: ' + error.message + '</div>';
    }
  }

  function renderActivityLogs(logs) {
    const container = document.getElementById('activityLogsTable');

    if (!logs.length) {
      container.innerHTML = '<div class="alert alert-info">Aktivite logu bulunmuyor.</div>';
      return;
    }

    const html = `
      <div class="table-responsive">
        <table class="table table-hover">
          <thead>
            <tr>
              <th>İşlem</th>
              <th>Kullanıcı</th>
              <th>Kaynak</th>
              <th>IP</th>
              <th>Tarih</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map(log => `
              <tr>
                <td>
                  <span class="badge bg-primary">${escapeHtml(log.action)}</span>
                </td>
                <td>
                  ${log.full_name ? `
                    <div class="fw-bold">${escapeHtml(log.full_name)}</div>
                    <small class="text-muted">${escapeHtml(log.email)}</small>
                  ` : '<span class="text-muted">Sistem</span>'}
                </td>
                <td>
                  ${log.resource_type ? `
                    <div>${escapeHtml(log.resource_type)}</div>
                    ${log.resource_id ? `<small class="text-muted">ID: ${log.resource_id}</small>` : ''}
                  ` : '-'}
                </td>
                <td><code>${log.ip_address || 'N/A'}</code></td>
                <td>${new Date(log.created_at).toLocaleString('tr-TR')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = html;
  }

  async function loadAdminSessions() {
    try {
      const response = await fetch(`${API_BASE}/api/admin/security/admin-sessions`, {
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Admin sessions yüklenemedi');

      const data = await response.json();
      renderAdminSessions(data.sessions);

    } catch (error) {
      console.error('Admin sessions loading error:', error);
      document.getElementById('adminSessionsTable').innerHTML =
        '<div class="alert alert-danger">Admin sessions yüklenemedi: ' + error.message + '</div>';
    }
  }

  function renderAdminSessions(sessions) {
    const container = document.getElementById('adminSessionsTable');

    if (!sessions.length) {
      container.innerHTML = '<div class="alert alert-info">Aktif admin oturumu bulunmuyor.</div>';
      return;
    }

    const html = `
      <div class="table-responsive">
        <table class="table table-hover">
          <thead>
            <tr>
              <th>Admin</th>
              <th>Son Aktivite</th>
              <th>İşlem Sayısı</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            ${sessions.map(session => `
              <tr>
                <td>
                  <div class="fw-bold">${escapeHtml(session.full_name)}</div>
                  <small class="text-muted">${escapeHtml(session.email)}</small>
                </td>
                <td>${new Date(session.last_activity).toLocaleString('tr-TR')}</td>
                <td><span class="badge bg-info">${session.action_count}</span></td>
                <td><span class="badge bg-success">Aktif</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = html;
  }

  window.resolveSecurityEvent = async function(id) {
    try {
      const response = await fetch(`${API_BASE}/api/admin/security/events/${id}/resolve`, {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        loadSecurityEvents();
        alert('Güvenlik olayı çözüldü olarak işaretlendi!');
      } else {
        throw new Error('İşlem başarısız');
      }
    } catch (error) {
      alert('Hata: ' + error.message);
    }
  };

  window.markAllResolved = async function() {
    if (!confirm('Tüm güvenlik olaylarını çözüldü olarak işaretlemek istediğinizden emin misiniz?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/admin/security/events/resolve-all`, {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        loadSecurityEvents();
        alert('Tüm güvenlik olayları çözüldü olarak işaretlendi!');
      } else {
        throw new Error('İşlem başarısız');
      }
    } catch (error) {
      alert('Hata: ' + error.message);
    }
  };

  window.loadSecurityEvents = loadSecurityEvents;
  window.loadActivityLogs = loadActivityLogs;

  // Expose analytics function globally
  window.loadAnalytics = loadAnalytics;

  // Dashboard navigation function
  window.showDashboard = function(event) {
    if (event) {
      event.preventDefault();
    }

    // Hide all tab content
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.style.display = 'none';
    });

    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });

    // Show dashboard and activate its tab
    const dashboardTab = document.getElementById('dashboard');
    const dashboardNavLink = document.querySelector('[onclick="showTab(\'dashboard\')"]');

    if (dashboardTab) {
      dashboardTab.style.display = 'block';
    }
    if (dashboardNavLink) {
      dashboardNavLink.classList.add('active');
    }

    // Reload dashboard data
    loadAdminStats();
    loadAnalytics();

    return false;
  };

  // ============================================
  // Test Runner Functions
  // ============================================

  function showTestRunner() {
    console.log('📊 Showing test runner');

    // Hide other containers
    document.getElementById('listingsContainer').style.display = 'none';
    document.getElementById('analyticsContainer').style.display = 'none';
    document.getElementById('aiDashboardContainer').style.display = 'none';
    document.getElementById('userManagementContainer').style.display = 'none';
    document.getElementById('categoryManagementContainer').style.display = 'none';
    document.getElementById('securityLogsContainer').style.display = 'none';
    document.getElementById('listingFilters').style.display = 'none';

    // Show or create test runner container
    let testContainer = document.getElementById('testRunnerContainer');
    if (!testContainer) {
      testContainer = document.createElement('div');
      testContainer.id = 'testRunnerContainer';
      document.querySelector('.tab-content').appendChild(testContainer);
    }

    testContainer.style.display = 'block';
    testContainer.innerHTML = `
      <div class="card">
        <div class="card-header bg-primary text-white">
          <h4 class="mb-0"><i class="fas fa-flask me-2"></i>Test Runner</h4>
        </div>
        <div class="card-body">
          <div class="row mb-4">
            <div class="col-md-6">
              <h5>Test Kontrolü</h5>
              <button class="btn btn-info" onclick="checkTestStatus()">
                <i class="fas fa-heartbeat me-2"></i>Test Durumunu Kontrol Et
              </button>
              <div id="testStatus" class="mt-3"></div>
            </div>
            <div class="col-md-6">
              <h5>Test Türü Seç</h5>
              <select class="form-select mb-3" id="testTypeSelect">
                <option value="all">Tüm Testler</option>
                <option value="unit">Unit Testler</option>
                <option value="integration">Integration Testler</option>
                <option value="api">API Testler</option>
              </select>
              <button class="btn btn-success btn-lg w-100" onclick="runTests()">
                <i class="fas fa-play me-2"></i>Testleri Çalıştır
              </button>
            </div>
          </div>

          <div id="testResults" class="mt-4"></div>
        </div>
      </div>
    `;

    // Check test status on load
    checkTestStatus();
  }

  function hideTestRunner() {
    const testContainer = document.getElementById('testRunnerContainer');
    if (testContainer) {
      testContainer.style.display = 'none';
    }
  }

  window.checkTestStatus = async function() {
    const statusDiv = document.getElementById('testStatus');
    statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Kontrol ediliyor...';

    try {
      const response = await fetch(`${API_BASE}/api/test/status`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      const data = await response.json();

      if (data.ok && data.available) {
        statusDiv.innerHTML = `
          <div class="alert alert-success">
            <i class="fas fa-check-circle me-2"></i>
            <strong>Test sistemi hazır!</strong><br>
            Jest Version: ${data.jest_version}<br>
            Node Environment: ${data.node_env}
          </div>
        `;
      } else {
        statusDiv.innerHTML = `
          <div class="alert alert-warning">
            <i class="fas fa-exclamation-triangle me-2"></i>
            <strong>Test sistemi bulunamadı</strong><br>
            ${data.error || 'Jest yüklü değil'}
          </div>
        `;
      }
    } catch (error) {
      statusDiv.innerHTML = `
        <div class="alert alert-danger">
          <i class="fas fa-times-circle me-2"></i>
          <strong>Hata:</strong> ${error.message}
        </div>
      `;
    }
  };

  window.runTests = async function() {
    const testType = document.getElementById('testTypeSelect').value;
    const resultsDiv = document.getElementById('testResults');

    resultsDiv.innerHTML = `
      <div class="alert alert-info">
        <i class="fas fa-spinner fa-spin me-2"></i>
        <strong>Testler çalışıyor...</strong> Bu işlem birkaç saniye sürebilir.
      </div>
    `;

    try {
      const response = await fetch(`${API_BASE}/api/test/run`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ type: testType })
      });

      const data = await response.json();
      console.log('📊 Test data received:', data);

      if (data.ok && data.results) {
        let results = data.results;
        console.log('📊 Test results:', results);
        console.log('📊 Test results keys:', Object.keys(results));
        console.log('📊 Test files (raw):', results.testResults);

        // Transform test results if backend didn't do it (fallback)
        if (results.testResults && results.testResults.length > 0 && results.testResults[0].assertionResults) {
          console.log('📊 Transforming test results in frontend...');
          results.testResults = results.testResults.map(testFile => {
            const assertions = testFile.assertionResults || [];
            return {
              name: testFile.name.split(/[\\/]/).pop(),
              status: testFile.status,
              numTests: assertions.length,
              numPassed: assertions.filter(t => t.status === 'passed').length,
              numFailed: assertions.filter(t => t.status === 'failed').length,
              tests: assertions.map(test => ({
                title: test.title || test.ancestorTitles?.join(' > ') || 'Unknown test',
                fullName: test.fullName,
                status: test.status,
                duration: test.duration,
                failureMessages: test.failureMessages
              }))
            };
          });
          console.log('📊 Test files (transformed):', results.testResults);
        }

        // Build results HTML
        let html = `
          <div class="card ${results.success ? 'border-success' : 'border-danger'}">
            <div class="card-header ${results.success ? 'bg-success' : 'bg-danger'} text-white">
              <h5 class="mb-0">
                <i class="fas ${results.success ? 'fa-check-circle' : 'fa-times-circle'} me-2"></i>
                Test Sonuçları
              </h5>
            </div>
            <div class="card-body">
              <div class="row text-center mb-3">
                <div class="col-md-3">
                  <div class="h3 text-primary">${results.numTotalTests || 0}</div>
                  <div class="text-muted">Toplam</div>
                </div>
                <div class="col-md-3">
                  <div class="h3 text-success">${results.numPassedTests || 0}</div>
                  <div class="text-muted">Başarılı</div>
                </div>
                <div class="col-md-3">
                  <div class="h3 text-danger">${results.numFailedTests || 0}</div>
                  <div class="text-muted">Başarısız</div>
                </div>
                <div class="col-md-3">
                  <div class="h3 text-warning">${results.numPendingTests || 0}</div>
                  <div class="text-muted">Bekleyen</div>
                </div>
              </div>
        `;

        if (results.testResults && results.testResults.length > 0) {
          console.log('📊 Processing test results, total files:', results.testResults.length);
          console.log('📊 Sample test file:', results.testResults[0]);

          // Show failed tests first - handle both property names
          const failedFiles = results.testResults.filter(f => (f.numFailed || 0) > 0);
          const passedFiles = results.testResults.filter(f => (f.numFailed || 0) === 0 && (f.numPassed || f.numTests || 0) > 0);

          console.log('📊 Failed files:', failedFiles.length, failedFiles);
          console.log('📊 Passed files:', passedFiles.length, passedFiles);

          if (failedFiles.length > 0) {
            html += '<h6 class="text-danger mt-3"><i class="fas fa-exclamation-triangle"></i> Başarısız Testler:</h6>';

            failedFiles.forEach(testFile => {
              html += `
                <div class="card mb-2 border-danger">
                  <div class="card-header bg-danger text-white">
                    <strong>${testFile.name}</strong>
                    <span class="badge bg-light text-danger float-end">
                      ${testFile.numFailed} başarısız / ${testFile.numTests} toplam
                    </span>
                  </div>
                  <div class="card-body">
              `;

              if (testFile.tests && testFile.tests.length > 0) {
                html += '<ul class="list-unstyled mb-0">';
                testFile.tests.forEach(test => {
                  const icon = test.status === 'passed' ?
                    '<i class="fas fa-check text-success"></i>' :
                    '<i class="fas fa-times text-danger"></i>';
                  const testClass = test.status === 'failed' ? 'fw-bold' : '';
                  html += `
                    <li class="mb-2 ${testClass}">
                      ${icon} ${test.title}
                      ${test.duration ? `<small class="text-muted">(${test.duration}ms)</small>` : ''}
                  `;

                  if (test.failureMessages && test.failureMessages.length > 0) {
                    html += `
                      <div class="alert alert-danger mt-1 mb-1 small">
                        <strong>Hata:</strong><br>
                        <pre class="mb-0" style="white-space: pre-wrap;">${test.failureMessages.join('\n')}</pre>
                      </div>
                    `;
                  }
                  html += '</li>';
                });
                html += '</ul>';
              }

              html += '</div></div>';
            });
          }

          if (passedFiles.length > 0) {
            html += '<h6 class="text-success mt-3"><i class="fas fa-check-circle"></i> Başarılı Testler:</h6>';

            passedFiles.forEach(testFile => {
              html += `
                <div class="card mb-2 border-success">
                  <div class="card-header bg-success text-white">
                    <strong>${testFile.name}</strong>
                    <span class="badge bg-light text-success float-end">
                      ${testFile.numPassed}/${testFile.numTests} geçti
                    </span>
                  </div>
                  <div class="card-body">
              `;

              if (testFile.tests && testFile.tests.length > 0) {
                html += '<ul class="list-unstyled mb-0">';
                testFile.tests.forEach(test => {
                  html += `
                    <li class="mb-1">
                      <i class="fas fa-check text-success"></i> ${test.title}
                      ${test.duration ? `<small class="text-muted">(${test.duration}ms)</small>` : ''}
                    </li>
                  `;
                });
                html += '</ul>';
              }

              html += '</div></div>';
            });
          }
        }

        html += '</div></div>';
        resultsDiv.innerHTML = html;
      } else {
        resultsDiv.innerHTML = `
          <div class="alert alert-danger">
            <i class="fas fa-times-circle me-2"></i>
            <strong>Hata:</strong> ${data.results?.error || 'Testler çalıştırılamadı'}
          </div>
        `;
      }
    } catch (error) {
      resultsDiv.innerHTML = `
        <div class="alert alert-danger">
          <i class="fas fa-times-circle me-2"></i>
          <strong>Hata:</strong> ${error.message}
        </div>
      `;
    }
  };

})();