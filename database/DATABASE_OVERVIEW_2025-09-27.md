# Database Schema Overview
**Generated:** 2025-09-27T18:05:38
**Database:** eskisini_db
**Purpose:** E-commerce marketplace platform with user authentication, listings, messaging, and shop management

## 📊 Database Summary

Based on the schema export, this database contains **55 tables** covering:
- User management and authentication
- Product listings and categories
- E-commerce functionality (orders, payments, cart)
- Messaging and communication
- Shop/seller management
- Content moderation and security
- Analytics and reporting
- Legal compliance (KVKK, complaints)

## 🔑 Core Tables

### Users & Authentication
- **`users`** - Main user accounts
- **`seller_profiles`** - Extended seller information with business details
- **`kyc_verifications`** - KYC verification records
- **`email_verifications`** - Email verification tokens
- **`password_resets`** - Password reset tokens
- **`refresh_tokens`** - JWT refresh tokens
- **`addresses`** - User shipping addresses

### Listings & Catalog
- **`listings`** - Main product listings
- **`archived_listings`** - Archived/deleted listings
- **`categories`** - Product categories hierarchy
- **`listing_images`** - Product images
- **`listing_reviews`** - Product reviews
- **`favorites`** - User favorite listings

### E-commerce
- **`orders`** - Purchase orders
- **`order_items`** - Individual items in orders
- **`payments`** - Payment records
- **`payment_transactions`** - Payment transaction logs
- **`carts`** - Shopping carts
- **`cart_items`** - Items in shopping carts
- **`invoices`** - Invoice generation

### Communication
- **`conversations`** - Message threads between users
- **`messages`** - Individual messages
- **`messages_archive`** - Archived messages
- **`notifications`** - System notifications

### Shop Management
- **`seller_profiles`** - Seller/shop information and settings
- **`shop_media`** - Shop media files
- **`shop_reviews`** - Shop reviews and ratings
- **`shop_statistics`** - Shop performance metrics
- **`featured_sellers`** - Featured seller promotions

### Trading System
- **`trade_offers`** - Barter/trade proposals
- **`trade_sessions`** - Trade negotiation sessions
- **`trade_session_messages`** - Messages within trade sessions

## 🔗 Key Relationships

### User → Seller Profile
- `users.id` → `seller_profiles.user_id` (1:1)
- Contains business information, logo URLs, verification status

### User → Listings
- `users.id` → `listings.seller_id` (1:many)
- Users can create multiple product listings

### Listings → Images
- `listings.id` → `listing_images.listing_id` (1:many)
- Each listing can have multiple images

### Orders → Items
- `orders.id` → `order_items.order_id` (1:many)
- Each order contains multiple items

### Conversations → Messages
- `conversations.id` → `messages.conversation_id` (1:many)
- Message threading system

## 🎯 Key Features Supported

### 1. Multi-tenant Shop System
- Individual users vs business sellers
- Business name, logo URL, verification status
- Shop statistics and reviews

### 2. Advanced Product Management
- Multiple product images
- Product conditions (new, like_new, good, fair, poor)
- Category hierarchy
- Premium listing features (bump, featured, sponsor)

### 3. Communication System
- Direct messaging between users
- Trade offer negotiations
- System notifications

### 4. E-commerce Features
- Shopping cart functionality
- Order management
- Payment processing
- Invoice generation

### 5. Content Moderation
- Complaint system with attachments
- Content review and moderation
- Security event logging

### 6. Legal Compliance
- KVKK consent management
- Data request handling
- Legal document tracking
- Tax reporting

## 📈 Business Intelligence

### Analytics Tables
- **`activity_logs`** - User activity tracking
- **`monthly_revenue`** - Revenue reporting
- **`monthly_usage_summary`** - Usage metrics
- **`plan_usage_logs`** - Subscription usage

### Security & Audit
- **`audit_logs`** - System audit trail
- **`security_events`** - Security incident tracking
- **`cookie_consents`** - Cookie consent tracking

## 🔄 Recent Changes (Based on Schema)

### Logo URL Migration
- `seller_profiles.logo_url` column now stores shop logos
- Replaces hardcoded logo URLs in backend code
- Enables dynamic shop branding

### Enhanced Seller Profiles
- `business_name` field for shop names
- Separation between personal name and business identity
- Extended verification and rating systems

## 📁 File References

- **Full Schema:** `schema-2025-09-27T18-05-38.sql` (56KB)
- **Database:** eskisini_db on MySQL/MariaDB
- **Charset:** utf8mb4_turkish_ci (Turkish locale support)
- **Engine:** InnoDB (transaction support)

## 🚀 Scaling Considerations

### Current Architecture Strengths
- Proper foreign key relationships
- Indexed columns for performance
- Separation of concerns (users vs sellers vs shops)
- Audit trail and logging
- Full-text search capabilities

### Potential Optimizations
- Consider partitioning for large tables (listings, messages)
- Review index usage for heavy queries
- Archive old data to improve performance
- Consider read replicas for analytics

---
*This overview was generated to understand the current database structure and identify data flow relationships between tables.*