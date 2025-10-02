// Template for other page scripts
(function () {
  'use strict';

  // Simple API base getter - same for all pages
  function getAPIBase() {
    return window.API_BASE || window.APP?.API_BASE || '';
  }

  // Simple request function - same for all pages
  async function request(path, { method = 'POST', body } = {}) {
    const apiBase = getAPIBase();
    console.log('🔧 Making request to:', apiBase + path);

    const token = localStorage.getItem('auth_token') || localStorage.getItem('token');

    const headers = {
      'Accept': 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    };

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

  // Your page-specific code here...
  console.log('✅ Page script loaded with API_BASE:', getAPIBase());

})();