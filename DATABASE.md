# Database Reference

**Database Name**: `eskisini_db`
**Character Set**: `utf8mb4`
**Collation**: `utf8mb4_turkish_ci`
**Total Tables**: 59 (including views)

## Connection Details

```javascript
// From .env file
DB_HOST=93.113.96.11
DB_PORT=3306
DB_USER=fatihtunali
DB_PASS=Dlr235672.-Yt
DB_NAME=eskisini_db
DB_SSL=false
```

## Quick Access Commands

### MySQL CLI Connection
```bash
mysql -h 93.113.96.11 -P 3306 -u fatihtunali -p eskisini_db
# Password: Dlr235672.-Yt
```

### Export Database
```bash
# Full database export
mysqldump -h 93.113.96.11 -u fatihtunali -p eskisini_db > backup_$(date +%Y%m%d).sql

# Schema only
mysqldump -h 93.113.96.11 -u fatihtunali -p --no-data eskisini_db > schema_only.sql

# Specific table
mysqldump -h 93.113.96.11 -u fatihtunali -p eskisini_db users > users_backup.sql
```

### Import Database
```bash
mysql -h 93.113.96.11 -u fatihtunali -p eskisini_db < backup.sql
```

## Database Structure Overview

### Core Tables (27 main tables)

#### 1. User Management
- **`users`** - User accounts, authentication, profile info
  - Key fields: `id`, `email`, `username`, `password_hash`, `full_name`, `phone_e164`
  - Status: `active`, `suspended`, `deleted`
  - Roles: `is_admin`, `is_verified`

- **`addresses`** - User shipping/billing addresses
  - Foreign key: `user_id` → `users.id` (CASCADE)
  - Fields: `full_name`, `phone_e164`, `country`, `city`, `district`, `address_line`

- **`user_addresses`** - Alternative address storage (check if duplicate with addresses table)

- **`password_resets`** - Password reset tokens
  - Fields: `user_id`, `token`, `expires_at`

- **`email_verifications`** - Email verification tokens

- **`kyc_verifications`** - KYC (Know Your Customer) verification data
  - Status tracking for identity verification

- **`refresh_tokens`** - JWT refresh tokens for authentication

- **`security_events`** - Security audit log (logins, failed attempts, etc.)

#### 2. Marketplace - Listings
- **`listings`** - Main product listings
  - Key fields: `id`, `seller_id`, `category_id`, `title`, `slug`, `description_md`
  - Pricing: `price_minor` (cents), `currency` (default: TRY)
  - Status: `draft`, `active`, `sold`, `paused`, `deleted`
  - Location: `location_city`, `location_lat`, `location_lng`
  - Premium: `premium_level` (`none`, `bump`, `featured`, `sponsor`)
  - Indexes: Full-text search on `title` and `description_md`

- **`listing_images`** - Product images (stored in Cloudinary)
  - Fields: `listing_id`, `image_url`, `display_order`, `is_primary`

- **`archived_listings`** - Deleted/expired listings archive
  - Same structure as `listings` table

- **`listing_reviews`** - Product reviews by buyers

- **`categories`** - Product categories
  - Hierarchical structure: `parent_id` for subcategories
  - Fields: `name`, `slug`, `icon`, `description`

#### 3. Marketplace - Shopping Cart & Orders
- **`carts`** - User shopping carts
  - One active cart per user

- **`cart_items`** - Items in shopping carts
  - Foreign keys: `cart_id`, `listing_id`
  - Fields: `quantity`, `price_snapshot_minor`

- **`orders`** - Purchase orders
  - Status: `pending`, `paid`, `shipped`, `completed`, `cancelled`, `refunded`
  - Foreign keys: `buyer_id`, `seller_id`

- **`order_items`** - Individual items in orders
  - Snapshot of listing data at purchase time
  - Foreign key: `order_id`, `listing_id`

#### 4. Messaging System
- **`conversations`** - Message threads between users
  - Foreign keys: `participant1_id`, `participant2_id`
  - Fields: `listing_id` (if discussing a listing), `last_message_at`

- **`messages`** - Individual messages
  - Foreign keys: `conversation_id`, `sender_id`
  - Fields: `body`, `attachment_url`, `is_read`
  - Full-text index on `body`

- **`archived_messages`** - Deleted messages archive

- **`messages_archive`** - Another message archive table (check if duplicate)

- **`trade_session_messages`** - Messages specific to trade sessions

#### 5. Trading System
- **`trade_sessions`** - Trade negotiation sessions
  - Foreign keys: `initiator_id`, `receiver_id`, `initiator_listing_id`, `receiver_listing_id`
  - Status: `pending`, `active`, `accepted`, `rejected`, `completed`

- **`trade_offers`** - Trade offers between users
  - Track offer/counter-offer history

#### 6. Favorites
- **`favorites`** - User favorite listings
  - Foreign keys: `user_id`, `listing_id`
  - Unique constraint: `(user_id, listing_id)`

#### 7. Seller Features
- **`seller_profiles`** - Seller shop profiles
  - Fields: `shop_name`, `shop_description`, `logo_url`, `banner_url`
  - Stats: `total_sales`, `rating_avg`, `response_time`

- **`seller_reviews`** - Reviews for sellers

- **`shop_media`** - Shop gallery images

- **`shop_reviews`** - Shop reviews (check if duplicate with seller_reviews)

- **`shop_statistics`** - Shop analytics data

- **`featured_sellers`** - Promoted sellers on homepage

#### 8. Subscription & Billing
- **`subscription_plans`** - Available subscription tiers
  - Fields: `plan_code`, `plan_name`, `price_minor`, `listing_quota_month`
  - Features: `bump_credits_month`, `featured_credits_month`

- **`seller_plans`** - Legacy seller subscription plans

- **`user_subscriptions`** - User active subscriptions
  - Foreign keys: `user_id`, `plan_id`
  - Status: `active`, `canceled`, `expired`
  - Period: `current_period_start`, `current_period_end`

- **`active_subscriptions`** - View of currently active subscriptions

- **`billing_transactions`** - Payment transactions
  - Fields: `amount_minor`, `currency`, `status`, `payment_method`, `gateway_name`
  - Transaction tracking: `transaction_id`, `invoice_number`

- **`payments`** - Payment records

- **`payment_transactions`** - Detailed payment transaction log

- **`invoices`** - Generated invoices

- **`promo_codes`** - Discount promo codes
  - Fields: `code`, `discount_type` (percentage/fixed), `discount_value`
  - Validity: `valid_from`, `valid_until`, `usage_limit`

- **`promo_code_usage`** - Promo code usage tracking

- **`plan_usage_logs`** - Track subscription feature usage (listings posted, bumps used, etc.)

- **`monthly_usage_summary`** - Aggregated monthly usage stats

- **`monthly_revenue`** - Revenue analytics

#### 9. Legal Compliance (KVKK, Tax, Consumer Protection)
- **`user_consents`** - KVKK user consent records
  - Consent types: `marketing`, `analytics`, `data_processing`
  - Status: `given`, `withdrawn`

- **`kvkk_consent_texts`** - KVKK consent text versions
  - Track consent text changes over time

- **`cookie_consents`** - Cookie consent tracking

- **`data_requests`** - GDPR data export/deletion requests
  - Request types: `export`, `delete`, `modify`
  - Status: `pending`, `processing`, `completed`

- **`legal_document_reads`** - Track when users read ToS, Privacy Policy

- **`complaints`** - Consumer complaints
  - Categories: `product_quality`, `delivery`, `seller`, `platform`
  - Status: `open`, `in_progress`, `resolved`, `closed`

- **`complaint_attachments`** - Files attached to complaints

- **`complaint_history`** - Complaint status change log

- **`tax_reports`** - Tax reporting data for sellers
  - Monthly/yearly sales aggregation

- **`audit_logs`** - System audit trail (all actions)

- **`activity_logs`** - User activity log
  - Fields: `user_id`, `action`, `resource_type`, `resource_id`, `ip_address`

#### 10. Notifications
- **`notifications`** - User notifications
  - Types: `order`, `message`, `trade`, `review`, `system`
  - Status: `unread`, `read`, `archived`
  - Delivery: `in_app`, `email`, `sms`

#### 11. Views
- **`v_listings_public`** - Public listing view (joins with categories, seller info)
- **`v_listings_public_main`** - Main public listings view

## Key Relationships

### User → Listings
```
users.id ← listings.seller_id
```

### User → Orders (Buyer & Seller)
```
users.id ← orders.buyer_id
users.id ← orders.seller_id
```

### Listings → Categories
```
categories.id ← listings.category_id
```

### Conversations → Users
```
users.id ← conversations.participant1_id
users.id ← conversations.participant2_id
```

### Orders → Listings
```
listings.id ← order_items.listing_id
```

### Subscriptions
```
users.id ← user_subscriptions.user_id
subscription_plans.id ← user_subscriptions.plan_id
```

## Important Indexes

### Full-Text Search Indexes
- `listings.title, listings.description_md` (index: `fts_listings`)
- `messages.body` (index: `fts_messages`)

### Performance Indexes
- `listings.status, listings.created_at` - Homepage queries
- `listings.category_id, listings.status, listings.price_minor` - Category browsing
- `listings.premium_level, listings.bumped_at` - Featured listings
- `orders.buyer_id, orders.created_at` - User order history
- `messages.conversation_id, messages.created_at` - Message threads
- `notifications.user_id, notifications.is_read` - User notifications

## Common Queries

### Get Active Listings
```sql
SELECT * FROM listings
WHERE status = 'active'
ORDER BY created_at DESC
LIMIT 20;
```

### Get User Orders
```sql
SELECT o.*, oi.*
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
WHERE o.buyer_id = ?
ORDER BY o.created_at DESC;
```

### Get Conversation Messages
```sql
SELECT m.*, u.username, u.avatar_url
FROM messages m
JOIN users u ON m.sender_id = u.id
WHERE m.conversation_id = ?
ORDER BY m.created_at ASC;
```

### Check User Subscription
```sql
SELECT us.*, sp.*
FROM user_subscriptions us
JOIN subscription_plans sp ON us.plan_id = sp.id
WHERE us.user_id = ?
  AND us.status = 'active'
  AND us.current_period_end > NOW();
```

### Full-Text Search Listings
```sql
SELECT *, MATCH(title, description_md) AGAINST(? IN NATURAL LANGUAGE MODE) as relevance
FROM listings
WHERE MATCH(title, description_md) AGAINST(? IN NATURAL LANGUAGE MODE)
  AND status = 'active'
ORDER BY relevance DESC
LIMIT 20;
```

## Data Types & Conventions

### Monetary Values
- Stored in **minor units** (cents): `price_minor` (e.g., 1000 = 10.00 TRY)
- Currency code: `currency` (char(3), default: 'TRY')
- To display: `price_minor / 100.0`

### Timestamps
- `created_at` - Record creation (DEFAULT CURRENT_TIMESTAMP)
- `updated_at` - Last update (ON UPDATE CURRENT_TIMESTAMP)
- All timestamps use `datetime` type

### Turkish Collation
- All text fields use `utf8mb4_turkish_ci` collation
- Proper sorting for Turkish characters (ı, ğ, ü, ş, ö, ç)

### Status Enums
- **Listings**: `draft`, `active`, `sold`, `paused`, `deleted`
- **Orders**: `pending`, `paid`, `shipped`, `completed`, `cancelled`, `refunded`
- **Users**: `active`, `suspended`, `deleted`
- **Trades**: `pending`, `active`, `accepted`, `rejected`, `completed`

### Foreign Key Behaviors
- **CASCADE**: Delete child records when parent deleted (e.g., addresses on user delete)
- **SET NULL**: Set to NULL when parent deleted (e.g., activity_logs.user_id)
- **RESTRICT**: Prevent deletion if children exist (e.g., categories with listings)

## Schema Files

- **Full Schema**: [database/eskisini_db_schema.md](database/eskisini_db_schema.md)
- **Schema Text**: [database_schema.txt](database_schema.txt)
- **Migrations**: [database/add_ai_moderation.sql](database/add_ai_moderation.sql)
- **Export Script**: [database/export_schema_md.js](database/export_schema_md.js)

## Backup & Restore

### Regular Backups
```bash
# Daily backup (recommended)
mysqldump -h 93.113.96.11 -u fatihtunali -p \
  --single-transaction \
  --routines \
  --triggers \
  eskisini_db | gzip > backup_$(date +%Y%m%d).sql.gz
```

### Restore from Backup
```bash
# Extract and restore
gunzip < backup_20250930.sql.gz | mysql -h 93.113.96.11 -u fatihtunali -p eskisini_db
```

## Performance Tips

1. **Use indexes** - All foreign keys are indexed
2. **Full-text search** - Use MATCH/AGAINST for searching listings
3. **Limit results** - Always use LIMIT in queries
4. **Joins** - Prefer JOINs over subqueries
5. **Caching** - Cache category tree, featured listings
6. **Connection pooling** - Used in [backend/db.js](backend/db.js)

## Migration Notes

When adding new tables or columns:

1. Create migration SQL file in `database/` folder
2. Test on development database first
3. Use `ALTER TABLE` for schema changes
4. Update [DATABASE.md](DATABASE.md) (this file)
5. Run migration: `mysql -h HOST -u USER -p DB_NAME < migration.sql`

## Security Notes

⚠️ **IMPORTANT**:
- Database credentials in `.env` file (NEVER commit to git)
- SSL connection disabled (local network)
- For production, enable `DB_SSL=true`
- Regular backups stored securely
- Audit logs track all sensitive operations

## Quick Reference

| Table | Primary Use | Key Foreign Keys |
|-------|-------------|------------------|
| `users` | User accounts | - |
| `listings` | Products for sale | `seller_id`, `category_id` |
| `orders` | Purchase orders | `buyer_id`, `seller_id` |
| `messages` | User messaging | `sender_id`, `conversation_id` |
| `conversations` | Message threads | `participant1_id`, `participant2_id` |
| `cart_items` | Shopping cart | `cart_id`, `listing_id` |
| `favorites` | Wishlist | `user_id`, `listing_id` |
| `seller_profiles` | Shop info | `user_id` |
| `user_subscriptions` | Paid plans | `user_id`, `plan_id` |
| `notifications` | User alerts | `user_id` |

---

**Last Updated**: 2025-09-30
**Database Version**: Latest schema as of September 2024