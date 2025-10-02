// frontend/public/js/cart.js - Shopping Cart Management
(function() {
  'use strict';

  const API_BASE = window.getCorrectApiBase ? window.getCorrectApiBase() : (window.APP && window.APP.API_BASE) || '';

  // Cart state
  let cartState = {
    items: [],
    subtotal_minor: 0,
    currency: 'TRY',
    item_count: 0
  };

  // Simple API request helper
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Load cart from server
  async function loadCart() {
    try {
      const data = await apiRequest('/api/cart');

      if (data.ok && data.cart) {
        cartState = data.cart;
        updateCartBadge();
        return cartState;
      }
    } catch (error) {
      // User not logged in or other error - use empty cart
      console.log('Using empty cart:', error.message);
      cartState = {
        items: [],
        subtotal_minor: 0,
        currency: 'TRY',
        item_count: 0
      };
      updateCartBadge();
      return cartState;
    }
  }

  // Add item to cart
  async function addToCart(listingId, quantity = 1) {
    try {
      const data = await apiRequest('/api/cart/add', {
        method: 'POST',
        body: JSON.stringify({ listing_id: listingId, quantity })
      });

      if (data.ok) {
        await loadCart(); // Reload cart to get updated state
        showToast('Ürün sepete eklendi!');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Add to cart failed:', error);

      // Handle specific errors
      if (error.message.includes('cannot_buy_own_listing')) {
        showToast('Kendi ürününüzü satın alamazsınız', 'error');
      } else if (error.message.includes('401')) {
        showToast('Lütfen giriş yapın', 'error');
        setTimeout(function() {
          const redirect = encodeURIComponent(window.location.href);
          window.location.href = '/login.html?redirect=' + redirect;
        }, 1500);
      } else {
        showToast('Ürün sepete eklenemedi', 'error');
      }
      return false;
    }
  }

  // Update cart item quantity
  async function updateCartItem(itemId, quantity) {
    try {
      if (quantity < 1) {
        return await removeCartItem(itemId);
      }

      const data = await apiRequest(`/api/cart/item/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify({ quantity })
      });

      if (data.ok) {
        await loadCart();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Update failed:', error);
      showToast('Güncelleme başarısız', 'error');
      return false;
    }
  }

  // Remove item from cart
  async function removeCartItem(itemId) {
    try {
      const data = await apiRequest(`/api/cart/item/${itemId}`, {
        method: 'DELETE'
      });

      if (data.ok) {
        await loadCart();
        showToast('Ürün sepetten çıkarıldı');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Remove failed:', error);
      showToast('Ürün çıkarılamadı', 'error');
      return false;
    }
  }

  // Clear entire cart
  async function clearCart() {
    try {
      const data = await apiRequest('/api/cart/clear', {
        method: 'DELETE'
      });

      if (data.ok) {
        await loadCart();
        showToast('Sepet temizlendi');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Clear cart failed:', error);
      showToast('Sepet temizlenemedi', 'error');
      return false;
    }
  }

  // Update cart badge in header
  function updateCartBadge() {
    const badges = document.querySelectorAll('.cart-count, [data-cart-count]');
    badges.forEach(function(badge) {
      badge.textContent = cartState.item_count || 0;
      badge.style.display = cartState.item_count > 0 ? 'inline' : 'none';
    });
  }

  // Show toast notification
  function showToast(message, type) {
    type = type || 'success';

    // Try to use existing notification system
    if (window.showToast) {
      window.showToast(message, type);
      return;
    }

    // Fallback to simple toast
    const toast = document.createElement('div');
    const bgColor = type === 'error' ? '#ef4444' : '#10b981';
    toast.style.cssText = 'position: fixed; top: 80px; right: 20px; background: ' + bgColor + '; color: white; padding: 12px 20px; border-radius: 8px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-weight: 500;';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(function() {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(function() {
        toast.remove();
      }, 300);
    }, 3000);
  }

  // Setup click handlers for "Add to Cart" buttons
  document.addEventListener('click', async function(e) {
    const button = e.target.closest('.btn-add-to-cart, [data-add-to-cart]');
    if (!button) return;

    e.preventDefault();
    e.stopPropagation();

    const listingId = button.dataset.listingId ||
                     (button.closest('[data-listing-id]') || {}).dataset.listingId;
    const quantity = parseInt(button.dataset.quantity || 1);

    if (!listingId) {
      console.error('No listing ID found');
      return;
    }

    // Disable button during request
    const originalHTML = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
      await addToCart(listingId, quantity);
    } finally {
      button.disabled = false;
      button.innerHTML = originalHTML;
    }
  });

  // Public API
  window.Cart = {
    load: loadCart,
    add: addToCart,
    update: updateCartItem,
    remove: removeCartItem,
    clear: clearCart,
    getState: function() {
      return {
        items: cartState.items.slice(),
        subtotal_minor: cartState.subtotal_minor,
        currency: cartState.currency,
        item_count: cartState.item_count
      };
    },
    refresh: loadCart
  };

  console.log('🛒 Cart system loaded');

})();