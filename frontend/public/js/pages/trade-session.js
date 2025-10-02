// frontend/public/js/pages/trade-session.js
// Takas koordinasyon sayfası

(function() {
  'use strict';

  const API_BASE = window.getCorrectApiBase ? window.getCorrectApiBase() : (window.APP && window.APP.API_BASE) || '';

  // DOM elements
  const elements = {
    sessionLoading: document.getElementById('sessionLoading'),
    sessionContent: document.getElementById('sessionContent'),
    sessionError: document.getElementById('sessionError'),
    sessionHeader: document.getElementById('sessionHeader'),
    listingInfo: document.getElementById('listingInfo'),
    tradeInfo: document.getElementById('tradeInfo'),
    meetingSection: document.getElementById('meetingSection'),
    confirmationSection: document.getElementById('confirmationSection')
  };

  // Current session data
  let currentSession = null;
  let currentUser = null;

  // Helper functions
  const esc = (str) => (str || '').toString().replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));

  const toTL = (minor, currency = 'TRY') => {
    const value = (Number(minor) || 0) / 100;
    try {
      return value.toLocaleString('tr-TR', { style: 'currency', currency: currency || 'TRY' });
    } catch {
      return `${value.toLocaleString('tr-TR')} ${esc(currency || 'TRY')}`;
    }
  };

  // API request helper
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
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Get session ID from URL
  function getSessionId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
  }

  // Load session data
  async function loadSession() {
    const sessionId = getSessionId();
    if (!sessionId) {
      showError('Session ID bulunamadı');
      return;
    }

    try {
      const response = await apiRequest(`/api/trade/sessions/${sessionId}`);
      if (response.ok && response.session) {
        currentSession = response.session;
        renderSession();
      } else {
        showError('Session bulunamadı');
      }
    } catch (error) {
      console.error('Session load failed:', error);
      showError('Session yüklenirken hata oluştu');
    }
  }

  // Render session
  function renderSession() {
    if (!currentSession) return;

    showContent();
    renderHeader();
    renderListingInfo();
    renderTradeInfo();
    renderMeetingSection();
    renderConfirmationSection();
  }

  // Render header
  function renderHeader() {
    const session = currentSession;
    const statusClass = `status-${session.status}`;
    const statusText = getStatusText(session.status);

    elements.sessionHeader.innerHTML = `
      <div class="session-header">
        <div class="session-status ${statusClass}">${statusText}</div>
        <h1>Takas Koordinasyonu</h1>
        <p>${esc(session.other_party_name)} ile takas süreci</p>
        <div class="d-flex justify-content-center gap-3 mt-3">
          <span><i class="fas fa-user me-1"></i> ${session.user_role === 'seller' ? 'Satıcı' : 'Alıcı'}</span>
          <span><i class="fas fa-calendar me-1"></i> ${new Date(session.created_at).toLocaleDateString('tr-TR')}</span>
        </div>
      </div>
    `;
  }

  // Render listing info
  function renderListingInfo() {
    const session = currentSession;
    const price = session.price_minor ? toTL(session.price_minor, session.currency) : 'Fiyat belirtilmemiş';

    elements.listingInfo.innerHTML = `
      <div class="listing-info">
        <img class="listing-image"
             src="${session.cover_url || '/assets/placeholder.png'}"
             alt="${esc(session.listing_title)}"
             onerror="this.src='/assets/placeholder.png'">
        <div class="listing-details">
          <h4>${esc(session.listing_title)}</h4>
          <div class="text-muted mb-2">${price}</div>
          ${session.listing_description ? `<p class="small">${esc(session.listing_description).substring(0, 100)}...</p>` : ''}
        </div>
      </div>

      <div class="party-info">
        <div class="party-avatar">
          ${session.other_party_name.charAt(0).toUpperCase()}
        </div>
        <div>
          <strong>${esc(session.other_party_name)}</strong>
          <div class="text-muted small">${session.user_role === 'seller' ? 'Alıcı' : 'Satıcı'}</div>
          ${session.other_party_phone && (session.status === 'meeting_arranged' || session.status === 'completed') ?
            `<div class="small"><i class="fas fa-phone me-1"></i>${esc(session.other_party_phone)}</div>` : ''}
        </div>
      </div>
    `;
  }

  // Render trade info
  function renderTradeInfo() {
    const session = currentSession;
    const cashAdjust = session.cash_adjust_minor ? toTL(session.cash_adjust_minor) : null;

    elements.tradeInfo.innerHTML = `
      <div class="trade-details">
        <h5><i class="fas fa-exchange-alt me-2"></i>Teklif Edilen</h5>
        <p>${esc(session.offered_text)}</p>
        ${cashAdjust ? `
          <div class="d-flex align-items-center gap-2 mt-2">
            <span class="badge bg-success">+ ${cashAdjust} ek nakit</span>
          </div>
        ` : ''}
      </div>

      <div class="row">
        <div class="col-6">
          <strong>Kabul Tarihi:</strong><br>
          <small class="text-muted">${new Date(session.updated_at).toLocaleString('tr-TR')}</small>
        </div>
        <div class="col-6">
          <strong>Session ID:</strong><br>
          <small class="text-muted">#${session.id}</small>
        </div>
      </div>
    `;
  }

  // Render meeting section
  function renderMeetingSection() {
    const session = currentSession;

    if (session.status === 'completed' || session.status === 'cancelled') {
      elements.meetingSection.innerHTML = '';
      return;
    }

    // Render different sections based on status
    if (['seller_shipped', 'buyer_shipped', 'both_shipped'].includes(session.status)) {
      renderShippingStatus();
      return;
    }

    const hasMeetingInfo = session.meeting_address || session.meeting_date ||
                          session.seller_shipping_address || session.buyer_shipping_address;

    elements.meetingSection.innerHTML = `
      <div class="meeting-form">
        <h3><i class="fas fa-map-marker-alt me-2"></i>Teslimat Planı</h3>

        ${hasMeetingInfo ? `
          <div class="alert alert-info">
            <h5><i class="fas fa-info-circle me-2"></i>Planlanmış Teslimat</h5>
            ${session.meeting_type === 'cargo' ? '<strong>Kargo ile teslimat</strong>' : '<strong>Yüz yüze buluşma</strong>'}

            ${session.meeting_type === 'cargo' ? `
              ${session.seller_shipping_address || session.buyer_shipping_address ? `
                <br><strong>Kargo Bilgileri:</strong>
                ${session.seller_shipping_address ? `<br>• Satıcı adresi: ${esc(session.seller_shipping_address)}` : ''}
                ${session.buyer_shipping_address ? `<br>• Alıcı adresi: ${esc(session.buyer_shipping_address)}` : ''}
                ${session.seller_cargo_company ? `<br>• Satıcı kargo: ${esc(session.seller_cargo_company)}` : ''}
                ${session.buyer_cargo_company ? `<br>• Alıcı kargo: ${esc(session.buyer_cargo_company)}` : ''}
              ` : ''}
            ` : `
              ${session.meeting_address ? `<br><strong>Adres:</strong> ${esc(session.meeting_address)}` : ''}
              ${session.meeting_date ? `<br><strong>Tarih:</strong> ${new Date(session.meeting_date).toLocaleString('tr-TR')}` : ''}
            `}

            ${session.meeting_notes ? `<br><strong>Notlar:</strong> ${esc(session.meeting_notes)}` : ''}
          </div>
        ` : ''}

        <form id="meetingForm">
          <div class="row">
            <div class="col-md-6">
              <div class="form-group">
                <label for="meetingType">Teslimat Türü</label>
                <select class="form-control" id="meetingType" name="meeting_type" required>
                  <option value="in_person" ${session.meeting_type === 'in_person' ? 'selected' : ''}>Yüz yüze buluşma</option>
                  <option value="cargo" ${session.meeting_type === 'cargo' ? 'selected' : ''}>Kargo ile teslimat</option>
                </select>
              </div>
            </div>
            <div class="col-md-6" id="dateSection">
              <div class="form-group">
                <label for="meetingDate">Tarih ve Saat</label>
                <input type="datetime-local" class="form-control" id="meetingDate" name="meeting_date"
                       value="${session.meeting_date ? new Date(session.meeting_date).toISOString().slice(0, 16) : ''}">
              </div>
            </div>
          </div>

          <div id="addressSection">
            <div class="form-group">
              <label for="meetingAddress" id="addressLabel">Buluşma Adresi</label>
              <textarea class="form-control" id="meetingAddress" name="meeting_address" rows="3"
                        placeholder="Buluşma adresi..." required>${session.meeting_address || ''}</textarea>
            </div>
          </div>

          <div id="cargoSection" style="display: none;">
            <div class="row">
              <div class="col-md-6">
                <div class="form-group">
                  <label for="shippingAddress">Kargo Adresiniz</label>
                  <textarea class="form-control" id="shippingAddress" name="shipping_address" rows="3"
                            placeholder="Kargo almak için adresiniz..." required></textarea>
                  <small class="text-muted">Karşı tarafın ürününü gönderebileceği adresiniz</small>
                </div>
              </div>
              <div class="col-md-6">
                <div class="form-group">
                  <label for="cargoCompany">Kargo Firmanız</label>
                  <select class="form-control" id="cargoCompany" name="cargo_company" required>
                    <option value="">Kargo firması seçin</option>
                    <option value="aras">Aras Kargo</option>
                    <option value="mng">MNG Kargo</option>
                    <option value="yurtici">Yurtiçi Kargo</option>
                    <option value="ptt">PTT Kargo</option>
                    <option value="ups">UPS</option>
                    <option value="fedex">FedEx</option>
                    <option value="dhl">DHL</option>
                    <option value="sendeo">Sendeo</option>
                    <option value="other">Diğer</option>
                  </select>
                  <small class="text-muted">Kendi ürününüzü göndereceğiniz kargo firması</small>
                </div>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label for="meetingNotes">Ek Notlar (Opsiyonel)</label>
            <textarea class="form-control" id="meetingNotes" name="meeting_notes" rows="2"
                      placeholder="Ek bilgiler, uyarılar...">${session.meeting_notes || ''}</textarea>
          </div>

          <button type="submit" class="btn btn-primary">
            <i class="fas fa-save me-1"></i>Teslimat Planını ${hasMeetingInfo ? 'Güncelle' : 'Kaydet'}
          </button>
        </form>

        ${session.status === 'shipping_arranged' ? renderShippingActions() : ''}
      </div>
    `;

    // Add event listeners
    const meetingForm = document.getElementById('meetingForm');
    const meetingType = document.getElementById('meetingType');

    meetingForm.addEventListener('submit', handleMeetingSubmit);
    meetingType.addEventListener('change', toggleMeetingType);

    // Set initial state
    toggleMeetingType();
  }

  // Render confirmation section
  function renderConfirmationSection() {
    const session = currentSession;

    // Show confirmation section for meeting arranged or shipping completed states
    if (!['meeting_arranged', 'both_shipped', 'completed'].includes(session.status)) {
      elements.confirmationSection.innerHTML = '';
      return;
    }

    const userConfirmed = session.user_role === 'seller' ? session.seller_confirmed : session.buyer_confirmed;
    const otherConfirmed = session.user_role === 'seller' ? session.buyer_confirmed : session.seller_confirmed;

    if (session.status === 'completed') {
      elements.confirmationSection.innerHTML = `
        <div class="confirmation-section" style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border-color: #10b981;">
          <h3><i class="fas fa-check-circle text-success me-2"></i>Takas Tamamlandı! 🎉</h3>
          <p>Bu takas başarıyla tamamlanmıştır. Her iki taraf da takasın gerçekleştiğini onaylamıştır.</p>
          <p><small class="text-muted">Tamamlanma tarihi: ${new Date(session.completed_at).toLocaleString('tr-TR')}</small></p>
          <a href="/profile.html?tab=trades" class="btn btn-primary">Takas Geçmişine Dön</a>
        </div>
      `;
      return;
    }

    elements.confirmationSection.innerHTML = `
      <div class="confirmation-section">
        <h3><i class="fas fa-handshake me-2"></i>Takas Tamamlama Onayı</h3>
        <p>Takas gerçekleştikten sonra her iki tarafın da onaylaması gerekmektedir.</p>

        <div class="row mb-4">
          <div class="col-6 text-center">
            <div class="${userConfirmed ? 'text-success' : 'text-muted'}">
              <i class="fas fa-${userConfirmed ? 'check-circle' : 'clock'} fa-2x mb-2"></i>
              <div><strong>Sizin Onayınız</strong></div>
              <div>${userConfirmed ? 'Onaylandı ✓' : 'Bekliyor'}</div>
            </div>
          </div>
          <div class="col-6 text-center">
            <div class="${otherConfirmed ? 'text-success' : 'text-muted'}">
              <i class="fas fa-${otherConfirmed ? 'check-circle' : 'clock'} fa-2x mb-2"></i>
              <div><strong>${esc(session.other_party_name)}</strong></div>
              <div>${otherConfirmed ? 'Onaylandı ✓' : 'Bekliyor'}</div>
            </div>
          </div>
        </div>

        <div class="confirmation-buttons">
          ${!userConfirmed ? `
            <button class="btn btn-success" onclick="confirmTrade()">
              <i class="fas fa-check me-1"></i>Takası Onayla
            </button>
          ` : `
            <div class="alert alert-success">
              <i class="fas fa-check me-2"></i>Onayınız alındı. ${esc(session.other_party_name)} kişisinin onayı bekleniyor...
            </div>
          `}
        </div>
      </div>
    `;
  }

  // Handle meeting form submit
  async function handleMeetingSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const meetingType = formData.get('meeting_type');

    let requestData;
    let endpoint;

    if (meetingType === 'cargo') {
      requestData = {
        meeting_type: meetingType,
        shipping_address: formData.get('shipping_address'),
        cargo_company: formData.get('cargo_company'),
        notes: formData.get('meeting_notes')
      };
      endpoint = `/api/trade/sessions/${currentSession.id}/shipping`;
    } else {
      requestData = {
        meeting_type: meetingType,
        meeting_address: formData.get('meeting_address'),
        meeting_date: formData.get('meeting_date'),
        meeting_notes: formData.get('meeting_notes')
      };
      endpoint = `/api/trade/sessions/${currentSession.id}/shipping`;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Kaydediliyor...';

      const response = await apiRequest(endpoint, {
        method: 'PUT',
        body: JSON.stringify(requestData)
      });

      if (response.ok) {
        showAlert('success', response.message || 'Teslimat planı başarıyla kaydedildi!');
        await loadSession();
      } else {
        throw new Error(response.error || 'Kaydetme başarısız');
      }
    } catch (error) {
      console.error('Meeting update failed:', error);
      showAlert('danger', 'Teslimat planı kaydedilemedi. Lütfen tekrar deneyin.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }

  // Toggle between meeting types
  function toggleMeetingType() {
    const meetingType = document.getElementById('meetingType');
    const dateSection = document.getElementById('dateSection');
    const addressSection = document.getElementById('addressSection');
    const cargoSection = document.getElementById('cargoSection');
    const addressLabel = document.getElementById('addressLabel');
    const meetingAddress = document.getElementById('meetingAddress');
    const meetingDate = document.getElementById('meetingDate');
    const shippingAddress = document.getElementById('shippingAddress');
    const cargoCompany = document.getElementById('cargoCompany');

    const session = currentSession;

    if (meetingType.value === 'cargo') {
      // Show cargo fields, hide meeting fields
      dateSection.style.display = 'none';
      addressSection.style.display = 'none';
      cargoSection.style.display = 'block';

      // Fill cargo fields with existing data
      if (session.user_role === 'seller' && session.seller_shipping_address) {
        shippingAddress.value = session.seller_shipping_address;
      } else if (session.user_role === 'buyer' && session.buyer_shipping_address) {
        shippingAddress.value = session.buyer_shipping_address;
      }

      if (session.user_role === 'seller' && session.seller_cargo_company) {
        cargoCompany.value = session.seller_cargo_company;
      } else if (session.user_role === 'buyer' && session.buyer_cargo_company) {
        cargoCompany.value = session.buyer_cargo_company;
      }

      // Update required fields
      meetingAddress.required = false;
      meetingDate.required = false;
      shippingAddress.required = true;
      cargoCompany.required = true;
    } else {
      // Show meeting fields, hide cargo fields
      dateSection.style.display = 'block';
      addressSection.style.display = 'block';
      cargoSection.style.display = 'none';

      // Update labels and placeholders
      addressLabel.textContent = 'Buluşma Adresi';
      meetingAddress.placeholder = 'Buluşma adresi...';

      // Update required fields
      meetingAddress.required = true;
      meetingDate.required = true;
      shippingAddress.required = false;
      cargoCompany.required = false;
    }
  }

  // Render shipping actions
  function renderShippingActions() {
    const session = currentSession;
    const isSeller = session.user_role === 'seller';
    const userShipped = isSeller ? session.seller_tracking_no : session.buyer_tracking_no;

    if (userShipped) {
      return ''; // User already shipped
    }

    // Get user's selected cargo company from planning phase
    const userCargoCompany = isSeller ? session.seller_cargo_company : session.buyer_cargo_company;

    return `
      <div class="mt-4 p-3 bg-light rounded">
        <h5><i class="fas fa-shipping-fast me-2"></i>Kargo Gönderimi</h5>
        <p>Ürününüzü kargo ile gönderdikten sonra takip numarasını girin:</p>

        <form id="shippingForm" class="row align-items-end">
          <div class="col-md-4">
            <label for="trackingNo">Takip Numarası</label>
            <input type="text" class="form-control" id="trackingNo" name="tracking_no"
                   placeholder="Kargo takip numarası" required>
          </div>
          <div class="col-md-4">
            <label for="finalCargoCompany">Kargo Firması</label>
            <select class="form-control" id="finalCargoCompany" name="cargo_company" required>
              <option value="">Seçin</option>
              <option value="aras" ${userCargoCompany === 'aras' ? 'selected' : ''}>Aras Kargo</option>
              <option value="mng" ${userCargoCompany === 'mng' ? 'selected' : ''}>MNG Kargo</option>
              <option value="yurtici" ${userCargoCompany === 'yurtici' ? 'selected' : ''}>Yurtiçi Kargo</option>
              <option value="ptt" ${userCargoCompany === 'ptt' ? 'selected' : ''}>PTT Kargo</option>
              <option value="ups" ${userCargoCompany === 'ups' ? 'selected' : ''}>UPS</option>
              <option value="fedex" ${userCargoCompany === 'fedex' ? 'selected' : ''}>FedEx</option>
              <option value="dhl" ${userCargoCompany === 'dhl' ? 'selected' : ''}>DHL</option>
              <option value="sendeo" ${userCargoCompany === 'sendeo' ? 'selected' : ''}>Sendeo</option>
              <option value="other" ${userCargoCompany === 'other' ? 'selected' : ''}>Diğer</option>
            </select>
            ${userCargoCompany ? `<small class="text-muted">Planlama aşamasında seçtiğiniz: ${getCargoCompanyName(userCargoCompany)}</small>` : ''}
          </div>
          <div class="col-md-4">
            <button type="button" class="btn btn-success" onclick="submitShipping()">
              <i class="fas fa-truck me-1"></i>Gönderim Bildir
            </button>
          </div>
        </form>
      </div>
    `;
  }

  // Render shipping status
  function renderShippingStatus() {
    const session = currentSession;

    elements.meetingSection.innerHTML = `
      <div class="meeting-form">
        <h3><i class="fas fa-shipping-fast me-2"></i>Kargo Takip</h3>

        <div class="row">
          <div class="col-md-6">
            <div class="card">
              <div class="card-body">
                <h5><i class="fas fa-user-tie me-2"></i>Satıcı Kargos</h5>
                ${session.seller_tracking_no ? `
                  <div class="text-success">
                    <i class="fas fa-check-circle me-1"></i>Gönderildi
                    <br><strong>Takip No:</strong> ${esc(session.seller_tracking_no)}
                    <br><strong>Kargo:</strong> ${esc(session.seller_cargo_company || 'Belirtilmemiş')}
                    <br><small class="text-muted">${new Date(session.seller_shipped_at).toLocaleString('tr-TR')}</small>
                  </div>
                ` : `
                  <div class="text-muted">
                    <i class="fas fa-clock me-1"></i>Henüz gönderilmedi
                  </div>
                `}
              </div>
            </div>
          </div>

          <div class="col-md-6">
            <div class="card">
              <div class="card-body">
                <h5><i class="fas fa-user me-2"></i>Alıcı Kargos</h5>
                ${session.buyer_tracking_no ? `
                  <div class="text-success">
                    <i class="fas fa-check-circle me-1"></i>Gönderildi
                    <br><strong>Takip No:</strong> ${esc(session.buyer_tracking_no)}
                    <br><strong>Kargo:</strong> ${esc(session.buyer_cargo_company || 'Belirtilmemiş')}
                    <br><small class="text-muted">${new Date(session.buyer_shipped_at).toLocaleString('tr-TR')}</small>
                  </div>
                ` : `
                  <div class="text-muted">
                    <i class="fas fa-clock me-1"></i>Henüz gönderilmedi
                  </div>
                `}
              </div>
            </div>
          </div>
        </div>

        ${renderShippingActions()}
      </div>
    `;

    // Add shipping form handler if form exists
    const shippingForm = document.getElementById('shippingForm');
    if (shippingForm) {
      shippingForm.addEventListener('submit', handleShippingSubmit);
    }
  }

  // Handle shipping submit
  async function handleShippingSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const shippingData = {
      tracking_no: formData.get('tracking_no'),
      cargo_company: formData.get('cargo_company')
    };

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Kaydediliyor...';

      const response = await apiRequest(`/api/trade/sessions/${currentSession.id}/ship`, {
        method: 'POST',
        body: JSON.stringify(shippingData)
      });

      if (response.ok) {
        showAlert('success', response.message || 'Kargo gönderimi kaydedildi!');
        await loadSession();
      } else {
        throw new Error(response.error || 'Kaydetme başarısız');
      }
    } catch (error) {
      console.error('Shipping update failed:', error);
      showAlert('danger', 'Kargo bilgisi kaydedilemedi. Lütfen tekrar deneyin.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }

  // Global submit shipping function
  window.submitShipping = async function() {
    const form = document.getElementById('shippingForm');
    const trackingNo = document.getElementById('trackingNo').value;
    const cargoCompany = document.getElementById('finalCargoCompany').value;

    if (!trackingNo || !cargoCompany) {
      showAlert('danger', 'Takip numarası ve kargo firması gerekli!');
      return;
    }

    const shippingData = {
      tracking_no: trackingNo,
      cargo_company: cargoCompany
    };

    const submitBtn = form.querySelector('button');
    const originalText = submitBtn.innerHTML;

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Kaydediliyor...';

      const response = await apiRequest(`/api/trade/sessions/${currentSession.id}/ship`, {
        method: 'POST',
        body: JSON.stringify(shippingData)
      });

      if (response.ok) {
        showAlert('success', response.message || 'Kargo gönderimi kaydedildi!');
        await loadSession();
      } else {
        throw new Error(response.error || 'Kaydetme başarısız');
      }
    } catch (error) {
      console.error('Shipping update failed:', error);
      showAlert('danger', 'Kargo bilgisi kaydedilemedi. Lütfen tekrar deneyin.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  };

  // Confirm trade
  window.confirmTrade = async function() {
    if (!confirm('Takasın gerçekleştiğini onaylıyor musunuz? Bu işlem geri alınamaz.')) return;

    try {
      const response = await apiRequest(`/api/trade/sessions/${currentSession.id}/confirm`, {
        method: 'POST'
      });

      if (response.ok) {
        showAlert('success', response.message || 'Onayınız kaydedildi!');

        if (response.completed) {
          setTimeout(() => {
            location.reload();
          }, 2000);
        } else {
          // Reload session data
          await loadSession();
        }
      } else {
        throw new Error(response.error || 'Onaylama başarısız');
      }
    } catch (error) {
      console.error('Trade confirm failed:', error);
      showAlert('danger', 'Onaylama işlemi başarısız. Lütfen tekrar deneyin.');
    }
  };

  // Helper functions
  function getCargoCompanyName(value) {
    const companies = {
      'aras': 'Aras Kargo',
      'mng': 'MNG Kargo',
      'yurtici': 'Yurtiçi Kargo',
      'ptt': 'PTT Kargo',
      'ups': 'UPS',
      'fedex': 'FedEx',
      'dhl': 'DHL',
      'sendeo': 'Sendeo',
      'other': 'Diğer'
    };
    return companies[value] || value;
  }

  function getStatusText(status) {
    switch (status) {
      case 'coordination': return 'Koordinasyon';
      case 'meeting_arranged': return 'Buluşma Planlandı';
      case 'shipping_arranged': return 'Kargo Ayarlandı';
      case 'seller_shipped': return 'Satıcı Kargoyu Gönderdi';
      case 'buyer_shipped': return 'Alıcı Kargoyu Gönderdi';
      case 'both_shipped': return 'Her İki Kargo Gönderildi';
      case 'completed': return 'Tamamlandı';
      case 'cancelled': return 'İptal Edildi';
      default: return status;
    }
  }

  function showContent() {
    elements.sessionLoading.style.display = 'none';
    elements.sessionError.style.display = 'none';
    elements.sessionContent.style.display = 'block';
  }

  function showError(message) {
    elements.sessionLoading.style.display = 'none';
    elements.sessionContent.style.display = 'none';
    elements.sessionError.style.display = 'block';
    elements.sessionError.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i>${esc(message)}`;
  }

  function showAlert(type, message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.style.position = 'fixed';
    alertDiv.style.top = '20px';
    alertDiv.style.right = '20px';
    alertDiv.style.zIndex = '9999';
    alertDiv.innerHTML = `<i class="fas fa-${type === 'success' ? 'check' : 'exclamation-triangle'} me-2"></i>${esc(message)}`;

    document.body.appendChild(alertDiv);

    setTimeout(() => {
      alertDiv.remove();
    }, 5000);
  }

  // Initialize
  async function init() {
    console.log('Trade session page initializing...');

    // Get current user
    try {
      if (typeof window.currentUser !== 'undefined') {
        currentUser = window.currentUser;
      }
    } catch (e) {
      console.error('User check failed:', e);
    }

    // Load session
    await loadSession();

    // Update page title
    if (currentSession) {
      document.title = `${currentSession.listing_title} - Takas Koordinasyonu`;
    }
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();