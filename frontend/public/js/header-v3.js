// public/js/header.js
(function(){
  const API = window.getCorrectApiBase ? window.getCorrectApiBase() : (window.APP && window.APP.API_BASE) || '';
  const noStore = { 'Accept':'application/json', 'Cache-Control':'no-store' };

  // Global guard: dosya iki kez yüklenirse
  if (window.__HDR_BOOTED__) return;
  window.__HDR_BOOTED__ = true;

  // 10 sn kimlik cache
  let meCache = { t: 0, v: null };
  async function whoami(){
    const now = Date.now();
    if (now - meCache.t < 10_000) return meCache.v;
    try{
      // Get JWT token from localStorage
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const headers = { ...noStore };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const r = await fetch(`${API}/api/auth/me`, { credentials:'include', headers, cache:'no-store' });
      if (!r.ok) { meCache = { t: now, v: null }; return null; }
      const d = await r.json();
      meCache = { t: now, v: d.user || d || null };
      return meCache.v;
    }catch{
      meCache = { t: now, v: null };
      return null;
    }
  }

  function wireSearch(){
    const form = document.getElementById('searchForm');
    if (!form) return;
    form.addEventListener('submit', (e)=>{
      e.preventDefault();
      const q = (document.getElementById('q')?.value || '').trim();
      const u = new URL('/index.html', location.origin);
      if (q) u.searchParams.set('q', q);
      location.href = u.toString();
    }, { once:true });
  }

  function show(el){
    if (el) {
      el.hidden = false;
      el.style.display = 'flex';
    }
  }
  function hide(el){
    if (el) {
      el.hidden = true;
      el.style.display = 'none';
    }
  }

  async function bootHeader(){
    // Sayfa içinde ikinci kez çağrılırsa
    if (window.__HDR_INIT_DONE__) return;
    window.__HDR_INIT_DONE__ = true;

    wireSearch();

    const guestNav = document.getElementById('guestNav');
    const userNav  = document.getElementById('userNav');
    const navName  = document.getElementById('navName');
    const navKyc   = document.getElementById('navKyc');
    const btnLogout= document.getElementById('btnLogout');

    const bar = document.querySelector('.topbar');
    const me = await whoami();

    if (!me){
      bar?.classList.remove('auth');
      // misafir
      show(guestNav);
      hide(userNav);

      // Clear user data and dispatch logout event
      window.currentUser = null;
      document.dispatchEvent(new CustomEvent('auth:logout'));
      console.log('🔔 Dispatched auth:logout event');

      return;
    }

    // oturum açık
    bar?.classList.add('auth');
    hide(guestNav);
    show(userNav);

    // Store user data globally for other systems
    window.currentUser = me;

    // Dispatch auth login event for notification system
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('auth:login', {
        detail: { user: me }
      }));
      console.log('🔔 Dispatched auth:login event for user:', me.full_name || me.email);
    }, 100);

    if (navName) navName.textContent = me.full_name || me.email || 'Hesabım';
    if (navKyc){
      const ks = String(me.kyc_status || 'none').toLowerCase();
      navKyc.classList.remove('pending','verified','rejected','none');
      navKyc.classList.add(ks);
      navKyc.title = `KYC: ${ks}`;
    }

    // dropdown toggle
    const toggle = document.getElementById('userToggle');
    const userNavEl = document.getElementById('userNav');
    if (toggle && userNavEl){
      function closeMenu(){
        userNavEl.classList.remove('open');
        toggle.setAttribute('aria-expanded','false');
      }
      function openMenu(){
        userNavEl.classList.add('open');
        toggle.setAttribute('aria-expanded','true');
      }
      toggle.addEventListener('click', (e)=>{
        e.stopPropagation();
        const isOpen = userNavEl.classList.contains('open');
        isOpen ? closeMenu() : openMenu();
      });
      // dışarı tık / ESC kapat
      document.addEventListener('click', (e)=>{
        if (!userNavEl.contains(e.target) && e.target !== toggle) closeMenu();
      });
      document.addEventListener('keydown', (e)=>{
        if (e.key === 'Escape') closeMenu();
      });
    }

    // logout - only add if not already added by inline script
    if (btnLogout && !btnLogout.dataset.logoutInitialized){
      btnLogout.dataset.logoutInitialized = 'true';
      btnLogout.addEventListener('click', async (e)=>{
        e.preventDefault();
        console.log('🔒 Header-v3.js: Logout button clicked');

        try{
          const response = await fetch(`${API}/api/auth/logout`, {
            method:'POST',
            credentials:'include',
            headers:{ 'Accept':'application/json' }
          });
          console.log('🔒 Header-v3.js: Logout API response:', response.status);
        }catch(err){
          console.error('🔒 Header-v3.js: Logout API error:', err);
        }

        // Clear ALL tokens and user data
        localStorage.removeItem('auth_token');
        localStorage.removeItem('token');
        sessionStorage.removeItem('auth_token');
        sessionStorage.removeItem('token');

        // Clear cache
        meCache = { t: 0, v: null };

        // Clear user data
        window.currentUser = null;

        // Dispatch logout event
        document.dispatchEvent(new CustomEvent('auth:logout'));
        console.log('🔔 Header-v3.js: Dispatched auth:logout event');

        // Force clear cookies by setting expired date (backup)
        document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

        // Redirect to homepage
        console.log('🔒 Header-v3.js: Redirecting to homepage');
        window.location.href = '/';
      });
    }
  }

  // Expose bootHeader globally for manual initialization
  window.bootHeader = bootHeader;
  console.log('✅ Header.js: bootHeader exported to window');
  console.log('✅ Header.js: window.bootHeader type:', typeof window.bootHeader);

  // AUTO-INITIALIZE: Call bootHeader after a delay to ensure DOM and header partial are ready
  console.log('🔒 Header.js: Setting up auto-initialization');

  // Try multiple times with increasing delays
  function tryBootHeaderAuto(attempt = 1) {
    const delay = attempt * 300; // 300ms, 600ms, 900ms, 1200ms

    setTimeout(() => {
      // Check if header elements exist (means header partial loaded)
      const guestNav = document.getElementById('guestNav');
      const userNav = document.getElementById('userNav');

      if (guestNav && userNav) {
        console.log(`✅ Header.js: Header elements found on attempt ${attempt}, calling bootHeader`);
        bootHeader();
      } else if (attempt < 4) {
        console.log(`⏳ Header.js: Header elements not found (attempt ${attempt}), retrying...`);
        tryBootHeaderAuto(attempt + 1);
      } else {
        console.error('❌ Header.js: Header elements never appeared after 4 attempts');
      }
    }, delay);
  }

  // Start auto-initialization
  tryBootHeaderAuto();
})();
