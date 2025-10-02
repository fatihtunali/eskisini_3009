// Notification Service for backend
const { pool } = require('../db.js');

/**
 * Notification Service
 * Handles creating, sending, and managing notifications
 */
class NotificationService {
  constructor() {
    this.subscribers = new Map(); // WebSocket connections by user ID
  }

  /**
   * Subscribe a WebSocket connection for a user
   */
  subscribe(userId, ws) {
    if (!this.subscribers.has(userId)) {
      this.subscribers.set(userId, new Set());
    }
    this.subscribers.get(userId).add(ws);

    // Clean up on close
    ws.on('close', () => {
      this.unsubscribe(userId, ws);
    });

    console.log(`User ${userId} subscribed to notifications`);
  }

  /**
   * Unsubscribe a WebSocket connection
   */
  unsubscribe(userId, ws) {
    if (this.subscribers.has(userId)) {
      this.subscribers.get(userId).delete(ws);
      if (this.subscribers.get(userId).size === 0) {
        this.subscribers.delete(userId);
      }
    }
  }

  /**
   * Create and send a notification
   */
  async createNotification({
    userId,
    type,
    title,
    body,
    data = null,
    sendRealTime = true
  }) {
    try {
      // Insert notification into database
      const [result] = await pool.query(`
        INSERT INTO notifications (user_id, type, title, body, data, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
      `, [userId, type, title, body, JSON.stringify(data)]);

      const notificationId = result.insertId;

      // Get the complete notification
      const [[notification]] = await pool.query(`
        SELECT id, type, title, body, data, read_at, created_at
        FROM notifications
        WHERE id = ?
      `, [notificationId]);

      if (notification && notification.data) {
        try {
          notification.data = JSON.parse(notification.data);
        } catch (e) {
          notification.data = null;
        }
      }

      // Send real-time notification if enabled
      if (sendRealTime && notification) {
        this.sendRealTimeNotification(userId, notification);
      }

      console.log(`Notification created for user ${userId}: ${title}`);
      return notification;

    } catch (error) {
      console.error('Failed to create notification:', error);
      throw error;
    }
  }

  /**
   * Send real-time notification via WebSocket
   */
  sendRealTimeNotification(userId, notification) {
    const userConnections = this.subscribers.get(userId);
    if (!userConnections || userConnections.size === 0) {
      return; // No active connections for this user
    }

    const message = JSON.stringify({
      type: 'notification',
      data: notification
    });

    // Send to all connections for this user
    userConnections.forEach(ws => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        try {
          ws.send(message);
        } catch (error) {
          console.error('Failed to send real-time notification:', error);
          // Remove broken connection
          this.unsubscribe(userId, ws);
        }
      }
    });
  }

  /**
   * Send notification to multiple users
   */
  async createBulkNotifications(notifications) {
    const results = [];
    for (const notification of notifications) {
      try {
        const result = await this.createNotification(notification);
        results.push(result);
      } catch (error) {
        console.error('Failed to create bulk notification:', error);
        results.push({ error: error.message });
      }
    }
    return results;
  }

  /**
   * Predefined notification types
   */
  async sendTradeOfferNotification(userId, tradeData) {
    return this.createNotification({
      userId,
      type: 'trade_offer',
      title: 'Yeni Takas Teklifi',
      body: `${tradeData.senderName} size bir takas teklifi gönderdi`,
      data: {
        tradeId: tradeData.tradeId,
        senderName: tradeData.senderName,
        listingTitle: tradeData.listingTitle,
        action_url: `/profile.html?tab=trades&tradeId=${tradeData.tradeId}`
      }
    });
  }

  async sendNewMessageNotification(userId, messageData) {
    return this.createNotification({
      userId,
      type: 'new_message',
      title: 'Yeni Mesaj',
      body: `${messageData.senderName}: ${messageData.preview}`,
      data: {
        threadId: messageData.threadId,
        senderId: messageData.senderId,
        senderName: messageData.senderName,
        action_url: `/messages.html?threadId=${messageData.threadId}`
      }
    });
  }

  async sendOrderUpdateNotification(userId, orderData) {
    const statusMessages = {
      'confirmed': 'Siparişiniz onaylandı',
      'shipped': 'Siparişiniz kargoya verildi',
      'delivered': 'Siparişiniz teslim edildi',
      'cancelled': 'Siparişiniz iptal edildi'
    };

    return this.createNotification({
      userId,
      type: 'order_update',
      title: 'Sipariş Güncellendi',
      body: statusMessages[orderData.status] || 'Sipariş durumu güncellendi',
      data: {
        orderId: orderData.orderId,
        status: orderData.status,
        trackingNumber: orderData.trackingNumber,
        action_url: `/profile.html?tab=orders&orderId=${orderData.orderId}`
      }
    });
  }

  async sendPaymentCompleteNotification(userId, paymentData) {
    return this.createNotification({
      userId,
      type: 'payment_complete',
      title: 'Ödeme Tamamlandı',
      body: `${paymentData.amount} TL tutarındaki ödemeniz başarıyla alındı`,
      data: {
        paymentId: paymentData.paymentId,
        amount: paymentData.amount,
        orderId: paymentData.orderId,
        action_url: `/profile.html?tab=orders&orderId=${paymentData.orderId}`
      }
    });
  }

  async sendListingApprovedNotification(userId, listingData) {
    return this.createNotification({
      userId,
      type: 'listing_approved',
      title: 'İlan Onaylandı',
      body: `"${listingData.title}" ilanınız onaylandı ve yayında`,
      data: {
        listingId: listingData.listingId,
        title: listingData.title,
        action_url: `/listing/${listingData.listingId}`
      }
    });
  }

  async sendListingRejectedNotification(userId, listingData) {
    return this.createNotification({
      userId,
      type: 'listing_rejected',
      title: 'İlan Reddedildi',
      body: `"${listingData.title}" ilanınız reddedildi: ${listingData.reason}`,
      data: {
        listingId: listingData.listingId,
        title: listingData.title,
        reason: listingData.reason,
        action_url: `/sell.html?edit=${listingData.listingId}`
      }
    });
  }

  async sendPriceAlertNotification(userId, alertData) {
    return this.createNotification({
      userId,
      type: 'price_alert',
      title: 'Fiyat Uyarısı',
      body: `"${alertData.itemName}" için belirlediğiniz fiyat aralığında ilan bulundu`,
      data: {
        alertId: alertData.alertId,
        itemName: alertData.itemName,
        currentPrice: alertData.currentPrice,
        targetPrice: alertData.targetPrice,
        listingId: alertData.listingId,
        action_url: `/listing/${alertData.listingId}`
      }
    });
  }

  async sendSystemNotification(userId, title, body, data = null) {
    return this.createNotification({
      userId,
      type: 'system',
      title,
      body,
      data
    });
  }

  async sendSecurityNotification(userId, securityData) {
    return this.createNotification({
      userId,
      type: 'security',
      title: 'Güvenlik Uyarısı',
      body: securityData.message,
      data: {
        event: securityData.event,
        timestamp: securityData.timestamp,
        ip: securityData.ip,
        userAgent: securityData.userAgent,
        action_url: '/settings.html?tab=security'
      }
    });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, userId) {
    try {
      await pool.query(`
        UPDATE notifications
        SET read_at = NOW()
        WHERE id = ? AND user_id = ? AND read_at IS NULL
      `, [notificationId, userId]);

      return true;
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      return false;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId) {
    try {
      await pool.query(`
        UPDATE notifications
        SET read_at = NOW()
        WHERE user_id = ? AND read_at IS NULL
      `, [userId]);

      return true;
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      return false;
    }
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId) {
    try {
      const [[{ count }]] = await pool.query(`
        SELECT COUNT(*) as count
        FROM notifications
        WHERE user_id = ? AND read_at IS NULL
      `, [userId]);

      return count;
    } catch (error) {
      console.error('Failed to get unread count:', error);
      return 0;
    }
  }

  /**
   * Clean up old notifications (run this periodically)
   */
  async cleanupOldNotifications(dayThreshold = 90) {
    try {
      const [result] = await pool.query(`
        DELETE FROM notifications
        WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
      `, [dayThreshold]);

      console.log(`Cleaned up ${result.affectedRows} old notifications`);
      return result.affectedRows;
    } catch (error) {
      console.error('Failed to cleanup old notifications:', error);
      return 0;
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(userId) {
    try {
      const [stats] = await pool.query(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN read_at IS NULL THEN 1 ELSE 0 END) as unread,
          COUNT(DISTINCT type) as types,
          MAX(created_at) as latest
        FROM notifications
        WHERE user_id = ?
      `, [userId]);

      return stats[0] || { total: 0, unread: 0, types: 0, latest: null };
    } catch (error) {
      console.error('Failed to get notification stats:', error);
      return { total: 0, unread: 0, types: 0, latest: null };
    }
  }
}

// Create singleton instance
const notificationService = new NotificationService();

module.exports = notificationService;