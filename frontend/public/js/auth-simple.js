// Simple Authentication - No complex dependency management
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);

  // Simple API base getter
  function getAPIBase() {
    return window.API_BASE || window.APP?.API_BASE || '';
  }

  // Simple helper functions
  function showMsg(box, text, type = 'error') {
    if (!box) return;
    box.textContent = text;

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

      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
      }
    });
  }

  // Error mapping
  function mapError(code, body) {
    const c = (code || body?.error || body?.message || '').toString();

    const TABLE = {
      eksik_alan: 'Gerekli alanlar eksik.',
      email_kayitli: 'Bu e-posta ile bir hesap zaten var.',
      email_and_password_required: 'E-posta ve şifre gerekli.',
      invalid_credentials: 'E-posta veya şifre hatalı.',
      server_error: 'Sunucu hatası. Lütfen tekrar deneyin.',
      unauthorized: 'Oturum gerekli. Lütfen giriş yapın.',
      telefon_gecersiz: 'Telefon numarası geçersiz.',
      telefon_kayitli: 'Bu telefon numarası başka bir hesapta kayıtlı.'
    };

    return TABLE[c] || c || 'Beklenmeyen bir hata oluştu.';
  }

  // Simple request function
  async function request(path, { method = 'POST', body } = {}) {
    const apiBase = getAPIBase();
    console.log('🔧 Auth: Making request to:', apiBase + path);

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

  // LOGIN FORM
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
        console.log('🔧 Auth: Attempting login...');
        const data = await request('/api/auth/login', { method: 'POST', body: payload });

        // Store JWT token in localStorage
        if (data.token) {
          localStorage.setItem('auth_token', data.token);
          localStorage.setItem('token', data.token);
          console.log('🔧 Auth: Token stored successfully');
        }

        showMsg(msg, 'Giriş başarılı, yönlendiriliyorsunuz…', 'success');

        // Dispatch auth event
        document.dispatchEvent(new CustomEvent('auth:login', { detail: { user: data.user } }));

        // Redirect
        const redirect = new URLSearchParams(location.search).get('redirect') || '/';
        setTimeout(() => {
          location.href = redirect;
        }, 1000);

      } catch (error) {
        console.error('🔧 Auth: Login failed:', error);
        showMsg(msg, mapError(error.message, error.body));
      } finally {
        btn.disabled = false;
      }
    });
  }

  // REGISTER FORM (if exists)
  const registerForm = $('#registerForm');
  if (registerForm) {
    const msg = $('#registerMsg');
    bindToggle('#toggleRegisterPass', '#registerPass');

    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearMsg(msg);

      const btn = registerForm.querySelector('[type="submit"]');
      btn.disabled = true;

      const fd = new FormData(registerForm);
      const payload = {
        email: String(fd.get('email') || '').trim().toLowerCase(),
        password: String(fd.get('password') || ''),
        full_name: String(fd.get('full_name') || '').trim()
      };

      try {
        const data = await request('/api/auth/register', { method: 'POST', body: payload });
        showMsg(msg, 'Kayıt başarılı! Giriş sayfasına yönlendiriliyorsunuz...', 'success');

        setTimeout(() => {
          location.href = '/login.html';
        }, 2000);

      } catch (error) {
        showMsg(msg, mapError(error.message, error.body));
      } finally {
        btn.disabled = false;
      }
    });
  }

  console.log('✅ Simple Auth system loaded');

})();