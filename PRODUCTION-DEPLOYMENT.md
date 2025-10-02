# Production Deployment Guide

## Domain Configuration
- **Frontend:** `test.eskisiniveryenisinial.com`
- **Backend API:** `api.eskisiniveryenisinial.com`

## Environment Variables for Production

Add these to your server's environment variables section:

```bash
# Server Configuration
PORT=3000
NODE_ENV=production

# Database Configuration
DB_HOST=93.113.96.11
DB_PORT=3306
DB_USER=fatihtunali
DB_PASS=Dlr235672.-Yt
DB_NAME=eskisini_db
DB_SSL=false

# Security & Authentication
JWT_SECRET=Diler-Yalin-Fatih-030113
ADMIN_KEY=Diler-Yalin-Fatih-030113

# CORS Configuration (CRITICAL FOR CROSS-DOMAIN)
CORS_ORIGIN=https://test.eskisiniveryenisinial.com,http://localhost:5500,http://127.0.0.1:5500,http://localhost:3000

# Cookie Settings (PRODUCTION)
COOKIE_SECURE=true
COOKIE_SAMESITE=lax

# Business Logic
FREE_LISTING_QUOTA=5
BUMP_DAYS=0
FEATURED_DAYS=7
HIGHLIGHT_DAYS=30

# Payment Configuration
PAY_PROVIDER=mock
ADMIN_EMAILS=fatihtunali@gmail.com
TRADE_EXCLUSIVE=true
PAYMENT_CURRENCY=TRY
PAYMENT_CURRENCY_SYMBOL=₺

# Cloudinary (Image Hosting)
CLOUDINARY_CLOUD_NAME=dwgua2oxy
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini

# AI Auto-Approval
AI_AUTO_APPROVE_ENABLED=true
AI_AUTO_APPROVE_THRESHOLD=85
AI_AUTO_REJECT_THRESHOLD=20
```

## Deployment Steps

### Backend Server (api.eskisiniveryenisinial.com)

1. **Upload project files** to your backend server
2. **Add environment variables** above to your hosting platform
3. **Use production package.json:**
   ```bash
   cp package-prod.json package.json
   ```
4. **Install production dependencies:**
   ```bash
   npm ci --only=production
   ```
5. **Start the server:**
   ```bash
   npm start
   ```

### Frontend Server (test.eskisiniveryenisinia.com)

1. **Upload frontend files** to your frontend server
2. **No environment variables needed** - frontend uses static files
3. **Serve static files** from `frontend/public/` directory

## Security Checklist

### ✅ Before Going Live
- [ ] All environment variables added to server (no .env file on production)
- [ ] `COOKIE_SECURE=true` set
- [ ] `COOKIE_SAMESITE=lax` set
- [ ] CORS includes your frontend domain
- [ ] Database SSL enabled (if required)
- [ ] Strong passwords for production database
- [ ] API keys are production keys (not development)

### ✅ Post-Deployment Testing
- [ ] Frontend can connect to backend API
- [ ] User registration works
- [ ] User login works
- [ ] Image upload works (Cloudinary)
- [ ] Database operations work
- [ ] CORS headers are correct

## Troubleshooting

### Frontend Can't Connect to API
1. Check CORS configuration in backend environment variables
2. Verify API domain is correct in frontend config.js
3. Check SSL certificates on both domains

### Cookie Issues
1. Ensure `COOKIE_SECURE=true` for HTTPS
2. Set `COOKIE_SAMESITE=lax` for cross-domain cookies
3. Verify both domains use HTTPS

### Database Connection Issues
1. Check database server firewall settings
2. Verify credentials in environment variables
3. Test database connection directly

## Monitoring

### Health Check Endpoints
- **API Health:** `https://api.eskisiniveryenisinial.com/api/health`
- **Frontend:** `https://test.eskisiniveryenisinia.com`

### Log Monitoring
Monitor these for issues:
- Server logs for API errors
- Network logs for CORS issues
- Database connection logs

## Backup & Recovery

### Database Backup
Regular backups of `eskisini_db` database on host `93.113.96.11`

### File Backup
- Backend code and configuration
- Frontend static files
- Environment variables configuration