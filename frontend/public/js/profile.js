// public/js/profile.js
(function(){
  const API_BASE = window.getCorrectApiBase ? window.getCorrectApiBase() : (window.APP && window.APP.API_BASE) || '';
  const $ = (s,r=document)=>r.querySelector(s);

  // --- helpers
  const esc = (s)=> (s??'').toString().replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m]));
  const toTL = (minor, cur='TRY') => {
    const v = (Number(minor)||0) / 100;
    try { return v.toLocaleString('tr-TR',{style:'currency',currency:cur||'TRY'}); }
    catch { return `${v.toLocaleString('tr-TR')} ${esc(cur||'TRY')}`; }
  };
  const noStoreHeaders = { 'Accept':'application/json', 'Cache-Control':'no-cache' };

  function getTab(){
    const u = new URL(location.href);
    const qTab = u.searchParams.get('tab');
    if (qTab) return qTab;
    const h = (u.hash || '').replace('#','').trim();
    if (['orders','edit','mylistings','sales','trades','messages','notifications','overview','legal'].includes(h)) return h || 'overview';
    return 'overview';
  }
  function setActive(tab){
    document.querySelectorAll('#tabs a')
      .forEach(a=>a.classList.toggle('active', a?.dataset?.tab===tab));
  }
  function redirectToLogin(){
    const u = new URL('/login.html', location.origin);
    u.searchParams.set('redirect', location.pathname + location.search + location.hash);
    location.href = u.toString();
  }
  async function fetchJSON(url, opts = {}){
    const r = await fetch(url, {
      credentials:'include',
      cache: 'no-store',
      headers: noStoreHeaders,
      ...opts
    });
    if (r.status === 401) { redirectToLogin(); throw new Error('Unauthorized'); }
    if (!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  }
  async function requireLogin(){
    try{
      const r = await fetch(`${API_BASE}/api/auth/me`, {
        credentials:'include',
        cache:'no-store',
        headers: noStoreHeaders
      });
      if(!r.ok) throw 0;
      const d = await r.json();
      return d.user || d;
    }catch{
      redirectToLogin();
      throw new Error('not-authenticated');
    }
  }

  // ---- cancel API
  async function cancelOrder(id){
    try {
      const data = await (window.API && window.API.orders
        ? window.API.orders.cancel(id)
        : (async () => {
            const url = new URL(`${API_BASE}/api/orders/${id}/cancel`);
            url.searchParams.set('_ts', Date.now());
            const r = await fetch(url, {
              method: 'POST',
              credentials: 'include',
              cache: 'no-store',
              headers: { 'Accept':'application/json', 'Cache-Control':'no-cache' }
            });
            let d = {};
            try { d = await r.json(); } catch {}
            if (!r.ok || d.ok === false) throw new Error(d.error || `HTTP_${r.status}`);
            return d;
          })()
      );
      return data;
    } catch (e) {
      throw e;
    }
  }

  // ---- OVERVIEW
  async function renderOverview(root){
    if (!root) return;
    root.innerHTML = `<div class="pad">Yükleniyor…</div>`;
    try{
      const me = await fetchJSON(`${API_BASE}/api/auth/me?_ts=${Date.now()}`);
      const u = me.user || me;

      root.innerHTML = `
        <div class="profile-overview">
          <div class="overview-header">
            <div class="user-avatar">
              <i class="fas fa-user-circle fa-4x text-primary"></i>
            </div>
            <div class="user-info">
              <h2>${esc(u.full_name || 'İsimsiz Kullanıcı')}</h2>
              <p class="text-muted">${esc(u.email || '')}</p>
              <div class="user-stats">
                <span class="badge bg-success">Aktif Üye</span>
                ${u.kyc_status === 'verified' ? '<span class="badge bg-primary ms-2">Doğrulanmış</span>' : ''}
              </div>
            </div>
          </div>

          <!-- Quick Stats Dashboard -->
          <div class="overview-stats mb-4">
            <div class="row">
              <div class="col-md-3">
                <div class="stat-card-overview">
                  <div class="stat-icon">
                    <i class="fas fa-list-alt text-primary"></i>
                  </div>
                  <div class="stat-info">
                    <div class="stat-number" id="userListingsCount">-</div>
                    <div class="stat-label">Aktif İlanım</div>
                  </div>
                </div>
              </div>
              <div class="col-md-3">
                <div class="stat-card-overview">
                  <div class="stat-icon">
                    <i class="fas fa-exchange-alt text-success"></i>
                  </div>
                  <div class="stat-info">
                    <div class="stat-number" id="userTradesCount">-</div>
                    <div class="stat-label">Takas Teklifim</div>
                  </div>
                </div>
              </div>
              <div class="col-md-3">
                <div class="stat-card-overview">
                  <div class="stat-icon">
                    <i class="fas fa-envelope text-warning"></i>
                  </div>
                  <div class="stat-info">
                    <div class="stat-number" id="userMessagesCount">-</div>
                    <div class="stat-label">Okunmamış Mesaj</div>
                  </div>
                </div>
              </div>
              <div class="col-md-3">
                <div class="stat-card-overview">
                  <div class="stat-icon">
                    <i class="fas fa-bell text-info"></i>
                  </div>
                  <div class="stat-info">
                    <div class="stat-number" id="userNotificationsCount">-</div>
                    <div class="stat-label">Bildirim</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="overview-sections">
            <!-- Kişisel Bilgiler -->
            <div class="overview-card">
              <div class="card-header">
                <h5><i class="fas fa-user me-2"></i>Kişisel Bilgiler</h5>
                <a href="?tab=edit" class="btn btn-sm btn-outline-primary">
                  <i class="fas fa-edit me-1"></i>Düzenle
                </a>
              </div>
              <div class="card-content">
                <div class="info-grid">
                  <div class="info-item">
                    <span class="label">Ad Soyad:</span>
                    <span class="value">${esc(u.full_name || '-')}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">E-posta:</span>
                    <span class="value">${esc(u.email || '-')}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">Telefon:</span>
                    <span class="value">${esc(u.phone_e164 || '-')}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">Yaş Grubu:</span>
                    <span class="value">${esc(u.age_group || '-')}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">Cinsiyet:</span>
                    <span class="value">${u.gender === 'male' ? 'Erkek' : u.gender === 'female' ? 'Kadın' : '-'}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">Meslek:</span>
                    <span class="value">${u.occupation === 'student' ? 'Öğrenci' :
                                        u.occupation === 'employee' ? 'Çalışan' :
                                        u.occupation === 'self_employed' ? 'Serbest Meslek' :
                                        u.occupation === 'business_owner' ? 'İşveren' :
                                        u.occupation === 'retired' ? 'Emekli' :
                                        u.occupation === 'other' ? 'Diğer' : '-'}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">Şehir:</span>
                    <span class="value">${u.city === 'istanbul' ? 'İstanbul' :
                                        u.city === 'ankara' ? 'Ankara' :
                                        u.city === 'izmir' ? 'İzmir' :
                                        u.city === 'bursa' ? 'Bursa' :
                                        u.city === 'antalya' ? 'Antalya' :
                                        u.city === 'other' ? 'Diğer' : u.city || '-'}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">İlçe:</span>
                    <span class="value">${esc(u.district || '-')}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Alışveriş Tercihleri -->
            <div class="overview-card">
              <div class="card-header">
                <h5><i class="fas fa-shopping-bag me-2"></i>Alışveriş Tercihleri</h5>
              </div>
              <div class="card-content">
                <div class="info-grid">
                  <div class="info-item">
                    <span class="label">Ortalama Bütçe:</span>
                    <span class="value">${u.budget_range || '-'}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">Teslimat Tercihi:</span>
                    <span class="value">${u.delivery_preference === 'cargo' ? 'Kargo' :
                                        u.delivery_preference === 'hand_delivery' ? 'Elden Teslim' :
                                        u.delivery_preference === 'both' ? 'İkisi de' : '-'}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">Ödeme Tercihi:</span>
                    <span class="value">${u.payment_preference === 'cash' ? 'Nakit' :
                                        u.payment_preference === 'card' ? 'Kredi Kartı' :
                                        u.payment_preference === 'bank_transfer' ? 'Havale/EFT' :
                                        u.payment_preference === 'all' ? 'Tümü' : '-'}</span>
                  </div>
                  <div class="info-item span-full">
                    <span class="label">Favori Kategoriler:</span>
                    <div class="categories-list">
                      ${u.favorite_categories && u.favorite_categories.length > 0 ?
                        u.favorite_categories.map(cat => {
                          const catName = cat === 'electronics' ? 'Elektronik' :
                                         cat === 'fashion' ? 'Moda' :
                                         cat === 'home' ? 'Ev & Bahçe' :
                                         cat === 'automotive' ? 'Otomotiv' : cat;
                          return `<span class="category-badge">${catName}</span>`;
                        }).join('') : '<span class="text-muted">Seçilmedi</span>'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Gizlilik Ayarları -->
            <div class="overview-card">
              <div class="card-header">
                <h5><i class="fas fa-shield-alt me-2"></i>Gizlilik & Bildirimler</h5>
              </div>
              <div class="card-content">
                <div class="privacy-indicators">
                  <div class="privacy-item">
                    <i class="fas fa-${u.email_notifications !== false ? 'check-circle text-success' : 'times-circle text-danger'} me-2"></i>
                    E-posta Bildirimleri
                  </div>
                  <div class="privacy-item">
                    <i class="fas fa-${u.sms_notifications === true ? 'check-circle text-success' : 'times-circle text-danger'} me-2"></i>
                    SMS Bildirimleri
                  </div>
                  <div class="privacy-item">
                    <i class="fas fa-${u.marketing_emails === true ? 'check-circle text-success' : 'times-circle text-danger'} me-2"></i>
                    Pazarlama E-postaları
                  </div>
                  <div class="privacy-item">
                    <i class="fas fa-${u.profile_visible !== false ? 'eye text-success' : 'eye-slash text-danger'} me-2"></i>
                    Profil Görünürlüğü
                  </div>
                  <div class="privacy-item">
                    <i class="fas fa-${u.show_phone === true ? 'phone text-success' : 'phone-slash text-danger'} me-2"></i>
                    Telefon Numarasını Göster
                  </div>
                  <div class="privacy-item">
                    <i class="fas fa-${u.show_last_seen !== false ? 'clock text-success' : 'user-clock text-danger'} me-2"></i>
                    Son Görülme
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      // Load dashboard statistics
      loadOverviewStats();
    }catch{
      root.innerHTML = `<div class="pad error">Bilgiler alınamadı.</div>`;
    }
  }

  // Load overview dashboard statistics
  async function loadOverviewStats() {
    try {
      // Load statistics in parallel
      const [listings, trades, messages, notifications] = await Promise.all([
        fetchJSON(`${API_BASE}/api/listings/my?limit=1000`).catch(() => ({listings: []})),
        Promise.all([
          fetchTradeOffers('sent').catch(() => []),
          fetchTradeOffers('received').catch(() => [])
        ]).then(([sent, received]) => [...sent, ...received]),
        fetchJSON(`${API_BASE}/api/messages/threads`).catch(() => ({threads: []})),
        fetchJSON(`${API_BASE}/api/notifications`).catch(() => ({notifications: []}))
      ]);

      // Update listings count
      const activeListings = listings.listings ? listings.listings.filter(l => l.status === 'active').length : 0;
      const listingsEl = document.getElementById('userListingsCount');
      if (listingsEl) listingsEl.textContent = activeListings;

      // Update trades count
      const pendingTrades = trades.filter(t => t.status === 'pending').length;
      const tradesEl = document.getElementById('userTradesCount');
      if (tradesEl) tradesEl.textContent = pendingTrades;

      // Update messages count
      const unreadMessages = messages.threads ? messages.threads.filter(t => t.unread_count > 0).length : 0;
      const messagesEl = document.getElementById('userMessagesCount');
      if (messagesEl) messagesEl.textContent = unreadMessages;

      // Update notifications count
      const unreadNotifications = notifications.notifications ? notifications.notifications.filter(n => !n.read_at).length : 0;
      const notificationsEl = document.getElementById('userNotificationsCount');
      if (notificationsEl) notificationsEl.textContent = unreadNotifications;

    } catch (error) {
      console.error('Error loading overview stats:', error);
      // Gracefully handle errors by keeping the "-" placeholder
    }
  }

  // ---- EDIT
  async function renderEdit(root){
    if (!root) return;
    root.innerHTML = `
      <form id="pf" class="profile-edit-form" novalidate>
        <div class="form-header">
          <h3><i class="fas fa-user-edit me-2"></i>Profil Düzenle</h3>
          <p class="text-muted">Hesap bilgilerinizi ve tercihlerinizi güncelleyin</p>
        </div>

        <!-- Temel Bilgiler -->
        <div class="form-section">
          <h5><i class="fas fa-user me-2"></i>Temel Bilgiler</h5>
          <div class="row g-2">
            <div class="col-lg-3 col-md-6">
              <label class="field">
                <span>Ad Soyad *</span>
                <input name="full_name" required>
              </label>
            </div>
            <div class="col-lg-3 col-md-6">
              <label class="field">
                <span>E-posta *</span>
                <input name="email" type="email" required>
              </label>
            </div>
            <div class="col-lg-3 col-md-6">
              <label class="field">
                <span>Telefon</span>
                <input name="phone_e164" placeholder="+90555...">
              </label>
            </div>
            <div class="col-lg-3 col-md-6">
              <label class="field">
                <span>Yaş Grubu</span>
                <select name="age_group">
                  <option value="">Seçiniz</option>
                  <option value="18-25">18-25</option>
                  <option value="26-35">26-35</option>
                  <option value="36-45">36-45</option>
                  <option value="45+">45+</option>
                </select>
              </label>
            </div>
          </div>
          <div class="row g-2">
            <div class="col-lg-3 col-md-6">
              <label class="field">
                <span>Cinsiyet</span>
                <select name="gender">
                  <option value="">Belirtmek istemiyorum</option>
                  <option value="male">Erkek</option>
                  <option value="female">Kadın</option>
                </select>
              </label>
            </div>
            <div class="col-lg-3 col-md-6">
              <label class="field">
                <span>Meslek</span>
                <select name="occupation">
                  <option value="">Seçiniz</option>
                  <option value="student">Öğrenci</option>
                  <option value="employee">Çalışan</option>
                  <option value="self_employed">Serbest Meslek</option>
                  <option value="business_owner">İşveren</option>
                  <option value="retired">Emekli</option>
                  <option value="other">Diğer</option>
                </select>
              </label>
            </div>
            <div class="col-lg-3 col-md-6">
              <label class="field">
                <span>Şehir</span>
                <select name="city">
                  <option value="">Seçiniz</option>
                  <option value="istanbul">İstanbul</option>
                  <option value="ankara">Ankara</option>
                  <option value="izmir">İzmir</option>
                  <option value="bursa">Bursa</option>
                  <option value="antalya">Antalya</option>
                  <option value="other">Diğer</option>
                </select>
              </label>
            </div>
            <div class="col-lg-3 col-md-6">
              <label class="field">
                <span>İlçe</span>
                <input name="district" placeholder="İlçe adı">
              </label>
            </div>
          </div>
        </div>


        <!-- Alışveriş Tercihleri -->
        <div class="form-section">
          <h5><i class="fas fa-shopping-bag me-2"></i>Alışveriş Tercihleri</h5>
          <div class="row g-2">
            <div class="col-lg-3 col-md-6">
              <label class="field">
                <span>Ortalama Bütçe</span>
                <select name="budget_range">
                  <option value="">Seçiniz</option>
                  <option value="0-500">₺0 - ₺500</option>
                  <option value="500-1500">₺500 - ₺1.500</option>
                  <option value="1500-5000">₺1.500 - ₺5.000</option>
                  <option value="5000+">₺5.000+</option>
                </select>
              </label>
            </div>
            <div class="col-lg-3 col-md-6">
              <label class="field">
                <span>Teslimat Tercihi</span>
                <select name="delivery_preference">
                  <option value="">Seçiniz</option>
                  <option value="cargo">Kargo</option>
                  <option value="hand_delivery">Elden Teslim</option>
                  <option value="both">İkisi de</option>
                </select>
              </label>
            </div>
            <div class="col-lg-3 col-md-6">
              <label class="field">
                <span>Ödeme Tercihi</span>
                <select name="payment_preference">
                  <option value="">Seçiniz</option>
                  <option value="cash">Nakit</option>
                  <option value="card">Kredi Kartı</option>
                  <option value="bank_transfer">Havale/EFT</option>
                  <option value="all">Tümü</option>
                </select>
              </label>
            </div>
            <div class="col-lg-3 col-md-6">
              <label class="field">
                <span>Favori Kategoriler</span>
                <div class="checkbox-group-compact">
                  <label class="checkbox-item">
                    <input type="checkbox" name="categories" value="electronics"> Elektronik
                  </label>
                  <label class="checkbox-item">
                    <input type="checkbox" name="categories" value="fashion"> Moda
                  </label>
                  <label class="checkbox-item">
                    <input type="checkbox" name="categories" value="home"> Ev & Bahçe
                  </label>
                  <label class="checkbox-item">
                    <input type="checkbox" name="categories" value="automotive"> Otomotiv
                  </label>
                </div>
              </label>
            </div>
          </div>
        </div>

        <!-- Bildirim Tercihleri -->
        <div class="form-section">
          <h5><i class="fas fa-bell me-2"></i>Bildirim Tercihleri</h5>
          <div class="notification-preferences">
            <label class="switch-item">
              <span>E-posta Bildirimleri</span>
              <label class="switch">
                <input type="checkbox" name="email_notifications" checked>
                <span class="slider"></span>
              </label>
            </label>
            <label class="switch-item">
              <span>SMS Bildirimleri</span>
              <label class="switch">
                <input type="checkbox" name="sms_notifications">
                <span class="slider"></span>
              </label>
            </label>
            <label class="switch-item">
              <span>Pazarlama E-postaları</span>
              <label class="switch">
                <input type="checkbox" name="marketing_emails">
                <span class="slider"></span>
              </label>
            </label>
          </div>
        </div>

        <!-- Gizlilik Ayarları -->
        <div class="form-section">
          <h5><i class="fas fa-shield-alt me-2"></i>Gizlilik Ayarları</h5>
          <div class="privacy-settings">
            <label class="switch-item">
              <span>Profil Görünürlüğü</span>
              <label class="switch">
                <input type="checkbox" name="profile_visible" checked>
                <span class="slider"></span>
              </label>
              <small class="text-muted">Diğer kullanıcılar profilinizi görebilir</small>
            </label>
            <label class="switch-item">
              <span>Telefon Numarasını Göster</span>
              <label class="switch">
                <input type="checkbox" name="show_phone">
                <span class="slider"></span>
              </label>
              <small class="text-muted">Alıcılar telefon numaranızı görebilir</small>
            </label>
            <label class="switch-item">
              <span>Son Görülme</span>
              <label class="switch">
                <input type="checkbox" name="show_last_seen" checked>
                <span class="slider"></span>
              </label>
              <small class="text-muted">Son aktif olma zamanınız görünür</small>
            </label>
          </div>
        </div>

        <!-- Form Buttons -->
        <div class="form-actions">
          <button id="btnSave" class="btn btn-primary" type="submit">
            <i class="fas fa-save me-2"></i>Değişiklikleri Kaydet
          </button>
          <button type="button" class="btn btn-outline-secondary ms-2" onclick="location.reload()">
            <i class="fas fa-undo me-2"></i>İptal Et
          </button>
          <span id="msg" class="form-message ms-3"></span>
        </div>
      </form>
    `;

    try{
      const me = await fetchJSON(`${API_BASE}/api/auth/me?_ts=${Date.now()}`);
      const u = me.user || me;

      // Populate basic fields
      $('#pf [name="full_name"]').value = u.full_name || '';
      $('#pf [name="email"]').value = u.email || '';
      $('#pf [name="phone_e164"]').value = u.phone_e164 || '';
      $('#pf [name="age_group"]').value = u.age_group || '';
      $('#pf [name="gender"]').value = u.gender || '';
      $('#pf [name="occupation"]').value = u.occupation || '';
      $('#pf [name="city"]').value = u.city || '';
      $('#pf [name="district"]').value = u.district || '';
      $('#pf [name="budget_range"]').value = u.budget_range || '';
      $('#pf [name="delivery_preference"]').value = u.delivery_preference || '';
      $('#pf [name="payment_preference"]').value = u.payment_preference || '';

      // Populate checkboxes for categories
      if (u.favorite_categories && Array.isArray(u.favorite_categories)) {
        u.favorite_categories.forEach(cat => {
          const checkbox = $(`#pf [name="categories"][value="${cat}"]`);
          if (checkbox) checkbox.checked = true;
        });
      }

      // Populate switches
      $('#pf [name="email_notifications"]').checked = u.email_notifications !== false;
      $('#pf [name="sms_notifications"]').checked = u.sms_notifications === true;
      $('#pf [name="marketing_emails"]').checked = u.marketing_emails === true;
      $('#pf [name="profile_visible"]').checked = u.profile_visible !== false;
      $('#pf [name="show_phone"]').checked = u.show_phone === true;
      $('#pf [name="show_last_seen"]').checked = u.show_last_seen !== false;
    }catch{}

    let busy = false;
    $('#pf')?.addEventListener('submit', async (e)=>{
      e.preventDefault();
      if (busy) return;
      busy = true;
      const btn = $('#btnSave'); if (btn) btn.disabled = true;
      const msg = $('#msg');     if (msg) msg.textContent = 'Kaydediliyor…';

      const fd = new FormData(e.currentTarget);

      // Extract all form data
      const profileData = {
        full_name: (fd.get('full_name')||'').toString().trim(),
        email: (fd.get('email')||'').toString().trim(),
        phone_e164: (fd.get('phone_e164')||'').toString().trim(),
        age_group: fd.get('age_group') || null,
        gender: fd.get('gender') || null,
        occupation: fd.get('occupation') || null,
        city: fd.get('city') || null,
        district: (fd.get('district')||'').toString().trim() || null,
        budget_range: fd.get('budget_range') || null,
        delivery_preference: fd.get('delivery_preference') || null,
        payment_preference: fd.get('payment_preference') || null,

        // Get selected categories
        favorite_categories: Array.from(e.currentTarget.querySelectorAll('[name="categories"]:checked'))
          .map(cb => cb.value),

        // Get notification preferences
        email_notifications: $('#pf [name="email_notifications"]')?.checked || false,
        sms_notifications: $('#pf [name="sms_notifications"]')?.checked || false,
        marketing_emails: $('#pf [name="marketing_emails"]')?.checked || false,

        // Get privacy settings
        profile_visible: $('#pf [name="profile_visible"]')?.checked || false,
        show_phone: $('#pf [name="show_phone"]')?.checked || false,
        show_last_seen: $('#pf [name="show_last_seen"]')?.checked || false
      };

      // Clean phone number
      if (profileData.phone_e164) {
        profileData.phone_e164 = profileData.phone_e164.replace(/[\s\-()]/g,'');
      }

      // Validation
      if (!profileData.full_name) {
        if (msg) msg.textContent = 'Ad Soyad zorunlu.';
        if (btn) btn.disabled = false;
        busy = false; return;
      }

      if (!profileData.email || !profileData.email.includes('@')) {
        if (msg) msg.textContent = 'Geçerli bir e-posta adresi gerekli.';
        if (btn) btn.disabled = false;
        busy = false; return;
      }

      try{
        await (window.API && window.API.users
          ? window.API.users.updateProfile(profileData)
          : (async () => {
              const r = await fetch(`${API_BASE}/api/users/profile?_ts=${Date.now()}`, {
                method:'POST',
                credentials:'include',
                cache:'no-store',
                headers:{'Content-Type':'application/json', ...noStoreHeaders},
                body: JSON.stringify(profileData)
              });
              const data = await r.json().catch(()=>({}));
              if (!r.ok || data.ok===false) throw new Error(data.message||'Kaydedilemedi');
              return data;
            })()
        );

        if (msg) msg.textContent = 'Kaydedildi ✓';
        document.dispatchEvent(new Event('auth:login'));
      }catch{
        if (msg) msg.textContent = 'Kaydedilemedi';
      } finally {
        if (btn) btn.disabled = false;
        busy = false;
      }
    });
  }

  // ---- ORDERS (buyer)
  async function fetchOrders(){
    try {
      const data = await (window.API && window.API.orders
        ? window.API.orders.mine({ include_cancelled: false })
        : (async () => {
            const url = new URL(`${API_BASE}/api/orders/mine`);
            url.searchParams.set('_ts', Date.now());
            const r = await fetch(url, {
              credentials:'include',
              cache:'no-store',
              headers: noStoreHeaders
            });
            if (r.status === 401) { redirectToLogin(); return { orders: [] }; }
            const d = await r.json().catch(()=>({}));
            return d && d.ok ? d : { orders: [] };
          })()
      );
      return data.orders || [];
    } catch (e) {
      console.error('fetchOrders error:', e);
      alert('Siparişler alınamadı: ' + e.message);
      return [];
    }
  }

  function pickThumb(o){
    // For cart-based orders, prioritize first_item_image
    const t = o.first_item_image || o.thumb_url || o.thumb || '';
    if (!t) return '/assets/placeholder.png';
    if (/^https?:\/\//i.test(t) || t.startsWith('/')) return t;
    return `/uploads/${t}`;
  }
  function buildListingHref(o){
    if (o.slug) return `/listing.html?slug=${encodeURIComponent(o.slug)}`;
    return `/listing.html?id=${o.listing_id || o.id}`;
  }

  async function renderOrders(root){
    if (!root) return;
    root.innerHTML = `<div class="pad">Yükleniyor…</div>`;
    try{
      const rows = await fetchOrders();
      console.log('Orders loaded:', rows);

      // Filter only buy orders
      const buyOrders = rows.filter(o => o.type === 'buy' || !o.type);

      // Header with stats
      const header = `
        <div class="orders-header">
          <h3><i class="fas fa-shopping-bag me-2"></i>Aldıklarım</h3>
          <p class="muted">Satın aldığım ürünleri takip edin</p>
          <div class="orders-stats">
            <div class="stat-card">
              <div class="stat-number">${buyOrders.length}</div>
              <div class="stat-label">Toplam Alım</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${buyOrders.filter(o => o.status === 'pending').length}</div>
              <div class="stat-label">Bekleyen</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${buyOrders.filter(o => o.status === 'delivered').length}</div>
              <div class="stat-label">Teslim Edildi</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${buyOrders.filter(o => o.status === 'completed').length}</div>
              <div class="stat-label">Tamamlandı</div>
            </div>
          </div>
        </div>`;

      if (!buyOrders.length) {
        root.innerHTML = header + `
          <div class="empty">
            <i class="fas fa-inbox fa-3x text-muted mb-3"></i>
            <h4>Henüz siparişiniz yok</h4>
            <p>İlk siparişinizi vermek için ürünleri incelemeye başlayın</p>
            <a href="/" class="btn primary">Ürünleri İncele</a>
          </div>`;
        return;
      }

      const ordersHtml = buyOrders.map(o => {
        const totalMinor = (o.total_minor != null) ? o.total_minor : (Number(o.unit_price_minor||0) * (o.qty || 1));
        const typeIcon = 'fas fa-shopping-cart';
        const typeText = 'Alım';

        // Check if it's a cart-based order or single item order
        const isCartOrder = o.item_count > 0 || (!o.listing_id && !o.title);

        let orderTitle, orderSubtitle, orderLink;

        if (isCartOrder) {
          const itemCount = o.item_count || 1;
          if (itemCount === 1) {
            orderTitle = o.first_item_title || `Sipariş #${o.id}`;
            orderSubtitle = `${new Date(o.created_at).toLocaleDateString('tr-TR')}`;
          } else {
            orderTitle = o.first_item_title ?
              `${o.first_item_title} ${itemCount > 1 ? `+ ${itemCount - 1} ürün daha` : ''}` :
              `${itemCount} ürün siparişi`;
            orderSubtitle = `Sipariş #${o.id} - ${new Date(o.created_at).toLocaleDateString('tr-TR')}`;
          }
          orderLink = `/order-success.html?order=${o.id}`;
        } else {
          orderTitle = o.title || `#${o.listing_id}`;
          orderSubtitle = `${new Date(o.created_at).toLocaleDateString('tr-TR')}`;
          orderLink = buildListingHref(o);
        }

        return `
          <div class="order-card">
            <div class="order-header">
              <div class="order-type buy">
                <i class="${typeIcon}"></i>
                ${typeText}
              </div>
              <div class="order-status ${o.status}">
                ${o.status === 'pending' ? 'Bekliyor' :
                  o.status === 'paid' ? 'Ödendi' :
                  o.status === 'processing' ? 'Hazırlanıyor' :
                  o.status === 'shipped' ? 'Kargoda' :
                  o.status === 'delivered' ? 'Teslim Edildi' :
                  o.status === 'completed' ? 'Tamamlandı' :
                  o.status === 'cancelled' ? 'İptal Edildi' : o.status}
              </div>
            </div>
            <div class="order-content">
              <img class="order-image" src="${pickThumb(o)}" alt="${esc(orderTitle)}" onerror="this.src='/assets/placeholder.png'">
              <div class="order-details">
                <h4><a href="${orderLink}">${esc(orderTitle)}</a></h4>
                <p class="order-subtitle text-muted">${orderSubtitle}</p>
                <div class="order-info">
                  ${o.shipping_method ? `<span class="badge bg-secondary me-2"><i class="fas fa-truck me-1"></i>${o.shipping_method === 'express' ? 'Hızlı Kargo' : 'Standart Kargo'}</span>` : ''}
                  ${o.payment_method ? `<span class="badge bg-primary"><i class="fas fa-credit-card me-1"></i>${
                    o.payment_method === 'credit_card' ? 'Kart' :
                    o.payment_method === 'bank_transfer' ? 'Havale' :
                    o.payment_method === 'cash_on_delivery' ? 'Kapıda Ödeme' : o.payment_method
                  }</span>` : ''}
                </div>
              </div>
              <div class="order-price">
                <div class="price-amount">${toTL(totalMinor, o.currency)}</div>
                <div class="order-actions mt-2">
                  <button class="btn btn-xs btn-outline-primary me-1" onclick="showOrderDetails(${o.id})" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;">
                    <i class="fas fa-eye me-1" style="font-size: 0.7rem;"></i>Detaylar
                  </button>
                  <button class="btn btn-xs btn-outline-info me-1" onclick="trackOrder('${o.tracking_number || ''}', '${o.shipping_method}')" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;">
                    <i class="fas fa-truck me-1" style="font-size: 0.7rem;"></i>Takip
                  </button>
                  ${o.status === 'pending' ? `
                    <button class="btn btn-xs btn-outline-danger" onclick="cancelOrderHandler(${o.id}, this)" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;">
                      <i class="fas fa-times me-1" style="font-size: 0.7rem;"></i>İptal Et
                    </button>
                  ` : ''}
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');

      root.innerHTML = header + `<div class="orders-list">${ordersHtml}</div>`;

      // Add cancel handler to global scope
      window.cancelOrderHandler = async (orderId, btnElement) => {
        if (!confirm('Bu siparişi iptal etmek istediğine emin misin?')) return;
        btnElement.disabled = true;
        btnElement.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>İptal Ediliyor...';
        try{
          await cancelOrder(orderId);
          btnElement.closest('.order-card').remove();

          // Check if no orders left
          const remainingOrders = root.querySelectorAll('.order-card');
          if (remainingOrders.length === 0) {
            root.innerHTML = header.replace(/\d+/g, '0') + `
              <div class="empty">
                <i class="fas fa-check-circle fa-3x text-success mb-3"></i>
                <h4>Tüm siparişler işlendi</h4>
                <p>Aktif bekleyen siparişiniz bulunmamaktadır</p>
              </div>`;
          }
        }catch(e){
          console.error(e);
          alert('İptal edilemedi: ' + (e.message || 'Bilinmeyen hata'));
          btnElement.disabled = false;
          btnElement.innerHTML = '<i class="fas fa-times me-1"></i>İptal Et';
        }
      };

    }catch(e){
      console.error(e);
      root.innerHTML = `<div class="pad error">
        <i class="fas fa-exclamation-triangle me-2"></i>
        Siparişler alınamadı. Lütfen sayfayı yenileyin.
      </div>`;
    }
  }

  // ---- MY LISTINGS
  async function fetchMyListings(page=1, size=24){
    try {
      const data = await (window.API && window.API.listings
        ? window.API.listings.mine({ page, size })
        : (async () => {
            const url = new URL('/api/listings/my', API_BASE);
            url.searchParams.set('page', page);
            url.searchParams.set('size', size);
            url.searchParams.set('_ts', Date.now());
            const r = await fetch(url.toString(), { credentials:'include', cache:'no-store', headers: noStoreHeaders });
            if (r.status === 401) { redirectToLogin(); return { items:[], total:0 }; }
            const d = await r.json().catch(()=>({}));
            if (!r.ok) return { items:[], total:0 };
            return d;
          })()
      );
      
      const items = data.items || data.listings || [];
      const total = Number(data.total ?? data.count ?? items.length);
      return { items, total };
    } catch (e) {
      console.error('fetchMyListings error:', e);
      return { items: [], total: 0 };
    }
  }

  function listingCard(x){
    // Check if ProductCard component is available
    if (window.ProductCard && window.ProductCard.renderListingCard) {
      const product = {
        id: x.id,
        slug: x.slug,
        title: x.title,
        price_minor: x.price_minor,
        currency: x.currency || 'TRY',
        cover_url: x.cover_url || x.thumb_url || x.cover,
        thumb_url: x.thumb_url,
        location_city: x.location_city || x.city || 'Türkiye',
        view_count: x.view_count || 0,
        created_at: x.created_at,
        category_name: x.category_name || '',
        status: x.status || 'active',
        owner_business_name: x.owner_business_name || '',
        owner_display_name: x.owner_display_name || ''
      };

      // My Listings mode: Show all action buttons
      return window.ProductCard.renderListingCard(product, {
        showActions: true,      // Show action buttons (edit/delete/status)
        showStatus: true,       // Show status badges
        showEdit: true,         // Show edit button
        showDelete: true,       // Show delete button
        showStatusButtons: true // Show pause/activate/sold buttons
      });
    }

    // Fallback to old rendering if ProductCard not available
    console.warn('⚠️ ProductCard component not available in profile.js, using fallback rendering');
    const img = x.thumb_url || x.cover_url || x.cover || '/assets/placeholder.png';
    const href = x.slug ? `/listing.html?slug=${encodeURIComponent(x.slug)}` : `/listing.html?id=${encodeURIComponent(x.id)}`;
    let priceStr = '';
    if (typeof x.price_minor === 'number') priceStr = toTL(x.price_minor, x.currency || 'TRY');
    else if (x.price != null) priceStr = `${(Number(x.price)||0).toLocaleString('tr-TR')} ${esc(x.currency||'TRY')}`;
    return `<div class="listing-card"><p>ProductCard component not loaded. <a href="${href}">${esc(x.title)}</a> - ${priceStr}</p></div>`;
  }

  async function renderMyListings(root){
    if (!root) return;
    root.innerHTML = `<div class="pad">Yükleniyor…</div>`;
    try{
      const { items, total } = await fetchMyListings(1, 24);

      const header = `
        <div class="orders-header">
          <h3><i class="fas fa-list-alt me-2"></i>İlanlarım</h3>
          <p class="muted">Yayınladığınız ilanları yönetin ve düzenleyin</p>
          <div class="orders-stats">
            <div class="stat-card">
              <div class="stat-number">${items.filter(x => x.status === 'active' || !x.status).length}</div>
              <div class="stat-label">Aktif</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${items.filter(x => x.status === 'sold').length}</div>
              <div class="stat-label">Satıldı</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${items.filter(x => x.status === 'pending_review').length}</div>
              <div class="stat-label">İnceleme Bekliyor</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${items.filter(x => x.status === 'rejected').length}</div>
              <div class="stat-label">Reddedildi</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${items.filter(x => x.status === 'paused' || x.status === 'inactive' || x.status === 'pasif').length}</div>
              <div class="stat-label">Pasif</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${items.filter(x => x.status === 'paused').length}</div>
              <div class="stat-label">Duraklatıldı</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${total}</div>
              <div class="stat-label">Toplam</div>
            </div>
          </div>
        </div>`;

      if (!items.length){
        root.innerHTML = header.replace(/\d+/g, '0') + `
          <div class="empty">
            <i class="fas fa-plus-circle fa-3x text-muted mb-3"></i>
            <h4>Henüz ilanınız yok</h4>
            <p>İlk ilanınızı vererek satış yapmaya başlayın</p>
            <a class="btn primary" href="/sell.html">
              <i class="fas fa-plus me-1"></i>İlan Ver
            </a>
          </div>`;
        return;
      }

      const listingsHtml = items.map(listingCard).join('');
      root.innerHTML = header + `<div class="listings-list">${listingsHtml}</div>`;

      // Add toggle status handler to global scope
      window.toggleListingStatus = async (listingId, newStatus, btnElement) => {
        if (!confirm(`İlanı ${newStatus === 'active' ? 'aktifleştir' : 'duraklat'}mek istediğinize emin misiniz?`)) return;

        const originalHtml = btnElement.innerHTML;
        btnElement.disabled = true;
        btnElement.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Güncelleniyor...';

        try{
          // API call to update listing status (implement as needed)
          const response = await fetch(`${API_BASE}/api/listings/${listingId}/status`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...noStoreHeaders },
            body: JSON.stringify({ status: newStatus })
          });

          if (response.ok) {
            // Refresh the listings view
            renderMyListings(root);
          } else {
            throw new Error('Durum güncellenemedi');
          }
        }catch(e){
          console.error(e);
          alert('İlan durumu güncellenemedi: ' + (e.message || 'Bilinmeyen hata'));
          btnElement.disabled = false;
          btnElement.innerHTML = originalHtml;
        }
      };

      // Add delete listing handler to global scope
      window.deleteListingProfile = async (listingId, btnElement) => {
        if (!confirm('Bu ilanı kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return;

        const originalHtml = btnElement.innerHTML;
        btnElement.disabled = true;
        btnElement.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Siliniyor...';

        try{
          const response = await fetch(`${API_BASE}/api/listings/${listingId}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: { 'Accept': 'application/json', ...noStoreHeaders }
          });

          const data = await response.json();

          if (response.ok && data.ok) {
            // Refresh the listings view
            renderMyListings(root);
          } else {
            throw new Error(data.error || 'İlan silinemedi');
          }
        }catch(e){
          console.error(e);
          alert('İlan silinemedi: ' + (e.message || 'Bilinmeyen hata'));
          btnElement.disabled = false;
          btnElement.innerHTML = originalHtml;
        }
      };

    }catch(e){
      console.error(e);
      root.innerHTML = `<div class="pad error">
        <i class="fas fa-exclamation-triangle me-2"></i>
        İlanlar alınamadı. Lütfen sayfayı yenileyin.
      </div>`;
    }
  }

  // ---- TRADE OFFERS
  async function fetchTradeOffers(role = 'sent') {
    try {
      const data = await (window.API && window.API.trades
        ? window.API.trades.mine({ role })
        : (async () => {
            const url = new URL('/api/trade/my', API_BASE);
            url.searchParams.set('role', role);
            url.searchParams.set('_ts', Date.now());
            const r = await fetch(url.toString(), {
              credentials:'include',
              cache:'no-store',
              headers: noStoreHeaders
            });
            if (r.status === 401) { redirectToLogin(); return { items: [] }; }
            const d = await r.json().catch(()=>({}));
            if (!r.ok) return { items: [] };
            return d;
          })()
      );

      return data.items || [];
    } catch (e) {
      console.error('fetchTradeOffers error:', e);
      return [];
    }
  }

  function tradeOfferCard(offer, role = 'sent') {
    const statusText = offer.status === 'pending' ? 'Bekliyor' :
                      offer.status === 'accepted' ? 'Kabul Edildi' :
                      offer.status === 'rejected' ? 'Reddedildi' :
                      offer.status === 'withdrawn' ? 'Geri Çekildi' : offer.status;

    const statusClass = offer.status === 'pending' ? 'warning' :
                       offer.status === 'accepted' ? 'success' :
                       offer.status === 'rejected' ? 'danger' :
                       offer.status === 'withdrawn' ? 'secondary' : 'muted';

    const roleText = role === 'sent' ? 'Gönderilen' : 'Alınan';
    const roleIcon = role === 'sent' ? 'fas fa-arrow-right' : 'fas fa-arrow-left';
    const personName = role === 'sent' ? (offer.seller_name || 'Satıcı') : (offer.offerer_name || 'Teklif Eden');

    const cashAdjust = offer.cash_adjust_minor ? `+ ${toTL(offer.cash_adjust_minor)}` : '';
    const createdDate = new Date(offer.created_at).toLocaleDateString('tr-TR');

    return `
      <div class="listing-card trade-offer-card">
        <div class="trade-header">
          <div class="trade-type ${role}">
            <i class="${roleIcon}"></i>
            ${roleText} Teklif
          </div>
          <div class="trade-status ${statusClass}">
            ${statusText}
          </div>
        </div>
        <div class="listing-content">
          <div class="trade-info">
            <h3>${esc(offer.title || 'İlan Başlığı')}</h3>
            <div class="trade-details">
              <div class="trade-offer-text">
                <i class="fas fa-exchange-alt me-1"></i>
                <strong>Teklif:</strong> ${esc(offer.offered_text || 'Teklif metni yok')}
                ${cashAdjust ? `<span class="cash-adjust">${cashAdjust}</span>` : ''}
              </div>
              <div class="trade-meta">
                <span><i class="fas fa-user me-1"></i>${esc(personName)}</span>
                <span><i class="fas fa-calendar me-1"></i>${createdDate}</span>
                ${offer.price_minor ? `<span><i class="fas fa-tag me-1"></i>İlan Fiyatı: ${toTL(offer.price_minor, offer.currency)}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="trade-actions">
            ${role === 'received' && offer.status === 'pending' ? `
              <button class="btn btn-success btn-sm" onclick="acceptTradeOffer(${offer.id}, this)">
                <i class="fas fa-check me-1"></i>Kabul Et
              </button>
              <button class="btn btn-outline-danger btn-sm" onclick="rejectTradeOffer(${offer.id}, this)">
                <i class="fas fa-times me-1"></i>Reddet
              </button>
            ` : role === 'sent' && offer.status === 'pending' ? `
              <button class="btn btn-outline-warning btn-sm" onclick="withdrawTradeOffer(${offer.id}, this)">
                <i class="fas fa-undo me-1"></i>Geri Çek
              </button>
            ` : offer.status === 'accepted' && offer.trade_session_id ? `
              <a href="/trade-session.html?id=${offer.trade_session_id}" class="btn btn-primary btn-sm">
                <i class="fas fa-handshake me-1"></i>Koordinasyona Git
              </a>
            ` : ''}
            <a href="/listing.html?id=${offer.listing_id}" class="btn btn-outline-primary btn-sm">
              <i class="fas fa-eye me-1"></i>İlanı Gör
            </a>
          </div>
        </div>
      </div>
    `;
  }

  async function renderTrades(root) {
    if (!root) return;
    root.innerHTML = `<div class="pad">Yükleniyor…</div>`;

    try {
      const [sentOffers, receivedOffers] = await Promise.all([
        fetchTradeOffers('sent'),
        fetchTradeOffers('received')
      ]);

      const header = `
        <div class="orders-header">
          <h3><i class="fas fa-exchange-alt me-2"></i>Takas Tekliflerim</h3>
          <p class="muted">Gönderdiğiniz ve aldığınız takas tekliflerini yönetin</p>
          <div class="orders-stats">
            <div class="stat-card">
              <div class="stat-number">${sentOffers.length}</div>
              <div class="stat-label">Gönderilen</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${receivedOffers.length}</div>
              <div class="stat-label">Alınan</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${[...sentOffers, ...receivedOffers].filter(o => o.status === 'pending').length}</div>
              <div class="stat-label">Bekleyen</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${[...sentOffers, ...receivedOffers].filter(o => o.status === 'accepted').length}</div>
              <div class="stat-label">Kabul Edildi</div>
            </div>
          </div>
        </div>`;

      if (!sentOffers.length && !receivedOffers.length) {
        root.innerHTML = header.replace(/\d+/g, '0') + `
          <div class="empty">
            <i class="fas fa-exchange-alt fa-3x text-muted mb-3"></i>
            <h4>Henüz takas teklifiniz yok</h4>
            <p>İlanları incelerken "Takas Teklif Et" butonunu kullanarak teklif verebilirsiniz</p>
            <a href="/" class="btn primary">İlanları İncele</a>
          </div>`;
        return;
      }

      // Combine and sort all offers by date
      const allOffers = [
        ...sentOffers.map(o => ({...o, _role: 'sent'})),
        ...receivedOffers.map(o => ({...o, _role: 'received'}))
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      const offersHtml = allOffers.map(offer => tradeOfferCard(offer, offer._role)).join('');
      root.innerHTML = header + `<div class="trades-list">${offersHtml}</div>`;

      // Add global handlers for trade actions
      window.acceptTradeOffer = async (offerId, btnElement) => {
        if (!confirm('Bu takas teklifini kabul etmek istediğinizden emin misiniz?')) return;
        await handleTradeAction(offerId, 'accept', btnElement, root);
      };

      window.rejectTradeOffer = async (offerId, btnElement) => {
        if (!confirm('Bu takas teklifini reddetmek istediğinizden emin misiniz?')) return;
        await handleTradeAction(offerId, 'reject', btnElement, root);
      };

      window.withdrawTradeOffer = async (offerId, btnElement) => {
        if (!confirm('Bu takas teklifini geri çekmek istediğinizden emin misiniz?')) return;
        await handleTradeAction(offerId, 'withdraw', btnElement, root);
      };

    } catch(e) {
      console.error(e);
      root.innerHTML = `<div class="pad error">
        <i class="fas fa-exclamation-triangle me-2"></i>
        Takas teklifleri alınamadı. Lütfen sayfayı yenileyin.
      </div>`;
    }
  }

  async function handleTradeAction(offerId, action, btnElement, root) {
    const originalHtml = btnElement.innerHTML;
    btnElement.disabled = true;
    btnElement.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>İşleniyor...';

    try {
      const response = await fetch(`${API_BASE}/api/trade/offer/${offerId}/${action}`, {
        method: 'POST',
        credentials: 'include',
        headers: noStoreHeaders
      });

      const data = await response.json();
      if (response.ok && data.ok) {
        // Refresh the trades view
        renderTrades(root);

        const actionText = action === 'accept' ? 'kabul edildi' :
                          action === 'reject' ? 'reddedildi' : 'geri çekildi';

        // Show success message briefly
        const successMsg = document.createElement('div');
        successMsg.className = 'alert alert-success';
        successMsg.style.position = 'fixed';
        successMsg.style.top = '20px';
        successMsg.style.right = '20px';
        successMsg.style.zIndex = '9999';
        successMsg.innerHTML = `<i class="fas fa-check me-2"></i>Teklif ${actionText}!`;

        // If accepted, show coordination button
        if (action === 'accept' && data.trade_session_id) {
          successMsg.innerHTML += `<br><a href="/trade-session.html?id=${data.trade_session_id}" class="btn btn-sm btn-outline-primary mt-2">Koordinasyona Git</a>`;
        }

        document.body.appendChild(successMsg);
        setTimeout(() => successMsg.remove(), action === 'accept' ? 6000 : 3000);
      } else {
        throw new Error(data.error || 'İşlem başarısız');
      }
    } catch(e) {
      console.error(e);
      alert('İşlem gerçekleştirilemedi: ' + (e.message || 'Bilinmeyen hata'));
      btnElement.disabled = false;
      btnElement.innerHTML = originalHtml;
    }
  }

  // ---- MESSAGES
  async function fetchMessages(){
    try {
      const data = await (window.API && window.API.messages
        ? window.API.messages.threads()
        : (async () => {
            const url = new URL(`${API_BASE}/api/messages/threads`);
            url.searchParams.set('_ts', Date.now());
            const r = await fetch(url, {
              credentials:'include',
              cache:'no-store',
              headers: noStoreHeaders
            });
            if (r.status === 401) { redirectToLogin(); return { threads: [] }; }
            const d = await r.json().catch(()=>({}));
            if (!r.ok) return { threads: [] };
            return d;
          })()
      );
      return data.threads || [];
    } catch (e) {
      console.error('fetchMessages error:', e);
      return [];
    }
  }

  function messageCard(thread) {
    const preview = esc(thread.last_message_preview || 'Henüz mesaj yok...');
    const otherUser = esc(thread.other_user_name || 'Kullanıcı');
    const listingTitle = thread.listing_title ? esc(thread.listing_title) : '';
    const updatedDate = thread.updated_at ? new Date(thread.updated_at).toLocaleDateString('tr-TR', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    }) : '';

    const unreadBadge = thread.unread_count > 0 ?
      `<span class="badge bg-danger ms-2">${thread.unread_count}</span>` : '';

    return `
      <div class="message-card">
        <div class="message-content">
          <div class="message-avatar">
            <i class="fas fa-user-circle fa-2x text-primary"></i>
          </div>
          <div class="message-info">
            <div class="message-header">
              <h4>
                <a href="/thread.html?id=${encodeURIComponent(thread.id)}">${otherUser}</a>
                ${unreadBadge}
              </h4>
              ${listingTitle ? `<div class="message-listing"><i class="fas fa-tag me-1"></i>${listingTitle}</div>` : ''}
            </div>
            <div class="message-preview">
              ${preview}
            </div>
            <div class="message-meta">
              <span><i class="fas fa-clock me-1"></i>${updatedDate}</span>
              <span class="badge bg-${thread.unread_count > 0 ? 'warning' : 'secondary'}">${thread.unread_count > 0 ? 'Okunmadı' : 'Okundu'}</span>
            </div>
          </div>
          <div class="message-actions">
            <a href="/thread.html?id=${encodeURIComponent(thread.id)}" class="btn btn-primary btn-sm">
              <i class="fas fa-eye me-1"></i>Görüntüle
            </a>
            ${listingTitle ? `
              <a href="/listing.html?id=${thread.listing_id}" class="btn btn-outline-secondary btn-sm">
                <i class="fas fa-external-link-alt me-1"></i>İlanı Gör
              </a>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  async function renderMessages(root) {
    if (!root) return;
    root.innerHTML = `<div class="pad">Yükleniyor…</div>`;

    try {
      const threads = await fetchMessages();

      const header = `
        <div class="orders-header">
          <h3><i class="fas fa-envelope me-2"></i>Mesajlarım</h3>
          <p class="muted">Alıcı ve satıcılarla olan mesajlaşmalarınız</p>
          <div class="orders-stats">
            <div class="stat-card">
              <div class="stat-number">${threads.length}</div>
              <div class="stat-label">Toplam Konuşma</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${threads.filter(t => t.unread_count > 0).length}</div>
              <div class="stat-label">Okunmamış</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${threads.filter(t => t.updated_at && new Date(t.updated_at) > new Date(Date.now() - 24*60*60*1000)).length}</div>
              <div class="stat-label">Bugün Aktif</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${threads.filter(t => t.listing_id).length}</div>
              <div class="stat-label">İlan Mesajları</div>
            </div>
          </div>
        </div>`;

      if (!threads.length) {
        root.innerHTML = header.replace(/\d+/g, '0') + `
          <div class="empty">
            <i class="fas fa-envelope-open fa-3x text-muted mb-3"></i>
            <h4>Henüz mesajınız yok</h4>
            <p>İlan sahipleri ile iletişim kurduğunuzda mesajlar burada görünecek</p>
            <a href="/" class="btn primary">İlanları İncele</a>
          </div>`;
        return;
      }

      // Sort threads by updated date (most recent first)
      const sortedThreads = threads.sort((a, b) => {
        const dateA = new Date(a.updated_at || 0);
        const dateB = new Date(b.updated_at || 0);
        return dateB - dateA;
      });

      const messagesHtml = sortedThreads.map(messageCard).join('');
      root.innerHTML = header + `<div class="messages-list">${messagesHtml}</div>`;

    } catch(e) {
      console.error(e);
      root.innerHTML = `<div class="pad error">
        <i class="fas fa-exclamation-triangle me-2"></i>
        Mesajlar alınamadı. Lütfen sayfayı yenileyin.
      </div>`;
    }
  }

  // ---- NOTIFICATIONS
  async function renderNotifications(root) {
    if (!root) return;
    root.innerHTML = `<div class="pad">Bildirimler yükleniyor…</div>`;

    try {
      const response = await fetchJSON(`${API_BASE}/api/notifications`);
      const notifications = response.notifications || [];

      const header = `
        <div class="orders-header">
          <h3><i class="fas fa-bell me-2"></i>Bildirimlerim</h3>
          <p class="muted">Sistem bildirimleri ve önemli uyarılar</p>
          <div class="orders-stats">
            <div class="stat-card">
              <div class="stat-number">${notifications.length}</div>
              <div class="stat-label">Toplam Bildirim</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${notifications.filter(n => !n.read_at).length}</div>
              <div class="stat-label">Okunmamış</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${notifications.filter(n => n.type === 'new_message').length}</div>
              <div class="stat-label">Mesaj Bildirimi</div>
            </div>
          </div>
          <div class="mt-3">
            <button onclick="markAllNotificationsRead()" class="btn btn-outline-primary btn-sm">
              <i class="fas fa-check-double me-1"></i>Tümünü Okundu İşaretle
            </button>
          </div>
        </div>
      `;

      if (notifications.length === 0) {
        root.innerHTML = header + `
          <div class="empty-state">
            <i class="fas fa-bell-slash"></i>
            <h4>Henüz bildirim yok</h4>
            <p>Yeni mesajlar ve sistem bildirimleri burada görünecek</p>
          </div>
        `;
        return;
      }

      const notificationTypeConfig = {
        'trade_offer': { icon: 'fas fa-exchange-alt', color: '#28a745', label: 'Takas Teklifi' },
        'new_message': { icon: 'fas fa-envelope', color: '#007bff', label: 'Yeni Mesaj' },
        'order_update': { icon: 'fas fa-shopping-bag', color: '#ffc107', label: 'Sipariş Güncellendi' },
        'payment_complete': { icon: 'fas fa-credit-card', color: '#28a745', label: 'Ödeme Tamamlandı' },
        'listing_approved': { icon: 'fas fa-check-circle', color: '#28a745', label: 'İlan Onaylandı' },
        'listing_rejected': { icon: 'fas fa-times-circle', color: '#dc3545', label: 'İlan Reddedildi' },
        'price_alert': { icon: 'fas fa-tag', color: '#ff6b35', label: 'Fiyat Uyarısı' },
        'system': { icon: 'fas fa-info-circle', color: '#6c757d', label: 'Sistem' },
        'security': { icon: 'fas fa-shield-alt', color: '#dc3545', label: 'Güvenlik' }
      };

      const notificationsList = notifications.map(notification => {
        const config = notificationTypeConfig[notification.type] || notificationTypeConfig['system'];
        const isUnread = !notification.read_at;
        const createdAt = new Date(notification.created_at);
        const timeAgo = formatTimeAgo(createdAt);

        return `
          <div class="notification-item ${isUnread ? 'unread' : ''}" data-id="${notification.id}" data-action-url="${notification.action_url || ''}" data-type="${notification.type}">
            <div class="notification-icon" style="color: ${config.color}">
              <i class="${config.icon}"></i>
            </div>
            <div class="notification-content">
              <div class="notification-header">
                <span class="notification-type">${config.label}</span>
                <span class="notification-time">${timeAgo}</span>
                ${isUnread ? '<span class="notification-badge">Yeni</span>' : ''}
              </div>
              <div class="notification-title">${esc(notification.title)}</div>
              <div class="notification-body">${esc(notification.body)}</div>
              ${notification.action_url ? `
                <div class="notification-actions">
                  <a href="${esc(notification.action_url)}" class="btn btn-sm btn-outline-primary">
                    <i class="fas fa-external-link-alt me-1"></i>Görüntüle
                  </a>
                </div>
              ` : ''}
            </div>
            <div class="notification-actions">
              ${isUnread ? `
                <button onclick="markNotificationRead(${notification.id})" class="btn btn-sm btn-outline-secondary" title="Okundu işaretle">
                  <i class="fas fa-check"></i>
                </button>
              ` : ''}
              <button onclick="deleteNotification(${notification.id})" class="btn btn-sm btn-outline-danger" title="Sil">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        `;
      }).join('');

      root.innerHTML = header + `
        <div class="notifications-list">
          ${notificationsList}
        </div>
      `;

      // Add click handlers for notifications
      addNotificationClickHandlers();

      // Initialize bidirectional sync with header notification system
      initNotificationSystemSync();

    } catch (error) {
      console.error('Error loading notifications:', error);
      root.innerHTML = `
        <div class="alert alert-danger">
          <i class="fas fa-exclamation-triangle me-2"></i>
          Bildirimler alınamadı. Lütfen sayfayı yenileyin.
        </div>
      `;
    }
  }

  // Add click handlers to notification items
  function addNotificationClickHandlers() {
    const notificationItems = document.querySelectorAll('.notification-item');

    notificationItems.forEach(item => {
      const notificationId = item.dataset.id;
      const actionUrl = item.dataset.actionUrl;
      const notificationType = item.dataset.type;
      const isUnread = item.classList.contains('unread');

      // Make the entire notification clickable (except action buttons)
      item.addEventListener('click', async (e) => {
        // Don't trigger if clicking on action buttons
        if (e.target.closest('button') || e.target.closest('.notification-actions')) {
          return;
        }

        try {
          // Mark as read if unread
          if (isUnread) {
            await fetchJSON(`${API_BASE}/api/notifications/${notificationId}/read`, { method: 'POST' });

            // Update UI immediately
            item.classList.remove('unread');
            const badge = item.querySelector('.notification-badge');
            const readButton = item.querySelector('button[onclick*="markNotificationRead"]');
            if (badge) badge.remove();
            if (readButton) readButton.remove();

            // Sync with header notification system
            syncWithHeaderNotifications(notificationId, 'mark_read');
          }

          // Navigate to action URL if it exists
          if (actionUrl && actionUrl !== '') {
            window.location.href = actionUrl;
          } else {
            // Handle different notification types without action URLs
            handleNotificationTypeClick(notificationType, notificationId);
          }

        } catch (error) {
          console.error('Error handling notification click:', error);
        }
      });

      // Add hover effect
      item.style.cursor = 'pointer';
    });
  }

  // Initialize bidirectional sync with header notification system
  function initNotificationSystemSync() {
    // Listen for notification changes from header system
    if (!window.notificationSyncInitialized) {
      window.notificationSyncInitialized = true;

      // Listen for notification system events
      document.addEventListener('notification:deleted', (event) => {
        const notificationId = event.detail.notificationId;
        console.log('Header notification deleted, syncing with profile page:', notificationId);

        // Remove from profile page if we're on notifications tab
        const notificationElement = document.querySelector(`[data-id="${notificationId}"]`);
        if (notificationElement) {
          notificationElement.remove();
        }

        // Refresh counts if on notifications tab
        const activeTab = new URLSearchParams(window.location.search).get('tab');
        if (activeTab === 'notifications') {
          const content = document.getElementById('tab_content');
          if (content) renderNotifications(content);
        }
      });

      document.addEventListener('notification:marked_read', (event) => {
        const notificationId = event.detail.notificationId;
        console.log('Header notification marked read, syncing with profile page:', notificationId);

        // Update profile page notification
        const notificationElement = document.querySelector(`[data-id="${notificationId}"]`);
        if (notificationElement) {
          notificationElement.classList.remove('unread');
          const badge = notificationElement.querySelector('.notification-badge');
          const readButton = notificationElement.querySelector('button[onclick*="markNotificationRead"]');
          if (badge) badge.remove();
          if (readButton) readButton.remove();
        }
      });

      console.log('Notification system sync initialized');
    }
  }

  // Sync with header notification system
  function syncWithHeaderNotifications(notificationId, action, wasUnread = false) {
    console.log(`Syncing notification ${notificationId} with header: ${action}`);

    // Check if header notification system exists
    if (window.NotificationSystem && window.NotificationSystem.state) {
      const headerSystem = window.NotificationSystem;

      if (action === 'delete') {
        // Remove from header notification state
        const notification = headerSystem.state.notifications.get(parseInt(notificationId));
        if (notification) {
          headerSystem.state.notifications.delete(parseInt(notificationId));

          // Update unread count if it was unread
          if (wasUnread && !notification.read_at) {
            headerSystem.updateUnreadCount(Math.max(0, headerSystem.state.unreadCount - 1));
          }

          // Update header notification panel if open
          headerSystem.updateNotificationPanel();

          // Store updated notifications
          headerSystem.storeNotifications();

          console.log('Successfully synced deletion with header notification system');
        }
      } else if (action === 'mark_read') {
        // Update read status in header system
        const notification = headerSystem.state.notifications.get(parseInt(notificationId));
        if (notification && !notification.read_at) {
          notification.read_at = new Date().toISOString();
          headerSystem.updateUnreadCount(Math.max(0, headerSystem.state.unreadCount - 1));
          headerSystem.updateNotificationPanel();
          headerSystem.storeNotifications();

          console.log('Successfully synced mark as read with header notification system');
        }
      } else if (action === 'mark_all_read') {
        // Mark all notifications as read in header system
        let unreadCount = 0;
        const now = new Date().toISOString();

        headerSystem.state.notifications.forEach(notification => {
          if (!notification.read_at) {
            notification.read_at = now;
            unreadCount++;
          }
        });

        headerSystem.updateUnreadCount(0);
        headerSystem.updateNotificationPanel();
        headerSystem.storeNotifications();

        console.log('Successfully synced mark all as read with header notification system');
      }
    } else {
      console.log('Header notification system not found, skipping sync');
    }
  }

  // Handle clicks for different notification types without action URLs
  function handleNotificationTypeClick(type, notificationId) {
    console.log(`Notification ${notificationId} (${type}) clicked`);

    switch (type) {
      case 'new_message':
        // Navigate to messages tab
        window.location.href = '?tab=messages';
        break;

      case 'trade_offer':
        // Navigate to trades tab
        window.location.href = '?tab=trades';
        break;

      case 'order_update':
      case 'payment_complete':
        // Navigate to orders tab
        window.location.href = '?tab=orders';
        break;

      case 'listing_approved':
      case 'listing_rejected':
        // Navigate to my listings tab
        window.location.href = '?tab=mylistings';
        break;

      case 'system':
      case 'security':
      case 'price_alert':
      default:
        // For system notifications, just provide visual feedback
        console.log(`${type} notification clicked - marked as read`);
        break;
    }
  }

  // Helper function for time formatting
  function formatTimeAgo(date) {
    const now = new Date();
    const diffInMs = now - date;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) return 'Az önce';
    if (diffInMinutes < 60) return `${diffInMinutes} dakika önce`;
    if (diffInHours < 24) return `${diffInHours} saat önce`;
    if (diffInDays < 7) return `${diffInDays} gün önce`;
    return date.toLocaleDateString('tr-TR');
  }

  // Global functions for notification actions
  window.markNotificationRead = async function(notificationId) {
    try {
      await fetchJSON(`${API_BASE}/api/notifications/${notificationId}/read`, { method: 'POST' });

      // Update the DOM immediately for better UX
      const notificationElement = document.querySelector(`[data-id="${notificationId}"]`);
      if (notificationElement) {
        notificationElement.classList.remove('unread');
        const badge = notificationElement.querySelector('.notification-badge');
        const readButton = notificationElement.querySelector('button[onclick*="markNotificationRead"]');
        if (badge) badge.remove();
        if (readButton) readButton.remove();
      }

      // Sync with header notification system
      syncWithHeaderNotifications(notificationId, 'mark_read');

      // Refresh the notifications tab to update counts
      const content = $('#tab_content');
      if (content) renderNotifications(content);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);

      // Handle 404 case - notification might already be read or deleted
      if (error.message.includes('404')) {
        console.log('Notification not found, refreshing list...');
        const content = $('#tab_content');
        if (content) renderNotifications(content);
      } else {
        alert('Bildirim işaretlenirken bir hata oluştu. Lütfen tekrar deneyin.');
      }
    }
  };

  window.markAllNotificationsRead = async function() {
    try {
      await fetchJSON(`${API_BASE}/api/notifications/read-all`, { method: 'POST' });

      // Update all unread notifications in DOM immediately
      const unreadNotifications = document.querySelectorAll('.notification-item.unread');
      unreadNotifications.forEach(notification => {
        notification.classList.remove('unread');
        const badge = notification.querySelector('.notification-badge');
        const readButton = notification.querySelector('button[onclick*="markNotificationRead"]');
        if (badge) badge.remove();
        if (readButton) readButton.remove();
      });

      // Sync with header notification system
      syncWithHeaderNotifications(null, 'mark_all_read');

      // Refresh the notifications tab to update counts
      const content = $('#tab_content');
      if (content) renderNotifications(content);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      alert('Tüm bildirimler işaretlenirken bir hata oluştu. Lütfen tekrar deneyin.');
    }
  };

  window.deleteNotification = async function(notificationId) {
    if (!confirm('Bu bildirimi silmek istediğinizden emin misiniz?')) return;

    try {
      await fetchJSON(`${API_BASE}/api/notifications/${notificationId}`, { method: 'DELETE' });

      // Remove the notification item from DOM immediately for better UX
      const notificationElement = document.querySelector(`[data-id="${notificationId}"]`);
      const wasUnread = notificationElement && notificationElement.classList.contains('unread');

      if (notificationElement) {
        notificationElement.remove();
      }

      // Sync with header notification system
      syncWithHeaderNotifications(notificationId, 'delete', wasUnread);

      // Refresh the notifications tab to update counts
      const content = $('#tab_content');
      if (content) renderNotifications(content);

    } catch (error) {
      console.error('Failed to delete notification:', error);

      // Handle specific error cases
      if (error.message.includes('404')) {
        // Notification already deleted, just refresh the list
        console.log('Notification already deleted, refreshing list...');

        // Still sync with header to remove stale notifications
        const notificationElement = document.querySelector(`[data-id="${notificationId}"]`);
        const wasUnread = notificationElement && notificationElement.classList.contains('unread');
        if (notificationElement) {
          notificationElement.remove();
        }
        syncWithHeaderNotifications(notificationId, 'delete', wasUnread);

        const content = $('#tab_content');
        if (content) renderNotifications(content);
      } else {
        // Show user-friendly error message
        alert('Bildirim silinirken bir hata oluştu. Lütfen tekrar deneyin.');
      }
    }
  };

  // ---- SALES (seller orders)
  async function renderSales(root){
    if (!root) return;
    root.innerHTML = `<div id="salesContainer"></div>`;

    // Initialize the sales tab using the sales-tab.js functionality
    if (typeof window.loadSalesTab === 'function') {
      window.loadSalesTab();
    } else {
      root.innerHTML = `
        <div class="text-center py-4">
          <i class="fas fa-exclamation-triangle fa-2x text-warning mb-3"></i>
          <h5>Satış yönetimi yüklenemedi</h5>
          <p class="text-muted">Lütfen sayfayı yenileyin.</p>
          <button class="btn btn-primary" onclick="location.reload()">
            <i class="fas fa-sync-alt me-2"></i>Sayfayı Yenile
          </button>
        </div>
      `;
    }
  }

  // ---- LEGAL RIGHTS
  async function renderLegal(root){
    if (!root) return;

    root.innerHTML = `
      <div class="card">
        <div class="pad">
          <h3><i class="fas fa-shield-alt me-2"></i>KVKK ve Yasal Haklarım</h3>
          <div class="muted small mb-4">Kişisel verileriniz ve yasal haklarınız hakkında bilgiler</div>
        </div>

        <div class="pad">
          <div class="row mb-4">
            <div class="col-md-6">
              <div class="card bg-light">
                <div class="pad">
                  <h4><i class="fas fa-user-shield text-primary me-2"></i>Kişisel Veri Koruması</h4>
                  <p class="small mb-3">6698 sayılı KVKK kapsamında sahip olduğunuz haklar:</p>
                  <ul class="small">
                    <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
                    <li>İşlenen verileriniz hakkında bilgi talep etme</li>
                    <li>Verilerin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme</li>
                    <li>Yurt içinde/dışında aktarıldığı üçüncü kişileri bilme</li>
                    <li>Eksik/yanlış işlenmiş verilerin düzeltilmesini isteme</li>
                    <li>Kanunda öngörülen şartlar çerçevesinde verilerin silinmesini isteme</li>
                  </ul>
                </div>
              </div>
            </div>

            <div class="col-md-6">
              <div class="card bg-light">
                <div class="pad">
                  <h4><i class="fas fa-clipboard-check text-success me-2"></i>Onay Durumlarım</h4>
                  <div class="mb-3">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                      <span class="small">Pazarlama İzni:</span>
                      <span class="badge bg-success">✓ Onaylı</span>
                    </div>
                    <div class="d-flex justify-content-between align-items-center mb-2">
                      <span class="small">SMS Bildirimleri:</span>
                      <span class="badge bg-success">✓ Onaylı</span>
                    </div>
                    <div class="d-flex justify-content-between align-items-center mb-2">
                      <span class="small">E-posta Bildirimleri:</span>
                      <span class="badge bg-success">✓ Onaylı</span>
                    </div>
                    <div class="d-flex justify-content-between align-items-center mb-2">
                      <span class="small">Çerez Kullanımı:</span>
                      <span class="badge bg-success">✓ Onaylı</span>
                    </div>
                  </div>
                  <button class="btn btn-sm btn-outline-secondary w-100">Onay Ayarlarını Düzenle</button>
                </div>
              </div>
            </div>
          </div>

          <div class="row">
            <div class="col-12">
              <h4><i class="fas fa-gavel text-warning me-2"></i>Yasal Belgeler ve İşlemler</h4>
              <div class="d-flex flex-wrap gap-2 mb-3">
                <a href="/legal/privacy-policy.html" class="btn btn-outline-primary btn-sm">
                  <i class="fas fa-file-alt me-1"></i>Gizlilik Politikası
                </a>
                <a href="/legal/terms.html" class="btn btn-outline-primary btn-sm">
                  <i class="fas fa-handshake me-1"></i>Kullanım Koşulları
                </a>
                <a href="/legal/kvkk.html" class="btn btn-outline-primary btn-sm">
                  <i class="fas fa-shield-alt me-1"></i>KVKK Aydınlatma Metni
                </a>
                <a href="/legal/complaints.html" class="btn btn-outline-danger btn-sm">
                  <i class="fas fa-exclamation-triangle me-1"></i>Şikayet Sistemi
                </a>
              </div>
            </div>
          </div>

          <div class="row mt-4">
            <div class="col-md-6">
              <div class="bg-warning bg-opacity-10 p-3 rounded">
                <h5><i class="fas fa-download text-warning me-2"></i>Verilerimi İndir</h5>
                <p class="small mb-2">Platformdaki tüm kişisel verilerinizi indirebilirsiniz.</p>
                <button class="btn btn-warning btn-sm">Veri Paketimi Talep Et</button>
              </div>
            </div>

            <div class="col-md-6">
              <div class="bg-danger bg-opacity-10 p-3 rounded">
                <h5><i class="fas fa-trash-alt text-danger me-2"></i>Hesabımı Sil</h5>
                <p class="small mb-2">Hesabınızı ve tüm verilerinizi kalıcı olarak silebilirsiniz.</p>
                <button class="btn btn-danger btn-sm" onclick="if(confirm('Hesabınızı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!')) alert('Hesap silme talebiniz alındı. 7 iş günü içinde işleme alınacaktır.')">Hesabımı Sil</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ---- ORDER DETAILS AND TRACKING FUNCTIONS

  // Show order details in a modal
  window.showOrderDetails = async (orderId) => {
    try {
      const orderData = await fetchJSON(`${API_BASE}/api/orders/${orderId}`);
      const order = orderData.order || orderData;

      // Create modal HTML
      const modalHtml = `
        <div class="modal fade" id="orderDetailsModal" tabindex="-1">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">
                  <i class="fas fa-file-invoice me-2"></i>Sipariş Detayları #${order.id}
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <div class="order-info">
                  <div class="row mb-3">
                    <div class="col-6">
                      <strong>Sipariş Tarihi:</strong><br>
                      ${new Date(order.created_at).toLocaleDateString('tr-TR', {
                        day: 'numeric', month: 'long', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </div>
                    <div class="col-6">
                      <strong>Durum:</strong><br>
                      <span class="badge bg-${order.status === 'pending' ? 'warning' :
                        order.status === 'confirmed' ? 'success' :
                        order.status === 'shipped' ? 'info' :
                        order.status === 'delivered' ? 'primary' : 'secondary'}">
                        ${order.status === 'pending' ? 'Bekliyor' :
                          order.status === 'confirmed' ? 'Onaylandı' :
                          order.status === 'shipped' ? 'Kargoda' :
                          order.status === 'delivered' ? 'Teslim Edildi' :
                          order.status === 'cancelled' ? 'İptal Edildi' : order.status}
                      </span>
                    </div>
                  </div>

                  ${order.items && order.items.length > 0 ? `
                    <h6><i class="fas fa-list me-2"></i>Sipariş Öğeleri</h6>
                    <div class="order-items mb-3">
                      ${order.items.map(item => `
                        <div class="d-flex align-items-center mb-2 p-2 border rounded">
                          ${item.thumb_url ? `<img src="${item.thumb_url}" class="me-3" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">` : ''}
                          <div class="flex-grow-1">
                            <div class="fw-bold">${esc(item.title || 'Ürün')}</div>
                            <small class="text-muted">Adet: ${item.qty} × ${toTL(item.unit_price_minor, item.currency)}</small>
                          </div>
                          <div class="text-end">
                            <strong>${toTL(item.qty * item.unit_price_minor, item.currency)}</strong>
                          </div>
                        </div>
                      `).join('')}
                    </div>
                  ` : ''}

                  <div class="row">
                    <div class="col-6">
                      <h6><i class="fas fa-truck me-2"></i>Kargo Bilgileri</h6>
                      <p class="mb-1"><strong>Yöntem:</strong> ${order.shipping_method === 'express' ? 'Hızlı Kargo' : 'Standart Kargo'}</p>
                      <p class="mb-1"><strong>Ücreti:</strong> ${toTL(order.shipping_minor, order.currency)}</p>
                      ${order.tracking_number ? `<p class="mb-1"><strong>Takip No:</strong> ${order.tracking_number}</p>` : ''}
                      ${order.shipping_address ? `
                        <p class="mb-1"><strong>Adres:</strong><br>
                        <small>${esc(order.shipping_address)}</small></p>
                      ` : ''}
                    </div>
                    <div class="col-6">
                      <h6><i class="fas fa-credit-card me-2"></i>Ödeme Bilgileri</h6>
                      <p class="mb-1"><strong>Yöntem:</strong> ${
                        order.payment_method === 'credit_card' ? 'Kredi Kartı' :
                        order.payment_method === 'bank_transfer' ? 'Havale/EFT' :
                        order.payment_method === 'cash_on_delivery' ? 'Kapıda Ödeme' : order.payment_method
                      }</p>
                      <p class="mb-1"><strong>Ara Toplam:</strong> ${toTL(order.subtotal_minor, order.currency)}</p>
                      <p class="mb-1"><strong>Kargo:</strong> ${toTL(order.shipping_minor, order.currency)}</p>
                      <p class="mb-0"><strong>Toplam:</strong> ${toTL(order.total_minor, order.currency)}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                ${order.tracking_number ? `
                  <button type="button" class="btn btn-info" onclick="trackOrder('${order.tracking_number}', '${order.shipping_method}')">
                    <i class="fas fa-truck me-1"></i>Kargo Takip
                  </button>
                ` : ''}
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Kapat</button>
              </div>
            </div>
          </div>
        </div>
      `;

      // Remove existing modal if any
      const existingModal = document.getElementById('orderDetailsModal');
      if (existingModal) existingModal.remove();

      // Add modal to DOM
      document.body.insertAdjacentHTML('beforeend', modalHtml);

      // Show modal
      const modal = new bootstrap.Modal(document.getElementById('orderDetailsModal'));
      modal.show();

    } catch (e) {
      console.error('showOrderDetails error:', e);
      alert('Sipariş detayları alınamadı: ' + (e.message || 'Bilinmeyen hata'));
    }
  };

  // Track order with cargo company
  window.trackOrder = (trackingNumber, shippingMethod = 'standard') => {
    if (!trackingNumber || trackingNumber === 'null' || trackingNumber === 'undefined') {
      // Show modal even without tracking number - user can still access cargo sites
      trackingNumber = 'HENÜZ-ATANMADI';
    }

    // Popular Turkish cargo companies and their tracking URLs
    const cargoCompanies = {
      'yurtici': `https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=${trackingNumber}`,
      'mng': `https://www.mngkargo.com.tr/shipmenttracking?q=${trackingNumber}`,
      'aras': `https://kargo.araskargo.com.tr/mainpage/tracking/${trackingNumber}`,
      'ptt': `https://gonderitakip.ptt.gov.tr/post-tracking?barcode=${trackingNumber}`,
      'ups': `https://www.ups.com/track?tracknum=${trackingNumber}`,
      'dhl': `https://www.dhl.com/tr-tr/home/tracking.html?tracking-id=${trackingNumber}`,
      'fedex': `https://www.fedex.com/apps/fedextrack/?tracknumbers=${trackingNumber}`,
      'trendyol': `https://www.trendyolexpress.com/tracking/${trackingNumber}`
    };

    // Create cargo selection modal
    const cargoModalHtml = `
      <div class="modal fade" id="cargoTrackModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="fas fa-truck me-2"></i>Kargo Takip - ${trackingNumber}
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              ${trackingNumber === 'HENÜZ-ATANMADI' ? `
                <div class="alert alert-warning">
                  <i class="fas fa-exclamation-triangle me-2"></i>
                  Bu sipariş için henüz takip numarası oluşturulmamış. Kargo firması web sitesinden sipariş numaranız ile sorgulama yapabilirsiniz.
                </div>
              ` : ''}
              <p class="mb-3">Kargo firmanızı seçerek takip sayfasına yönlendirileceksiniz:</p>
              <div class="d-grid gap-2">
                <button type="button" class="btn btn-outline-primary" onclick="window.open('${cargoCompanies.yurtici}', '_blank')">
                  <i class="fas fa-external-link-alt me-2"></i>Yurtiçi Kargo
                </button>
                <button type="button" class="btn btn-outline-primary" onclick="window.open('${cargoCompanies.mng}', '_blank')">
                  <i class="fas fa-external-link-alt me-2"></i>MNG Kargo
                </button>
                <button type="button" class="btn btn-outline-primary" onclick="window.open('${cargoCompanies.aras}', '_blank')">
                  <i class="fas fa-external-link-alt me-2"></i>Aras Kargo
                </button>
                <button type="button" class="btn btn-outline-primary" onclick="window.open('${cargoCompanies.ptt}', '_blank')">
                  <i class="fas fa-external-link-alt me-2"></i>PTT Kargo
                </button>
                <button type="button" class="btn btn-outline-primary" onclick="window.open('${cargoCompanies.trendyol}', '_blank')">
                  <i class="fas fa-external-link-alt me-2"></i>Trendyol Express
                </button>
                <hr>
                <button type="button" class="btn btn-outline-secondary" onclick="window.open('${cargoCompanies.ups}', '_blank')">
                  <i class="fas fa-external-link-alt me-2"></i>UPS
                </button>
                <button type="button" class="btn btn-outline-secondary" onclick="window.open('${cargoCompanies.dhl}', '_blank')">
                  <i class="fas fa-external-link-alt me-2"></i>DHL
                </button>
                <button type="button" class="btn btn-outline-secondary" onclick="window.open('${cargoCompanies.fedex}', '_blank')">
                  <i class="fas fa-external-link-alt me-2"></i>FedEx
                </button>
              </div>
              <div class="mt-3 p-2 bg-light rounded">
                <small class="text-muted">
                  <i class="fas fa-info-circle me-1"></i>
                  ${trackingNumber !== 'HENÜZ-ATANMADI' ? `Takip Numarası: <code>${trackingNumber}</code><br>` : ''}
                  Kargo firmanızı bilmiyorsanız, yukarıdaki seçenekleri tek tek deneyebilirsiniz.
                </small>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Kapat</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById('cargoTrackModal');
    if (existingModal) existingModal.remove();

    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', cargoModalHtml);

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('cargoTrackModal'));
    modal.show();
  };

  // ---- Router
  async function route(){
    await requireLogin();
    const tab = getTab();
    setActive(tab);
    document.title = tab==='edit'?'Profil Düzenle | Hesabım':tab==='orders'?'Aldıklarım | Hesabım':tab==='mylistings'?'İlanlarım | Hesabım':tab==='sales'?'Satışlarım | Hesabım':tab==='trades'?'Takas Tekliflerim | Hesabım':tab==='messages'?'Mesajlarım | Hesabım':tab==='notifications'?'Bildirimlerim | Hesabım':tab==='legal'?'Yasal Haklarım | Hesabım':'Hesabım';
    const content = $('#tab_content'); if (!content) return;
    if (tab==='edit') return renderEdit(content);
    if (tab==='orders') return renderOrders(content);
    if (tab==='mylistings') return renderMyListings(content);
    if (tab==='sales') return renderSales(content);
    if (tab==='trades') return renderTrades(content);
    if (tab==='messages') return renderMessages(content);
    if (tab==='notifications') return renderNotifications(content);
    if (tab==='legal') return renderLegal(content);
    return renderOverview(content);
  }

  function wireTabs(){
    document.querySelectorAll('#tabs a').forEach(a=>{
      if (a.dataset.bound==='1') return;
      a.dataset.bound='1';
      a.addEventListener('click', (e)=>{
        const tab=a.dataset.tab; if (!tab) return;
        e.preventDefault();
        const u = new URL(location.href); u.searchParams.set('tab', tab);
        history.pushState({tab}, '', u.toString().split('#')[0]);
        route();
      });
    });
  }

  // Initialize profile page when dependencies are ready
  function startProfile() {
    console.log('🚀 Profile.js: Starting profile initialization');
    console.log('🚀 Profile.js: API_BASE available:', API_BASE);

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        wireTabs();
        route();
      });
    } else {
      wireTabs();
      route();
    }
  }

  // Wait for dependencies to be loaded before starting
  if (window.dependenciesLoadedTriggered) {
    console.log('🚀 Profile.js: Dependencies already loaded, starting immediately');
    startProfile();
  } else {
    console.log('🚀 Profile.js: Waiting for dependencies to load...');
    document.addEventListener('dependenciesLoaded', function() {
      console.log('🚀 Profile.js: Dependencies loaded event received, starting profile');
      startProfile();
    });
  }

  // Keep legacy partials:loaded listener for backwards compatibility
  document.addEventListener('partials:loaded', ()=>{ wireTabs(); route(); });
  window.addEventListener('popstate', route);
})();