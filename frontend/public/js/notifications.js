// Real-time Notifications System
(function() {
  'use strict';

  // Get correct API base with fallback detection
  function getCorrectApiBase() {
    if (window.APP && window.APP.API_BASE) {
      return window.APP.API_BASE;
    }

    // Fallback detection if APP object not ready yet
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    } else if (hostname === 'test.eskisiniveryenisinial.com') {
      return 'https://api.eskisiniveryenisinial.com';
    } else {
      return window.location.origin;
    }
  }

  /**
   * Real-time notification system with comprehensive features
   * Supports WebSocket, polling fallback, and visual notifications
   */
  class NotificationSystem {
    constructor(options = {}) {
      this.options = {
        // Connection settings
        apiBase: getCorrectApiBase(),
        pollInterval: 30000, // 30 seconds
        retryDelay: 5000,
        maxRetries: 5,

        // Display settings
        maxVisibleToasts: 5,
        toastDuration: 5000,
        soundEnabled: true,

        // Notification types
        types: {
          'trade_offer': { icon: 'fas fa-exchange-alt', color: '#28a745', sound: 'notification' },
          'new_message': { icon: 'fas fa-envelope', color: '#007bff', sound: 'message' },
          'order_update': { icon: 'fas fa-shopping-bag', color: '#ffc107', sound: 'order' },
          'payment_complete': { icon: 'fas fa-credit-card', color: '#28a745', sound: 'success' },
          'listing_approved': { icon: 'fas fa-check-circle', color: '#28a745', sound: 'success' },
          'listing_rejected': { icon: 'fas fa-times-circle', color: '#dc3545', sound: 'error' },
          'price_alert': { icon: 'fas fa-tag', color: '#ff6b35', sound: 'alert' },
          'system': { icon: 'fas fa-info-circle', color: '#6c757d', sound: 'notification' },
          'security': { icon: 'fas fa-shield-alt', color: '#dc3545', sound: 'error' }
        },

        ...options
      };

      this.state = {
        connected: false,
        isPolling: false,
        retryCount: 0,
        lastCheck: null,
        unreadCount: 0,
        notifications: new Map(),
        connection: null,
        destroyed: false,
        pendingTimeouts: []
      };

      this.eventBus = document;
      this.init();
    }

    /**
     * Initialize the notification system
     */
    init() {
      this.createNotificationUI();
      this.loadStoredNotifications();
      this.startConnection();
      this.bindEvents();
      this.checkInitialNotifications();
    }

    /**
     * Create the notification UI elements
     */
    createNotificationUI() {
      // Check if notification bell already exists in HTML
      const existingBell = document.getElementById('notificationBell');
      if (!existingBell) {
        // Notification bell button (add to header)
        this.createNotificationBell();
      } else {
        console.log('🔔 Notification bell already exists in HTML, binding events...');
        this.bindNotificationBell();
      }

      // Notification dropdown panel
      this.createNotificationPanel();

      // Toast container
      this.createToastContainer();

      // Sound elements
      this.createSoundElements();
    }

    /**
     * Create notification bell for header
     */
    createNotificationBell() {
      // Wait for userNav to be available (retry mechanism)
      const tryCreateBell = (attempts = 0) => {
        // Stop if system is destroyed
        if (this.state.destroyed) {
          console.log('🔔 System destroyed, stopping bell creation');
          return;
        }

        const userNav = document.getElementById('userNav');

        console.log('🔔 Attempting to create notification bell', {
          attempt: attempts + 1,
          userNavExists: !!userNav,
          userNavVisible: userNav ? (userNav.style.display !== 'none' && !userNav.hidden) : false,
          userNavDisplayStyle: userNav ? userNav.style.display : null,
          userNavHidden: userNav ? userNav.hidden : null,
          bellExists: !!document.getElementById('notificationBell')
        });

        if (!userNav) {
          if (attempts < 5) {
            console.log('🔔 userNav not found, retrying in 500ms...');
            const timeoutId = setTimeout(() => tryCreateBell(attempts + 1), 500);
            this.state.pendingTimeouts.push(timeoutId);
          } else {
            console.log('🔔 userNav not found after 5 attempts, user likely not logged in');
          }
          return;
        }

        // Check if userNav is actually visible (either not hidden OR display is not none)
        const isUserNavVisible = !userNav.hidden && userNav.style.display !== 'none';
        if (!isUserNavVisible) {
          if (attempts < 5) {
            console.log('🔔 userNav not visible yet, retrying in 500ms...', {
              hidden: userNav.hidden,
              display: userNav.style.display
            });
            const timeoutId = setTimeout(() => tryCreateBell(attempts + 1), 500);
            this.state.pendingTimeouts.push(timeoutId);
          } else {
            console.log('🔔 userNav not visible after 5 attempts, user likely logged out');
          }
          return;
        }

        // Check if bell already exists
        if (document.getElementById('notificationBell')) {
          console.log('🔔 Notification bell already exists');
          return;
        }

        const bellHTML = `
          <a class="nav-link position-relative" href="#" id="notificationBell" title="Bildirimler">
            <i class="fas fa-bell text-info"></i>
            <span class="notification-badge" id="notificationBadge" style="display: none;">0</span>
          </a>
        `;

        // Insert before cart
        const cartLink = userNav.querySelector('a[href="/cart.html"]');
        if (cartLink) {
          cartLink.insertAdjacentHTML('beforebegin', bellHTML);
          console.log('🔔 Notification bell inserted before cart');
        } else {
          userNav.insertAdjacentHTML('afterbegin', bellHTML);
          console.log('🔔 Notification bell inserted at beginning of userNav');
        }

        // Add event listener
        const bell = document.getElementById('notificationBell');
        if (bell) {
          bell.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleNotificationPanel();
          });
          console.log('🔔 Notification bell created successfully!');
        }
      };

      tryCreateBell();
    }

    /**
     * Bind events to existing notification bell
     */
    bindNotificationBell() {
      const bell = document.getElementById('notificationBell');
      if (bell && !bell.dataset.notificationsBound) {
        bell.dataset.notificationsBound = 'true';

        // Remove any existing listeners and add new one
        const existingHandler = bell.onclick;
        bell.onclick = null;

        bell.addEventListener('click', (e) => {
          e.preventDefault();
          console.log('🔔 Notification bell clicked via NotificationSystem');
          this.toggleNotificationPanel();
        });

        console.log('🔔 Notification bell events bound successfully');
      }
    }

    /**
     * Create notification dropdown panel
     */
    createNotificationPanel() {
      if (document.getElementById('notificationPanel')) return;

      const panelHTML = `
        <div id="notificationPanel" class="notification-panel" style="display: none;">
          <div class="notification-header">
            <h6 class="m-0">Bildirimler</h6>
            <div class="notification-actions">
              <button type="button" class="btn btn-sm btn-link p-0" id="markAllRead" title="Tümünü Okundu İşaretle">
                <i class="fas fa-check-double"></i>
              </button>
              <button type="button" class="btn btn-sm btn-link p-0" id="closeNotifications" title="Kapat">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>

          <div class="notification-filters">
            <button type="button" class="filter-btn active" data-filter="all">Tümü</button>
            <button type="button" class="filter-btn" data-filter="unread">Okunmamış</button>
            <button type="button" class="filter-btn" data-filter="trade_offer">Takas</button>
            <button type="button" class="filter-btn" data-filter="new_message">Mesaj</button>
          </div>

          <div class="notification-list" id="notificationList">
            <div class="notification-loading">
              <i class="fas fa-spinner fa-spin"></i> Yükleniyor...
            </div>
          </div>

          <div class="notification-footer">
            <a href="/profile.html?tab=notifications" class="btn btn-sm btn-outline-primary w-100">
              Tüm Bildirimleri Görüntüle
            </a>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', panelHTML);

      // Bind panel events
      this.bindPanelEvents();
    }

    /**
     * Create toast container
     */
    createToastContainer() {
      if (document.getElementById('notificationToasts')) return;

      const toastContainer = document.createElement('div');
      toastContainer.id = 'notificationToasts';
      toastContainer.className = 'notification-toasts';
      document.body.appendChild(toastContainer);
    }

    /**
     * Create sound elements for notifications
     */
    createSoundElements() {
      if (!this.options.soundEnabled) return;

      const sounds = {
        notification: '/assets/sounds/notification.wav',
        message: '/assets/sounds/message.wav',
        order: '/assets/sounds/order.wav',
        success: '/assets/sounds/success.wav',
        error: '/assets/sounds/error.wav',
        alert: '/assets/sounds/alert.wav'
      };

      Object.entries(sounds).forEach(([key, src]) => {
        if (!document.getElementById(`sound-${key}`)) {
          const audio = document.createElement('audio');
          audio.id = `sound-${key}`;
          audio.preload = 'auto';
          audio.volume = 0.6;
          audio.src = src;
          document.body.appendChild(audio);
        }
      });
    }

    /**
     * Start real-time connection (WebSocket with polling fallback)
     */
    startConnection() {
      // Try WebSocket first
      if (window.WebSocket && this.options.websocketUrl) {
        this.connectWebSocket();
      } else {
        // Fallback to polling
        this.startPolling();
      }
    }

    /**
     * Connect via WebSocket
     */
    connectWebSocket() {
      try {
        // Get auth token for WebSocket connection
        const token = this.getAuthToken();
        console.log('🔔 Using token for WebSocket:', token ? token.substring(0, 20) + '...' : 'null');

        // Validate token format (JWT tokens start with eyJ and have 3 parts)
        if (!token || !token.startsWith('eyJ') || token.split('.').length !== 3) {
          console.warn('Invalid or malformed auth token for WebSocket connection');
          this.startPolling();
          return;
        }

        const wsUrl = new URL(this.options.websocketUrl);
        wsUrl.searchParams.set('token', token);

        this.state.connection = new WebSocket(wsUrl.toString());

        this.state.connection.onopen = () => {
          console.log('Notification WebSocket connected');
          this.state.connected = true;
          this.state.retryCount = 0;
          this.emit('connection:open');
        };

        this.state.connection.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'notification' && message.data) {
              this.handleNotification(message.data);
            } else if (message.type === 'connected') {
              console.log('WebSocket connection confirmed:', message.message);
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.state.connection.onclose = () => {
          console.log('Notification WebSocket disconnected');
          this.state.connected = false;
          this.emit('connection:close');
          this.handleReconnection();
        };

        this.state.connection.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.emit('connection:error', error);
        };

      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        this.startPolling();
      }
    }

    /**
     * Start polling for notifications
     */
    startPolling() {
      if (this.state.isPolling) return;

      this.state.isPolling = true;
      console.log('Starting notification polling...');

      const poll = async () => {
        if (!this.state.isPolling) return;

        try {
          await this.fetchNotifications();
          setTimeout(poll, this.options.pollInterval);
        } catch (error) {
          console.error('Polling error:', error);
          setTimeout(poll, this.options.retryDelay);
        }
      };

      poll();
    }

    /**
     * Fetch notifications from API
     */
    async fetchNotifications() {
      try {
        const params = new URLSearchParams({
          page: '1',
          size: '20',
          ...(this.state.lastCheck && { since: this.state.lastCheck })
        });

        const response = await fetch(`${this.options.apiBase}/api/notifications?${params}`, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
          if (response.status === 401) {
            // User not authenticated, stop polling
            this.stopPolling();
            return;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.ok) {
          this.updateNotifications(data.notifications);
          this.updateUnreadCount(data.unread_count);
          this.state.lastCheck = new Date().toISOString();
        }

        this.emit('notifications:fetched', data);

      } catch (error) {
        console.error('Failed to fetch notifications:', error);
        throw error;
      }
    }

    /**
     * Handle reconnection logic
     */
    handleReconnection() {
      if (this.state.retryCount >= this.options.maxRetries) {
        console.log('Max retries reached, switching to polling');
        this.startPolling();
        return;
      }

      this.state.retryCount++;
      const delay = this.options.retryDelay * this.state.retryCount;

      console.log(`Retrying connection in ${delay}ms (attempt ${this.state.retryCount})`);

      setTimeout(() => {
        if (this.options.websocketUrl) {
          this.connectWebSocket();
        } else {
          this.startPolling();
        }
      }, delay);
    }

    /**
     * Handle incoming notification
     */
    handleNotification(notification) {
      // Add to internal state
      this.state.notifications.set(notification.id, notification);

      // Show toast if it's a new notification
      if (!notification.read_at) {
        this.showToast(notification);
        this.playSound(notification.type);
        this.updateUnreadCount(this.state.unreadCount + 1);
      }

      // Update UI
      this.updateNotificationPanel();
      this.emit('notification:received', notification);
    }

    /**
     * Update notifications in state
     */
    updateNotifications(notifications) {
      const newNotifications = [];

      notifications.forEach(notification => {
        if (!this.state.notifications.has(notification.id)) {
          newNotifications.push(notification);
        }
        this.state.notifications.set(notification.id, notification);
      });

      // Show toasts for new unread notifications
      newNotifications.forEach(notification => {
        if (!notification.read_at) {
          this.showToast(notification);
          this.playSound(notification.type);
        }
      });

      this.updateNotificationPanel();
      this.storeNotifications();
    }

    /**
     * Update unread count
     */
    updateUnreadCount(count) {
      this.state.unreadCount = count;

      const badge = document.getElementById('notificationBadge');
      if (badge) {
        if (count > 0) {
          badge.textContent = count > 99 ? '99+' : count;
          badge.style.display = 'block';
        } else {
          badge.style.display = 'none';
        }
      }

      // Update page title
      this.updatePageTitle(count);
    }

    /**
     * Update page title with notification count
     */
    updatePageTitle(count) {
      const title = document.title;
      const baseTitle = title.replace(/^\(\d+\)\s*/, '');

      if (count > 0) {
        document.title = `(${count}) ${baseTitle}`;
      } else {
        document.title = baseTitle;
      }
    }

    /**
     * Show toast notification
     */
    showToast(notification) {
      const container = document.getElementById('notificationToasts');
      if (!container) return;

      // Limit visible toasts
      const existingToasts = container.querySelectorAll('.notification-toast');
      if (existingToasts.length >= this.options.maxVisibleToasts) {
        existingToasts[0].remove();
      }

      const typeConfig = this.options.types[notification.type] || this.options.types.system;

      const toast = document.createElement('div');
      toast.className = 'notification-toast';
      toast.setAttribute('data-id', notification.id);

      toast.innerHTML = `
        <div class="toast-icon" style="color: ${typeConfig.color}">
          <i class="${typeConfig.icon}"></i>
        </div>
        <div class="toast-content">
          <div class="toast-title">${this.escapeHtml(notification.title)}</div>
          <div class="toast-body">${this.escapeHtml(notification.body)}</div>
          <div class="toast-time">${this.formatTimeAgo(notification.created_at)}</div>
        </div>
        <button type="button" class="toast-close">
          <i class="fas fa-times"></i>
        </button>
      `;

      // Add click handlers
      toast.querySelector('.toast-close').addEventListener('click', () => {
        this.removeToast(toast);
      });

      toast.addEventListener('click', (e) => {
        if (e.target.closest('.toast-close')) return;
        this.handleNotificationClick(notification);
        this.removeToast(toast);
      });

      container.appendChild(toast);

      // Auto-remove after duration
      setTimeout(() => {
        this.removeToast(toast);
      }, this.options.toastDuration);

      // Animate in
      requestAnimationFrame(() => {
        toast.classList.add('show');
      });
    }

    /**
     * Remove toast with animation
     */
    removeToast(toast) {
      toast.classList.add('removing');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 300);
    }

    /**
     * Play notification sound
     */
    playSound(type) {
      if (!this.options.soundEnabled) return;

      const typeConfig = this.options.types[type] || this.options.types.system;
      const audio = document.getElementById(`sound-${typeConfig.sound}`);

      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(error => {
          console.log('Could not play notification sound:', error);
        });
      }
    }

    /**
     * Toggle notification panel
     */
    toggleNotificationPanel() {
      const panel = document.getElementById('notificationPanel');
      if (!panel) return;

      const isVisible = panel.style.display !== 'none';

      if (isVisible) {
        this.hideNotificationPanel();
      } else {
        this.showNotificationPanel();
      }
    }

    /**
     * Show notification panel
     */
    showNotificationPanel() {
      const panel = document.getElementById('notificationPanel');
      if (!panel) return;

      // Position panel
      const bell = document.getElementById('notificationBell');
      if (bell) {
        const rect = bell.getBoundingClientRect();
        panel.style.top = `${rect.bottom + 10}px`;
        panel.style.right = `${window.innerWidth - rect.right}px`;
      }

      panel.style.display = 'block';
      setTimeout(() => panel.classList.add('show'), 10);

      // Load fresh notifications
      this.fetchNotifications().catch(console.error);

      // Close on outside click
      setTimeout(() => {
        document.addEventListener('click', this.handleOutsideClick.bind(this));
      }, 100);
    }

    /**
     * Hide notification panel
     */
    hideNotificationPanel() {
      const panel = document.getElementById('notificationPanel');
      if (!panel) return;

      panel.classList.remove('show');
      setTimeout(() => {
        panel.style.display = 'none';
      }, 300);

      document.removeEventListener('click', this.handleOutsideClick.bind(this));
    }

    /**
     * Handle outside click to close panel
     */
    handleOutsideClick(event) {
      const panel = document.getElementById('notificationPanel');
      const bell = document.getElementById('notificationBell');

      if (panel && bell &&
          !panel.contains(event.target) &&
          !bell.contains(event.target)) {
        this.hideNotificationPanel();
      }
    }

    /**
     * Update notification panel content
     */
    updateNotificationPanel() {
      const list = document.getElementById('notificationList');
      if (!list) return;

      const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
      const notifications = this.getFilteredNotifications(activeFilter);

      if (notifications.length === 0) {
        list.innerHTML = `
          <div class="notification-empty">
            <i class="fas fa-bell-slash"></i>
            <p>Henüz bildirim yok</p>
          </div>
        `;
        return;
      }

      list.innerHTML = notifications.map(notification => {
        const typeConfig = this.options.types[notification.type] || this.options.types.system;
        const isUnread = !notification.read_at;

        return `
          <div class="notification-item ${isUnread ? 'unread' : ''}" data-id="${notification.id}">
            <div class="notification-icon" style="color: ${typeConfig.color}">
              <i class="${typeConfig.icon}"></i>
            </div>
            <div class="notification-content" data-notification-id="${notification.id}">
              <div class="notification-title">${this.escapeHtml(notification.title)}</div>
              <div class="notification-body">${this.escapeHtml(notification.body)}</div>
              <div class="notification-meta">
                <span class="notification-time">${this.formatTimeAgo(notification.created_at)}</span>
                ${isUnread ? '<span class="notification-unread-dot"></span>' : ''}
              </div>
            </div>
            <div class="notification-actions">
              ${isUnread ? `
                <button class="notification-action-btn" data-action="read" data-notification-id="${notification.id}" title="Okundu işaretle">
                  <i class="fas fa-check"></i>
                </button>
              ` : ''}
              <button class="notification-action-btn delete" data-action="delete" data-notification-id="${notification.id}" title="Sil">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        `;
      }).join('');

      // Bind click events using event delegation
      list.addEventListener('click', (event) => {
        const target = event.target.closest('.notification-content');
        const button = event.target.closest('.notification-action-btn');

        if (button) {
          // Handle action button clicks
          event.stopPropagation();
          const notificationId = parseInt(button.dataset.notificationId);
          const action = button.dataset.action;

          if (action === 'read') {
            this.markAsRead(notificationId);
          } else if (action === 'delete') {
            this.deleteNotification(notificationId);
          }
        } else if (target) {
          // Handle notification content clicks
          const notificationId = parseInt(target.dataset.notificationId);
          const notification = this.state.notifications.get(notificationId);
          if (notification) {
            this.handleNotificationClick(notification);
          }
        }
      });
    }

    /**
     * Get filtered notifications
     */
    getFilteredNotifications(filter) {
      const notifications = Array.from(this.state.notifications.values());

      switch (filter) {
        case 'unread':
          return notifications.filter(n => !n.read_at);
        case 'all':
          return notifications;
        default:
          return notifications.filter(n => n.type === filter);
      }
    }

    /**
     * Handle notification click
     */
    handleNotificationClick(notification) {
      // Mark as read
      this.markAsRead(notification.id);

      // Handle navigation based on type
      if (notification.data && notification.data.action_url) {
        window.location.href = notification.data.action_url;
      } else {
        // Default navigation based on type
        switch (notification.type) {
          case 'trade_offer':
            window.location.href = '/profile.html?tab=trades';
            break;
          case 'new_message':
            window.location.href = '/profile.html?tab=messages';
            break;
          case 'order_update':
            window.location.href = '/profile.html?tab=orders';
            break;
          default:
            window.location.href = '/profile.html?tab=notifications';
        }
      }
    }

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId) {
      try {
        const response = await fetch(`${this.options.apiBase}/api/notifications/${notificationId}/read`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
          const notification = this.state.notifications.get(notificationId);
          if (notification && !notification.read_at) {
            notification.read_at = new Date().toISOString();
            this.updateUnreadCount(this.state.unreadCount - 1);
            this.updateNotificationPanel();
            this.storeNotifications();

            // Emit event for other parts of the app to listen
            this.emit('notification:marked_read', { notificationId });
          }
        }
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }

    /**
     * Mark all notifications as read
     */
    async markAllAsRead() {
      try {
        const response = await fetch(`${this.options.apiBase}/api/notifications/read-all`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
          const now = new Date().toISOString();
          this.state.notifications.forEach(notification => {
            if (!notification.read_at) {
              notification.read_at = now;
            }
          });

          this.updateUnreadCount(0);
          this.updateNotificationPanel();
          this.storeNotifications();
        }
      } catch (error) {
        console.error('Failed to mark all notifications as read:', error);
      }
    }

    /**
     * Delete a notification
     */
    async deleteNotification(notificationId) {
      if (!confirm('Bu bildirimi silmek istediğinizden emin misiniz?')) {
        return;
      }

      try {
        const response = await fetch(`${this.options.apiBase}/api/notifications/${notificationId}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
          const notification = this.state.notifications.get(notificationId);
          if (notification) {
            // Remove from state
            this.state.notifications.delete(notificationId);

            // Update unread count if it was unread
            if (!notification.read_at) {
              this.updateUnreadCount(this.state.unreadCount - 1);
            }

            // Update UI
            this.updateNotificationPanel();
            this.storeNotifications();

            // Emit event for other parts of the app to listen
            this.emit('notification:deleted', { notificationId });

            console.log('Notification deleted successfully');
          }
        } else {
          throw new Error('Failed to delete notification');
        }
      } catch (error) {
        console.error('Failed to delete notification:', error);
        alert('Bildirim silinemedi. Lütfen tekrar deneyin.');
      }
    }

    /**
     * Bind panel events
     */
    bindPanelEvents() {
      // Filter buttons
      document.addEventListener('click', (e) => {
        if (e.target.matches('.filter-btn')) {
          document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
          e.target.classList.add('active');
          this.updateNotificationPanel();
        }
      });

      // Mark all read
      const markAllBtn = document.getElementById('markAllRead');
      if (markAllBtn) {
        markAllBtn.addEventListener('click', () => {
          this.markAllAsRead();
        });
      }

      // Close button
      const closeBtn = document.getElementById('closeNotifications');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          this.hideNotificationPanel();
        });
      }
    }

    /**
     * Check initial notifications
     */
    async checkInitialNotifications() {
      try {
        await this.fetchNotifications();
      } catch (error) {
        console.error('Failed to check initial notifications:', error);
      }
    }

    /**
     * Store notifications in localStorage
     */
    storeNotifications() {
      try {
        const data = {
          notifications: Array.from(this.state.notifications.values()).slice(0, 50), // Keep only latest 50
          unreadCount: this.state.unreadCount,
          lastCheck: this.state.lastCheck
        };
        localStorage.setItem('notifications', JSON.stringify(data));
      } catch (error) {
        console.error('Failed to store notifications:', error);
      }
    }

    /**
     * Load stored notifications
     */
    loadStoredNotifications() {
      try {
        const stored = localStorage.getItem('notifications');
        if (stored) {
          const data = JSON.parse(stored);
          data.notifications.forEach(notification => {
            this.state.notifications.set(notification.id, notification);
          });
          this.updateUnreadCount(data.unreadCount || 0);
          this.state.lastCheck = data.lastCheck;
        }
      } catch (error) {
        console.error('Failed to load stored notifications:', error);
      }
    }

    /**
     * Bind global events
     */
    bindEvents() {
      // Visibility change - pause/resume when tab is hidden/visible
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.pauseConnection();
        } else {
          this.resumeConnection();
        }
      });

      // Auth events
      document.addEventListener('auth:login', () => {
        this.startConnection();
      });

      document.addEventListener('auth:logout', () => {
        this.stopConnection();
        this.clearNotifications();
      });
    }

    /**
     * Pause connection
     */
    pauseConnection() {
      if (this.state.connection && this.state.connection.readyState === WebSocket.OPEN) {
        // Don't close WebSocket, just reduce activity
      }
      this.state.isPolling = false;
    }

    /**
     * Resume connection
     */
    resumeConnection() {
      if (!this.state.connected && !this.state.isPolling) {
        this.startConnection();
      }
      this.checkInitialNotifications();
    }

    /**
     * Stop all connections
     */
    stopConnection() {
      this.state.isPolling = false;

      if (this.state.connection) {
        this.state.connection.close();
        this.state.connection = null;
      }

      this.state.connected = false;
    }

    /**
     * Stop polling
     */
    stopPolling() {
      this.state.isPolling = false;
    }

    /**
     * Clear all notifications
     */
    clearNotifications() {
      this.state.notifications.clear();
      this.updateUnreadCount(0);
      this.updateNotificationPanel();
      localStorage.removeItem('notifications');
    }

    /**
     * Utility: Escape HTML
     */
    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    /**
     * Get authentication token
     */
    getAuthToken() {
      // Try multiple sources for auth token (ws_token is specifically for WebSocket)
      const wsToken = this.getCookieValue('ws_token');
      const tokenCookie = this.getCookieValue('token');
      const authCookie = this.getCookieValue('auth_token');
      const localToken = localStorage.getItem('auth_token');
      const sessionToken = sessionStorage.getItem('auth_token');

      console.log('🔔 Token sources:', {
        wsToken: wsToken ? 'found' : 'not found',
        tokenCookie: tokenCookie ? 'found' : 'not found',
        authCookie: authCookie ? 'found' : 'not found',
        localToken: localToken ? 'found' : 'not found',
        sessionToken: sessionToken ? 'found' : 'not found'
      });

      return wsToken || tokenCookie || authCookie || localToken || sessionToken;
    }

    /**
     * Get cookie value by name
     */
    getCookieValue(name) {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop().split(';').shift();
      return null;
    }

    /**
     * Utility: Format time ago
     */
    formatTimeAgo(dateString) {
      const date = new Date(dateString);
      const now = new Date();
      const diffInSeconds = Math.floor((now - date) / 1000);

      if (diffInSeconds < 60) return 'Az önce';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} dakika önce`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} saat önce`;
      if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} gün önce`;

      return date.toLocaleDateString('tr-TR');
    }

    /**
     * Emit custom event
     */
    emit(eventName, detail = null) {
      this.eventBus.dispatchEvent(new CustomEvent(eventName, { detail }));
    }

    /**
     * Listen to events
     */
    on(eventName, callback) {
      this.eventBus.addEventListener(eventName, callback);
    }

    /**
     * Remove event listener
     */
    off(eventName, callback) {
      this.eventBus.removeEventListener(eventName, callback);
    }

    /**
     * Destroy the notification system
     */
    destroy() {
      console.log('🔔 Destroying notification system');

      // Set destroyed flag to stop any pending operations
      this.state.destroyed = true;

      // Clear all pending timeouts
      if (this.state.pendingTimeouts) {
        this.state.pendingTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.state.pendingTimeouts = [];
      }

      this.stopConnection();

      // Remove UI elements
      const elements = [
        'notificationBell',
        'notificationPanel',
        'notificationToasts'
      ];

      elements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });

      // Clear state
      this.clearNotifications();
    }
  }

  // Auto-initialize when user is logged in
  function initNotifications() {
    // Check if user is authenticated
    const checkAuth = () => {
      // Check for token cookie (primary), then fallback to other sources
      const getCookie = (name) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
      };

      return window.currentUser ||
             getCookie('token') ||
             getCookie('auth_token') ||
             localStorage.getItem('auth_token') ||
             localStorage.getItem('token') ||
             sessionStorage.getItem('auth_token') ||
             sessionStorage.getItem('token') ||
             // Check if user nav is visible (indicates logged in user)
             (document.getElementById('userNav') && !document.getElementById('userNav').classList.contains('d-none')) ||
             // Check Auth API
             (window.Auth && typeof window.Auth.getCurrentUser === 'function' && window.Auth.getCurrentUser());
    };

    console.log('🔔 Notification system initialization check:', {
      authenticated: !!checkAuth(),
      currentUser: !!window.currentUser,
      cookies: {
        token: !!getCookie('token'),
        auth_token: !!getCookie('auth_token')
      },
      localStorage: {
        token: !!localStorage.getItem('token'),
        auth_token: !!localStorage.getItem('auth_token')
      },
      sessionStorage: {
        token: !!sessionStorage.getItem('token'),
        auth_token: !!sessionStorage.getItem('auth_token')
      },
      userNavExists: !!document.getElementById('userNav'),
      userNavVisible: document.getElementById('userNav') && !document.getElementById('userNav').classList.contains('d-none'),
      authAPI: window.Auth && typeof window.Auth.getCurrentUser === 'function' && !!window.Auth.getCurrentUser()
    });

    // Auto-initialize if user is authenticated
    if (checkAuth()) {
      console.log('🔔 User is authenticated, initializing notification system...');
      window.notificationSystem = new NotificationSystem({
        // Configure WebSocket URL based on API base
        websocketUrl: (function() {
          const apiBase = getCorrectApiBase();

          // Get token for WebSocket authentication
          const token = getCookie('token') ||
                       getCookie('auth_token') ||
                       localStorage.getItem('token') ||
                       localStorage.getItem('auth_token') ||
                       sessionStorage.getItem('token') ||
                       sessionStorage.getItem('auth_token');

          let wsUrl;
          if (apiBase.startsWith('https://')) {
            wsUrl = apiBase.replace('https://', 'wss://') + '/ws/notifications';
          } else if (apiBase.startsWith('http://')) {
            wsUrl = apiBase.replace('http://', 'ws://') + '/ws/notifications';
          } else {
            // Fallback to current host
            wsUrl = window.location.protocol === 'https:' ?
              `wss://${window.location.host}/ws/notifications` :
              `ws://${window.location.host}/ws/notifications`;
          }

          // Add token as query parameter if available
          if (token) {
            wsUrl += `?token=${encodeURIComponent(token)}`;
          }

          return wsUrl;
        })()
      });
    } else {
      console.log('🔔 User not authenticated, skipping notification system');
    }

    // Function to manually check and reinitialize
    window.recheckNotifications = function() {
      console.log('🔔 Manual notification recheck triggered...');
      initNotifications();
    };

    // Listen for auth changes
    document.addEventListener('auth:login', (e) => {
      console.log('🔔 Auth login event received:', e.detail);
      if (!window.notificationSystem) {
        initNotifications();
      }
    });

    document.addEventListener('auth:logout', () => {
      console.log('🔔 Auth logout event received');
      if (window.notificationSystem) {
        window.notificationSystem.destroy();
        window.notificationSystem = null;
      }
    });
  }

  // Initialize when DOM is ready with retry mechanism
  let initRetryCount = 0;
  const maxRetries = 3;

  function tryInitNotifications() {
    initNotifications();

    // If notification system didn't initialize and we have retries left, try again
    if (!window.notificationSystem && initRetryCount < maxRetries) {
      initRetryCount++;
      console.log(`🔔 Notification system init failed, retrying (${initRetryCount}/${maxRetries})...`);
      setTimeout(tryInitNotifications, 1000 * initRetryCount);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInitNotifications);
  } else {
    tryInitNotifications();
  }

  // Export for manual initialization
  window.NotificationSystem = NotificationSystem;

  // Add a manual initialization function for testing
  window.forceInitNotifications = function() {
    console.log('🔔 Force initializing notification system...');

    // Make sure userNav is visible
    const userNav = document.getElementById('userNav');
    if (userNav && userNav.style.display === 'none') {
      userNav.style.display = 'flex';
      console.log('🔔 Made userNav visible for testing');
    }

    // Initialize notifications
    if (!window.notificationSystem) {
      window.notificationSystem = new NotificationSystem({
        websocketUrl: (function() {
          const apiBase = getCorrectApiBase();
          if (apiBase.startsWith('https://')) {
            return apiBase.replace('https://', 'wss://') + '/ws/notifications';
          } else if (apiBase.startsWith('http://')) {
            return apiBase.replace('http://', 'ws://') + '/ws/notifications';
          } else {
            // Fallback to current host
            return window.location.protocol === 'https:' ?
              `wss://${window.location.host}/ws/notifications` :
              `ws://${window.location.host}/ws/notifications`;
          }
        })()
      });
      console.log('🔔 Notification system force-initialized!');
    } else {
      console.log('🔔 Notification system already exists');
    }
  };

  // Debug function to manually test notifications
  window.testNotifications = () => {
    console.log('🔔 Testing notification system...');
    console.log('window.APP:', window.APP);
    console.log('API_BASE:', window.APP?.API_BASE);
    console.log('Current user:', window.currentUser);
    console.log('Notification system exists:', !!window.notificationSystem);

    if (window.notificationSystem) {
      console.log('System options:', window.notificationSystem.options);
      console.log('System state:', window.notificationSystem.state);
      console.log('Manually triggering notification fetch...');
      window.notificationSystem.fetchNotifications();
    } else {
      console.log('No notification system found. Attempting to initialize...');
      initNotifications();
    }
  };

  // Test function to manually create different notification types
  window.testNotificationTypes = () => {
    if (!window.notificationSystem) {
      console.log('Notification system not found!');
      return;
    }

    const testNotifications = [
      {
        type: 'trade_offer',
        title: 'Yeni Takas Teklifi',
        body: 'Test User sizinle MacBook Pro takas etmek istiyor',
        data: { action_url: '/trades' }
      },
      {
        type: 'order_update',
        title: 'Sipariş Güncellendi',
        body: 'Siparişiniz kargoya verildi #12345',
        data: { order_id: 12345 }
      },
      {
        type: 'payment_complete',
        title: 'Ödeme Tamamlandı',
        body: '₺1.500 tutarındaki ödemeniz başarıyla alındı',
        data: { amount: 1500 }
      },
      {
        type: 'listing_approved',
        title: 'İlan Onaylandı',
        body: 'MacBook Pro ilanınız onaylandı ve yayınlandı',
        data: { listing_id: 123 }
      },
      {
        type: 'price_alert',
        title: 'Fiyat Uyarısı',
        body: 'İPhone 15 Pro fiyatı ₺45.000\'ye düştü!',
        data: { product: 'iPhone 15 Pro', price: 45000 }
      },
      {
        type: 'system',
        title: 'Sistem Bildirimi',
        body: 'Sistem bakımı 01:00-03:00 saatleri arasında yapılacaktır',
        data: { maintenance: true }
      }
    ];

    console.log('🔔 Testing different notification types...');

    testNotifications.forEach((notification, index) => {
      setTimeout(() => {
        console.log(`Testing ${notification.type}:`, notification);
        window.notificationSystem.handleNotification(notification);
      }, index * 2000); // 2 seconds between each test
    });
  };

  // Helper function to get cookie value
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

})();