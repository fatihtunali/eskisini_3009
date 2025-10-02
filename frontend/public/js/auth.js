// public/js/auth.js
(function () {
  // Dynamic API_BASE getter that works with dependency management system
  function getAPIBase() {
    console.log('🔧 Auth.js getAPIBase() called');
    console.log('🔧 window.APP:', window.APP);
    console.log('🔧 window.APP?.API_BASE:', window.APP?.API_BASE);
    console.log('🔧 window.getCorrectApiBase:', window.getCorrectApiBase);

    // Priority 1: Use the dependency-managed configuration
    if (window.APP && window.APP.API_BASE) {
      console.log('🔧 Using window.APP.API_BASE:', window.APP.API_BASE);
      return window.APP.API_BASE;
    }

    // Priority 2: Use the api-config.js function if available
    if (window.getCorrectApiBase) {
      const apiBase = window.getCorrectApiBase();
      console.log('🔧 Using window.getCorrectApiBase():', apiBase);
      return apiBase;
    }

    // Priority 3: Direct hostname-based fallback (should not be needed)
    const hostname = window.location.hostname;
    let fallback;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      fallback = 'http://localhost:3000';
    } else {
      fallback = 'https://api.eskisiniveryenisinial.com';
    }
    console.log('🔧 Using fallback API_BASE:', fallback);
    return fallback;
  }
  const $ = (s, r = document) => r.querySelector(s);

  // ---------------- yardımcılar ----------------
  function showMsg(box, text, type = 'error') {
    if (!box) return;
    box.textContent = text;

    // Bootstrap alert classes
    if (type === 'success') {
      box.className = 'alert alert-success';
    } else {
      box.className = 'alert alert-danger';
    }

    box.classList.remove('d-none');
    box.hidden = false;
  }
  function clearMsg(box) {
    if (box) {
      box.classList.add('d-none');
      box.hidden = true;
      box.textContent = '';
    }
  }
  function bindToggle(btnId, inputId) {
    const btn = $(btnId), inp = $(inputId);
    if (!btn || !inp) return;
    btn.addEventListener('click', () => {
      const isPassword = inp.type === 'password';
      inp.type = isPassword ? 'text' : 'password';

      // Update icon
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
      }
    });
  }
  // Backend hata kodlarını kullanıcı dostu mesaja çevir
  function mapError(code, body) {
    // body.error veya body.message gelebilir
    const c = (code || body?.error || body?.message || '').toString();

    const TABLE = {
      // /auth/register
      eksik_alan: 'Gerekli alanlar eksik.',
      email_kayitli: 'Bu e-posta ile bir hesap zaten var.',
      kullanici_adi_kisa: 'Kullanıcı adı en az 3 karakter olmalı.',
      kullanici_adi_kayitli: 'Bu kullanıcı adı alınmış.',
      telefon_gecersiz: 'Telefon numarası geçersiz. Lütfen E.164 biçiminde girin (ör. +905xx...).',
      telefon_kayitli: 'Bu telefon başka bir hesapta kayıtlı.',
      tc_gecersiz: 'TC kimlik numarası 11 haneli olmalı.',
      tc_kayitli: 'Bu TC başka bir hesapta kayıtlı.',
      sunucu_hatasi: 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.',

      // /auth/login
      email_and_password_required: 'E-posta ve şifre gerekli.',
      invalid_credentials: 'E-posta veya şifre hatalı.',
      server_error: 'Sunucu hatası. Lütfen tekrar deneyin.',

      // generic
      unauthorized: 'Oturum gerekli. Lütfen giriş yapın.',
      forbidden: 'Bu işlem için yetkiniz yok.'
    };

    if (TABLE[c]) return TABLE[c];

    // HTTP durumuna göre fallback
    if (/^HTTP\s+401/.test(c)) return 'Oturum gerekli. Lütfen giriş yapın.';
    if (/^HTTP\s+403/.test(c)) return 'Bu işlem için yetkiniz yok.';
    if (/^HTTP\s+404/.test(c)) return 'Kayıt bulunamadı.';
    if (/^HTTP\s+409/.test(c)) return 'Çakışma: Zaten mevcut olabilir.';
    if (/^HTTP\s+4/.test(c)) return 'Geçersiz istek.';
    if (/^HTTP\s+5/.test(c)) return 'Sunucu hatası. Lütfen tekrar deneyin.';

    return c || 'Beklenmeyen bir hata oluştu.';
  }

  async function request(path, { method = 'POST', body } = {}) {
    // Get JWT token from localStorage
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token');

    const headers = {
      'Accept': 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    };

    // Add Authorization header if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const apiBase = getAPIBase();
    console.log('🔧 Auth.js: Using API_BASE:', apiBase, 'for path:', path);

    const res = await fetch(`${apiBase}${path}`, {
      method,
      credentials: 'include',
      headers,
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok || data?.ok === false) {
      const err = new Error(data?.error ? String(data.error) : `HTTP ${res.status}`);
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data;
  }

  // ---------------- LOGIN ----------------
  const loginForm = $('#loginForm');
  if (loginForm) {
    const msg = $('#loginMsg');
    bindToggle('#toggleLoginPass', '#loginPass');

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearMsg(msg);

      const btn = loginForm.querySelector('[type="submit"]');
      btn.disabled = true;

      const fd = new FormData(loginForm);
      const payload = {
        email: String(fd.get('email') || '').trim().toLowerCase(),
        password: String(fd.get('password') || '')
      };

      try {
        const data = await request('/api/auth/login', { method: 'POST', body: payload });

        // Store JWT token in localStorage
        if (data.token) {
          localStorage.setItem('auth_token', data.token);
          localStorage.setItem('token', data.token); // Backward compatibility
        }

        // Başarılı
        showMsg(msg, 'Giriş başarılı, yönlendiriliyorsunuz…', 'success');

        // Auth event dispatch et (header için)
        document.dispatchEvent(new CustomEvent('auth:login', { detail: { user: data.user } }));

        // redirect parametresi varsa oraya dön
        const redirect = new URLSearchParams(location.search).get('redirect') || '/';
        setTimeout(() => {
          location.href = redirect;
        }, 500); // Biraz bekle ki header güncelleme görebilsin
      } catch (err) {
        const text = mapError(err.message, err.body);
        showMsg(msg, text, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }

  // ---------------- REGISTER ----------------
  const regForm = $('#regForm');
  if (regForm) {
    const msg = $('#regMsg');
    bindToggle('#toggleRegPass', '#regPass');

    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearMsg(msg);

      const btn = regForm.querySelector('[type="submit"]');
      btn.disabled = true;

      const fd = new FormData(regForm);
      const pass = String(fd.get('password') || '');
      const pass2 = String(fd.get('password2') || '');
      const accepted = document.querySelector('#terms')?.checked;

      if (pass.length < 6) { showMsg(msg, 'Şifre en az 6 karakter olmalı'); btn.disabled = false; return; }
      if (pass !== pass2) { showMsg(msg, 'Şifreler eşleşmiyor'); btn.disabled = false; return; }
      if (!accepted) { showMsg(msg, 'Şartları kabul etmelisiniz'); btn.disabled = false; return; }

      const payload = {
        full_name: String(fd.get('full_name') || '').trim(),
        username: String(fd.get('username') || '').trim(),
        email: String(fd.get('email') || '').trim().toLowerCase(),
        phone_e164: String(fd.get('phone_e164') || '').trim(),
        password: pass,
        tc_no: String(fd.get('tc_no') || '').trim()
      };

      try {
        const data = await request('/api/auth/register', { method: 'POST', body: payload });

        // Başarılı (cookie sete edildi; token döndü)
        showMsg(msg, 'Kayıt başarılı! Oturum açıldı, yönlendiriliyorsunuz…', 'success');
        const redirect = new URLSearchParams(location.search).get('redirect') || '/';
        location.href = redirect;
      } catch (err) {
        const text = mapError(err.message, err.body);
        showMsg(msg, text, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }
})();
