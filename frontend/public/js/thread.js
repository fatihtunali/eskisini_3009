// public/js/thread.js
(function () {
  const API_BASE = window.getCorrectApiBase ? window.getCorrectApiBase() : (window.APP && window.APP.API_BASE) || '';
  const $ = (s, r = document) => r.querySelector(s);
  const headersNoStore = { 'Accept': 'application/json', 'Cache-Control': 'no-store' };

  // Guard: Prevent multiple initialization and conflicts with messages.js
  if (window.__THREAD_BOOTED__ || window.__MSG_BOOTED__) return;
  window.__THREAD_BOOTED__ = true;

  // Disable messages.js if it tries to load
  window.__MSG_BOOTED__ = true;

  let currentUser = null;
  let currentThreadId = null;
  let pollTimer = null;
  let lastFetchController = null;
  let isAtBottom = true;
  let lastMessageCount = 0;
  let isPollingActive = false;

  function escapeHTML(s) {
    return (s ?? '').toString().replace(/[&<>"']/g, m => (
      m === '&' ? '&amp;' :
      m === '<' ? '&lt;'  :
      m === '>' ? '&gt;'  :
      m === '"' ? '&quot;': '&#39;'
    ));
  }

  function toLogin() {
    const u = new URL('/login.html', location.origin);
    u.searchParams.set('redirect', location.pathname + location.search);
    location.href = u.toString();
  }

  async function whoami() {
    try {
      const r = await fetch(`${API_BASE}/api/auth/me`, {
        credentials: 'include',
        headers: headersNoStore,
        cache: 'no-store'
      });
      if (!r.ok) return null;
      const d = await r.json();
      return d.user || d;
    } catch { return null; }
  }

  async function ensureConversationFromQuery(qs) {
    const listing = Number(qs.get('listing') || 0);
    const seller  = Number(qs.get('seller') || 0);
    const user    = Number(qs.get('user') || 0);

    // Either listing or user parameter should be present
    if (!listing && !user) return null;

    const payload = {};

    if (listing) {
      payload.listing_id = listing;
      if (seller > 0) payload.to_user_id = seller;
    } else if (user) {
      payload.to_user_id = user;
    }

    const r = await fetch(`${API_BASE}/api/messages/start`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...headersNoStore },
      cache: 'no-store',
      body: JSON.stringify(payload)
    });
    if (r.status === 401) { toLogin(); return null; }
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.ok === false) return null;
    return d.conversation_id;
  }

  async function loadThreadDetails() {
    const detailsEl = $('#thread-details');
    const titleEl = $('#thread-title span');
    if (!detailsEl || !currentThreadId) return;

    // Önce threads listesinden thread bilgilerini almaya çalışalım
    try {
      const threadsR = await fetch(`${API_BASE}/api/messages/threads?_ts=${Date.now()}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        },
        cache: 'no-store'
      });

      if (threadsR.status === 401) { toLogin(); return; }

      if (threadsR.ok) {
        const threadsData = await threadsR.json();
        const threads = threadsData.threads || [];
        const currentThread = threads.find(t => t.id == currentThreadId);

        if (currentThread) {
          // Thread bulundu, bilgileri göster
          updateThreadDisplay(currentThread, titleEl, detailsEl);
          return;
        }
      }

      // Thread listesinde bulunamadı, basit görünüm göster
      if (titleEl) {
        titleEl.textContent = 'Konuşma';
      }
      detailsEl.innerHTML = '<div class="muted">Mesaj konuşması</div>';

    } catch (e) {
      console.error('[thread] details error', e);
      detailsEl.innerHTML = '<div class="muted">Detaylar yüklenemedi</div>';
      if (titleEl) {
        titleEl.textContent = 'Konuşma';
      }
    }
  }

  function updateThreadDisplay(thread, titleEl, detailsEl) {
    // Update page title and header
    let titleText = 'Konuşma';
    let detailsHtml = '';

    // Build dynamic title
    if (thread.other_user_name && thread.listing_title) {
      titleText = `${escapeHTML(thread.other_user_name)} ile "${escapeHTML(thread.listing_title)}" hakkında`;
      document.title = `${thread.other_user_name} ile Mesajlaşma | Eskisini Ver Yenisini Al`;
    } else if (thread.other_user_name) {
      titleText = `${escapeHTML(thread.other_user_name)} ile konuşma`;
      document.title = `${thread.other_user_name} ile Mesajlaşma | Eskisini Ver Yenisini Al`;
    } else if (thread.listing_title) {
      titleText = `"${escapeHTML(thread.listing_title)}" hakkında konuşma`;
      document.title = `${thread.listing_title} - Mesajlaşma | Eskisini Ver Yenisini Al`;
    }

    // Update header title
    if (titleEl) {
      titleEl.textContent = titleText;
    }

    // Build details section
    if (thread.other_user_name) {
      detailsHtml += `
        <div class="thread-participant">
          <i class="fas fa-user me-2"></i>
          <span>${escapeHTML(thread.other_user_name)}</span>
        </div>
      `;
    }

    if (thread.listing_title) {
      const listingUrl = thread.listing_slug ?
        `/listing.html?slug=${encodeURIComponent(thread.listing_slug)}` :
        `/listing.html?id=${thread.listing_id}`;

      detailsHtml += `
        <div class="thread-listing">
          <i class="fas fa-tag me-2"></i>
          <a href="${listingUrl}" target="_blank">${escapeHTML(thread.listing_title)}</a>
        </div>
      `;
    }

    if (thread.updated_at) {
      const lastMsgDate = new Date(thread.updated_at).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      detailsHtml += `
        <div class="thread-meta">
          <i class="fas fa-clock me-2"></i>
          <span>Son mesaj: ${lastMsgDate}</span>
        </div>
      `;
    }

    detailsEl.innerHTML = detailsHtml || '<div class="muted">Konuşma detayları</div>';
  }

  function formatMessageTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (messageDate.getTime() === today.getTime()) {
      // Today - show only time
      return date.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } else if (messageDate.getTime() === today.getTime() - 24*60*60*1000) {
      // Yesterday
      return 'Dün ' + date.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      // Older dates
      return date.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }

  function groupMessages(messages) {
    if (!messages || !messages.length) return [];

    const groups = [];
    let currentGroup = null;

    messages.forEach((message, index) => {
      const isMe = currentUser && message.sender_id === currentUser.id;
      const prevMessage = messages[index - 1];
      const prevIsMe = prevMessage && currentUser && prevMessage.sender_id === currentUser.id;

      // Start new group if sender changes or if there's a time gap > 5 minutes
      const shouldStartNewGroup = !prevMessage ||
        (isMe !== prevIsMe) ||
        (new Date(message.created_at) - new Date(prevMessage.created_at) > 5 * 60 * 1000);

      if (shouldStartNewGroup) {
        currentGroup = {
          isMe,
          messages: [message],
          timestamp: message.created_at
        };
        groups.push(currentGroup);
      } else {
        currentGroup.messages.push(message);
      }
    });

    return groups;
  }

  function renderMessageGroups(groups) {
    return groups.map(group => {
      const messagesHtml = group.messages.map((message, index) => {
        const isLast = index === group.messages.length - 1;
        const timeHtml = isLast ?
          `<div class="message-time">${formatMessageTime(message.created_at)}</div>` : '';

        return `
          <div class="message-bubble ${group.isMe ? 'me' : 'other'}">
            ${escapeHTML(message.body || '')}
            ${timeHtml}
          </div>
        `;
      }).join('');

      return `
        <div class="message-group ${group.isMe ? 'me' : 'other'}">
          ${messagesHtml}
        </div>
      `;
    }).join('');
  }

  async function loadMessages(isInitialLoad = false) {
    const msgsEl = $('#msgs');
    if (!msgsEl || !currentThreadId) return;

    // Cancel previous request
    try { lastFetchController?.abort(); } catch {}
    lastFetchController = new AbortController();

    // Show loading state only on initial load
    if (isInitialLoad && !msgsEl.innerHTML.trim()) {
      msgsEl.innerHTML = `
        <div class="messages-loading">
          <i class="fas fa-spinner fa-spin"></i>
          Mesajlar yükleniyor...
        </div>
      `;
    }

    try {
      const r = await fetch(
        `${API_BASE}/api/messages/thread/${encodeURIComponent(currentThreadId)}?_ts=${Date.now()}`,
        {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          },
          cache: 'no-store',
          signal: lastFetchController.signal
        }
      );

      if (r.status === 401) { toLogin(); return; }
      if (!r.ok) throw new Error('HTTP ' + r.status);

      const data = await r.json();
      const messages = data.messages || data.items || [];

      // Only update if message count changed (optimization)
      if (!isInitialLoad && messages.length === lastMessageCount) {
        return;
      }
      lastMessageCount = messages.length;

      if (!messages.length) {
        msgsEl.innerHTML = `
          <div class="messages-empty">
            <i class="fas fa-comment-dots"></i>
            <h3>Henüz mesaj yok</h3>
            <p>İlk mesajınızı göndererek konuşmaya başlayın</p>
          </div>
        `;
        lastMessageCount = 0;
        return;
      }

      // Group messages by sender and time
      const messageGroups = groupMessages(messages);
      msgsEl.innerHTML = renderMessageGroups(messageGroups);

      // Scroll to bottom if user was already at bottom or if this is initial load
      if (isAtBottom || isInitialLoad || !msgsEl.scrollTop) {
        scrollToBottom();
      }

    } catch (e) {
      if (e?.name === 'AbortError') return; // New request was started
      console.error('[thread] load error', e);
      if (isInitialLoad) {
        msgsEl.innerHTML = `
          <div class="messages-error">
            <i class="fas fa-exclamation-triangle"></i>
            <h4>Mesajlar yüklenemedi</h4>
            <p>Lütfen sayfayı yenileyin veya daha sonra tekrar deneyin</p>
          </div>
        `;
      }
    }
  }

  function scrollToBottom() {
    const msgsEl = $('#msgs');
    if (msgsEl) {
      msgsEl.scrollTop = msgsEl.scrollHeight;
      isAtBottom = true;
    }
  }

  function setupScrollDetection() {
    const msgsEl = $('#msgs');
    if (!msgsEl) return;

    msgsEl.addEventListener('scroll', () => {
      const threshold = 50;
      isAtBottom = msgsEl.scrollTop >= msgsEl.scrollHeight - msgsEl.clientHeight - threshold;
    });
  }

  function wireSendForm() {
    const form = $('#send');
    const input = $('#msgBody');
    const submitBtn = form?.querySelector('button[type="submit"]');

    if (!form || !input) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentThreadId) return;

      const body = input.value.trim();
      if (!body) return;

      // Disable form during send
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Gönderiliyor...';
      }
      input.disabled = true;

      try {
        const r = await fetch(`${API_BASE}/api/messages/thread/${encodeURIComponent(currentThreadId)}`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ body })
        });

        if (r.status === 401) { toLogin(); return; }
        if (!r.ok) throw new Error('HTTP ' + r.status);

        // Clear input and reload messages
        input.value = '';
        isAtBottom = true; // Force scroll to bottom after sending
        await loadMessages(false);

      } catch (e) {
        console.error('[thread] send error', e);
        alert('Mesaj gönderilemedi: ' + (e.message || 'Bilinmeyen hata'));
      } finally {
        // Re-enable form
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fas fa-paper-plane me-1"></i>Gönder';
        }
        input.disabled = false;
        input.focus();
      }
    });

    // Auto-resize textarea and handle Enter key
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.dispatchEvent(new Event('submit'));
      }
    });

    // Focus input on page load
    setTimeout(() => input.focus(), 100);
  }

  async function initThread() {
    const msgsEl = $('#msgs');
    if (!msgsEl) return;

    // Get current user
    currentUser = await whoami();
    if (!currentUser) { toLogin(); return; }

    // Get thread ID from URL
    const url = new URL(location.href);
    currentThreadId = url.searchParams.get('id') || url.searchParams.get('thread');

    if (!currentThreadId) {
      // Try to create a new conversation from URL parameters
      const convId = await ensureConversationFromQuery(url.searchParams);
      if (!convId) {
        msgsEl.innerHTML = `
          <div class="messages-error">
            <i class="fas fa-exclamation-triangle"></i>
            <h4>Geçersiz konuşma</h4>
            <p>Konuşma ID'si bulunamadı</p>
          </div>
        `;
        return;
      }

      // Update URL with the new conversation ID
      const newUrl = new URL(location.href);
      newUrl.searchParams.delete('listing');
      newUrl.searchParams.delete('seller');
      newUrl.searchParams.delete('user');
      newUrl.searchParams.set('id', convId);
      history.replaceState(null, '', newUrl.toString());
      currentThreadId = String(convId);
    }

    // Setup components
    setupScrollDetection();
    wireSendForm();

    // Load initial data
    await Promise.all([
      loadThreadDetails(),
      loadMessages(true) // Mark as initial load
    ]);

    // Smart polling system
    function startPolling() {
      if (isPollingActive) return; // Prevent double polling
      isPollingActive = true;
      clearInterval(pollTimer);

      // Only poll if document is visible and focused
      if (!document.hidden) {
        pollTimer = setInterval(() => {
          if (!document.hidden && document.hasFocus()) {
            loadMessages(false);
          }
        }, 8000); // 8 seconds interval to reduce load
      }
    }

    function stopPolling() {
      isPollingActive = false;
      clearInterval(pollTimer);
      pollTimer = null;
    }

    startPolling();

    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopPolling();
      } else {
        // Immediate refresh when page becomes visible, then start polling
        loadMessages(false);
        setTimeout(startPolling, 1000); // Small delay to avoid rapid polling
      }
    });

    // Handle window focus/blur
    window.addEventListener('focus', () => {
      if (!document.hidden) {
        loadMessages(false);
        startPolling();
      }
    });

    window.addEventListener('blur', () => {
      stopPolling();
    });

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      stopPolling();
      try { lastFetchController?.abort(); } catch {}
    }, { once: true });
  }

  // Initialize when DOM is ready
  function boot() {
    initThread();
  }

  if (window.includePartials) {
    document.addEventListener('partials:loaded', boot, { once: true });
  } else {
    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
      boot();
    }
  }
})();