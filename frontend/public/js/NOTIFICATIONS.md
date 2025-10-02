# Real-time Notifications System Documentation

## Overview

The Real-time Notifications System provides comprehensive notification functionality for the marketplace application, featuring WebSocket-based real-time delivery with polling fallback, visual toast notifications, and a complete notification management interface.

**✅ FULLY INTEGRATED** - The system is now integrated across all major user interactions including trade offers, orders, messages, and listing approvals.

## Features Implemented

### 🔔 **Real-time Notification Delivery**
- **WebSocket Connection**: Primary real-time delivery mechanism
- **Polling Fallback**: Automatic fallback for environments without WebSocket support
- **Connection Management**: Automatic reconnection with exponential backoff
- **Token-based Authentication**: Secure WebSocket connections using JWT tokens

### 🎨 **Visual Notification Interface**
- **Notification Bell**: Header-mounted notification bell with unread count badge
- **Dropdown Panel**: Comprehensive notification management panel
- **Toast Notifications**: Non-intrusive popup notifications for real-time alerts
- **Filtering System**: Filter notifications by type (All, Unread, Trade, Message, etc.)

### 📱 **Mobile-Optimized Design**
- **Responsive Layout**: Optimized for all screen sizes
- **Touch-Friendly**: Large tap targets and smooth interactions
- **Adaptive Positioning**: Smart positioning that works across devices
- **Progressive Enhancement**: Works without JavaScript

## Implementation Details

### Core Components

#### 1. **NotificationSystem Class** (`notifications.js`)

Main notification engine with the following key features:

```javascript
// Initialize notification system
const notificationSystem = new NotificationSystem({
  apiBase: '/api',
  pollInterval: 30000,
  maxVisibleToasts: 5,
  soundEnabled: true
});

// The system automatically initializes when user is authenticated
```

#### 2. **Backend Integration** (`backend/services/notifications.js`)

Server-side notification service for creating and managing notifications:

```javascript
const notificationService = require('../services/notifications.js');

// Send a trade offer notification
await notificationService.sendTradeOfferNotification(userId, {
  tradeId: 123,
  senderName: 'John Doe',
  listingTitle: 'iPhone 14 Pro'
});

// Send a custom notification
await notificationService.createNotification({
  userId: 456,
  type: 'system',
  title: 'Welcome!',
  body: 'Welcome to our marketplace',
  data: { welcomeBonus: 100 }
});
```

#### 3. **WebSocket Handler** (`backend/websocket.js`)

Custom WebSocket implementation for real-time communication:

```javascript
// WebSocket endpoint: ws://localhost:3000/ws/notifications?token=JWT_TOKEN
// Handles authentication, connection management, and message delivery
```

### Notification Types

#### **1. Trade Offer Notifications**
- **Type**: `trade_offer`
- **Trigger**: New trade offer received
- **Data**: Trade ID, sender name, listing title
- **Action**: Navigate to trade management page

#### **2. Message Notifications**
- **Type**: `new_message`
- **Trigger**: New private message received
- **Data**: Thread ID, sender info, message preview
- **Action**: Navigate to message thread

#### **3. Order Update Notifications**
- **Type**: `order_update`
- **Trigger**: Order status changes (confirmed, shipped, delivered, cancelled)
- **Data**: Order ID, status, tracking number
- **Action**: Navigate to order details

#### **4. Payment Notifications**
- **Type**: `payment_complete`
- **Trigger**: Payment successfully processed
- **Data**: Payment ID, amount, order reference
- **Action**: Navigate to order history

#### **5. Listing Status Notifications**
- **Type**: `listing_approved` / `listing_rejected`
- **Trigger**: Listing review completed
- **Data**: Listing ID, title, rejection reason (if applicable)
- **Action**: Navigate to listing or edit page

#### **6. Price Alert Notifications**
- **Type**: `price_alert`
- **Trigger**: Item found matching user's price criteria
- **Data**: Alert ID, item details, current price
- **Action**: Navigate to matching listing

#### **7. System Notifications**
- **Type**: `system`
- **Trigger**: System announcements, maintenance notices
- **Data**: Announcement content, priority level
- **Action**: Navigate to relevant page or info

#### **8. Security Notifications**
- **Type**: `security`
- **Trigger**: Security events (login from new device, password change)
- **Data**: Event details, timestamp, IP address
- **Action**: Navigate to security settings

### Connection Management

#### **WebSocket Connection Flow**
1. **Authentication**: Client sends JWT token via query parameter
2. **Handshake**: Server validates token and establishes WebSocket connection
3. **Subscription**: User is subscribed to notification channel
4. **Real-time Delivery**: Notifications sent instantly via WebSocket
5. **Fallback**: Automatic switch to polling if WebSocket fails

#### **Polling Fallback**
- **Interval**: 30 seconds (configurable)
- **Smart Polling**: Only polls when tab is active
- **Rate Limiting**: Respects API rate limits
- **Error Handling**: Exponential backoff on failures

### UI Components

#### **Notification Bell (Header)**
```html
<!-- Automatically injected into header userNav section -->
<a class="nav-link position-relative" href="#" id="notificationBell">
  <i class="fas fa-bell"></i>
  <span class="notification-badge" id="notificationBadge">5</span>
</a>
```

#### **Notification Panel (Dropdown)**
- **Header**: Title and action buttons (mark all read, close)
- **Filters**: Quick filter buttons (All, Unread, by type)
- **List**: Scrollable notification list with individual items
- **Footer**: Link to full notification history page

#### **Toast Notifications**
- **Positioning**: Top-right corner, stack vertically
- **Auto-dismiss**: Configurable timeout (default 5 seconds)
- **Click Actions**: Navigate to relevant page or dismiss
- **Limit**: Maximum visible toasts (default 5)

### Sound System

#### **Notification Sounds**
- **notification**: General notification sound
- **message**: Message-specific sound
- **order**: Order update sound
- **success**: Success/completion sound
- **error**: Error/warning sound
- **alert**: Priority alert sound

#### **Sound Configuration**
```javascript
// Sounds can be enabled/disabled globally
const notificationSystem = new NotificationSystem({
  soundEnabled: true, // Enable/disable all sounds
  soundVolume: 0.6   // Volume level (0.0 to 1.0)
});
```

### Database Schema

#### **notifications Table**
```sql
CREATE TABLE notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  data JSON,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_created (user_id, created_at),
  INDEX idx_user_unread (user_id, read_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### API Endpoints

#### **Get Notifications**
```http
GET /api/notifications
Query Parameters:
  - page: Page number (default: 1)
  - size: Items per page (default: 20, max: 50)
  - unread_only: Boolean (default: false)
  - since: ISO timestamp for incremental updates

Response:
{
  "ok": true,
  "notifications": [...],
  "unread_count": 5,
  "page": 1,
  "size": 20
}
```

#### **Mark as Read**
```http
POST /api/notifications/:id/read
Response: { "ok": true }
```

#### **Mark All as Read**
```http
POST /api/notifications/read-all
Response: { "ok": true }
```

### Configuration Options

#### **Client-side Configuration**
```javascript
const notificationSystem = new NotificationSystem({
  // Connection settings
  apiBase: '/api',
  websocketUrl: 'ws://localhost:3000/ws/notifications',
  pollInterval: 30000,      // 30 seconds
  retryDelay: 5000,         // 5 seconds
  maxRetries: 5,

  // Display settings
  maxVisibleToasts: 5,
  toastDuration: 5000,      // 5 seconds
  soundEnabled: true,

  // Notification type configurations
  types: {
    'trade_offer': {
      icon: 'fas fa-exchange-alt',
      color: '#28a745',
      sound: 'notification'
    }
    // ... other types
  }
});
```

#### **Server-side Configuration**
```javascript
// In notification service
const config = {
  maxNotificationsPerUser: 1000,
  cleanupThresholdDays: 90,
  rateLimitPerUser: 50, // notifications per hour
  enableRealTime: true
};
```

### ✅ **COMPLETE INTEGRATION STATUS**

The notification system is now **fully integrated** across all major user interactions:

#### **✅ Trade System Integration** (`backend/routes/trade.js`)
- **New Trade Offers**: Sellers receive instant notifications when someone makes a trade offer
- **Trade Acceptance**: Offer makers receive notifications when their trade is accepted
- **Trade Rejection**: Offer makers receive notifications when their trade is rejected
- **Real-time Updates**: All trade status changes trigger immediate notifications

#### **✅ Order System Integration** (`backend/routes/orders.js`)
- **New Orders**: Sellers receive notifications when buyers place orders
- **Order Status Updates**: Buyers receive notifications for status changes (processing, shipped, delivered, cancelled)
- **Tracking Information**: Order notifications include tracking numbers when available

#### **✅ Message System Integration** (`backend/routes/messages.js`)
- **New Messages**: Recipients receive instant notifications for new private messages
- **Message Previews**: Notifications include message previews and sender information
- **Conversation Context**: Notifications link directly to the relevant conversation

#### **✅ Listing Management Integration** (`backend/routes/admin.js`)
- **Listing Approvals**: Sellers receive notifications when their listings are approved
- **Listing Rejections**: Sellers receive notifications with rejection reasons when listings are rejected
- **Admin Actions**: All admin-initiated listing actions trigger appropriate user notifications

#### **✅ Frontend Integration**
- **Notification Bell**: Added to header with real-time unread count
- **CSS Integration**: Notification styles integrated into key pages (index.html, search.html)
- **Script Integration**: Notification system loaded on authenticated pages
- **Auto-initialization**: System automatically starts when users are logged in

### Integration Examples

#### **Adding to Existing Pages**
```html
<!-- Add to any authenticated page -->
<link rel="stylesheet" href="/css/notifications.css">
<script src="/js/notifications.js"></script>
```

#### **Sending Notifications from Backend**
```javascript
// In any route handler
const notificationService = require('../services/notifications.js');

// After creating a trade offer
await notificationService.sendTradeOfferNotification(sellerId, {
  tradeId: newOffer.id,
  senderName: offerer.name,
  listingTitle: listing.title
});

// After order status change
await notificationService.sendOrderUpdateNotification(userId, {
  orderId: order.id,
  status: 'shipped',
  trackingNumber: 'TN123456789'
});
```

#### **Custom Notification Types**
```javascript
// Create custom notification
await notificationService.createNotification({
  userId: 123,
  type: 'custom_event',
  title: 'Special Event',
  body: 'You have been invited to a special event',
  data: {
    eventId: 456,
    eventDate: '2024-01-15',
    action_url: '/events/456'
  }
});

// Add custom type configuration on frontend
notificationSystem.options.types.custom_event = {
  icon: 'fas fa-calendar',
  color: '#6f42c1',
  sound: 'notification'
};
```

### Performance Optimizations

#### **Client-side Optimizations**
- **Connection Pooling**: Reuse WebSocket connections
- **Message Batching**: Batch multiple notifications
- **DOM Optimization**: Efficient updates with minimal reflows
- **Memory Management**: Cleanup old notifications automatically

#### **Server-side Optimizations**
- **Database Indexing**: Optimized queries for notification retrieval
- **Connection Management**: Efficient WebSocket connection handling
- **Background Cleanup**: Periodic cleanup of old notifications
- **Rate Limiting**: Prevent notification spam

### Error Handling

#### **Connection Errors**
- **WebSocket Failures**: Automatic fallback to polling
- **Authentication Errors**: Graceful degradation
- **Network Issues**: Retry with exponential backoff
- **Rate Limiting**: Respect API limits and backoff

#### **Display Errors**
- **Toast Overflow**: Limit maximum visible toasts
- **Memory Leaks**: Automatic cleanup of old elements
- **Sound Errors**: Graceful fallback if audio fails
- **Mobile Issues**: Responsive design handles constraints

### Testing and Debugging

#### **Testing Notifications**
```javascript
// Test notification creation
const testNotification = await notificationService.createNotification({
  userId: 1,
  type: 'system',
  title: 'Test Notification',
  body: 'This is a test notification'
});

// Test WebSocket connection
// Open browser console on authenticated page
// Check for WebSocket connection logs
```

#### **Debug Features**
- **Console Logging**: Comprehensive logging for development
- **Connection Status**: Real-time connection status monitoring
- **Error Reporting**: Detailed error information
- **Performance Metrics**: Connection and delivery timing

### Browser Compatibility

- **Modern Browsers**: Full WebSocket and notification support
- **Safari**: Full compatibility with WebSocket
- **Mobile Browsers**: Optimized touch experience
- **Legacy Browsers**: Graceful degradation to polling
- **Offline Support**: Queued notifications when connection restored

### Security Considerations

#### **Authentication**
- **JWT Validation**: All WebSocket connections validated
- **Token Expiry**: Automatic reconnection with fresh tokens
- **Cross-Origin**: Proper CORS handling for WebSocket connections

#### **Data Protection**
- **Input Sanitization**: All notification content sanitized
- **XSS Prevention**: Safe HTML rendering
- **Rate Limiting**: Protection against notification bombing
- **User Privacy**: Notifications only visible to intended recipient

### Maintenance and Monitoring

#### **Regular Tasks**
1. **Database Cleanup**: Remove notifications older than 90 days
2. **Connection Monitoring**: Monitor WebSocket connection health
3. **Performance Analysis**: Analyze notification delivery times
4. **Error Rate Monitoring**: Track failed notification deliveries

#### **Monitoring Metrics**
- WebSocket connection count and stability
- Notification delivery success rate
- Average notification processing time
- User engagement with notifications
- Database growth and cleanup effectiveness

This notification system provides a robust, scalable foundation for real-time user communication while maintaining excellent performance and user experience across all devices and platforms.