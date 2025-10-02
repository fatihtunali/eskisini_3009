# Environment Variables Documentation

This document describes all environment variables required for the application.

## Setup Instructions

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in the actual values for your environment

3. **NEVER commit the `.env` file to version control**

## Required Environment Variables

### Server Configuration
| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | `3000` | Yes |

### Database Configuration
| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `DB_HOST` | Database host | `localhost` | Yes |
| `DB_PORT` | Database port | `3306` | Yes |
| `DB_USER` | Database username | `myuser` | Yes |
| `DB_PASS` | Database password | `mypassword` | Yes |
| `DB_NAME` | Database name | `eskisini_db` | Yes |
| `DB_SSL` | Enable SSL for database | `true/false` | Yes |

### Security & Authentication
| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `JWT_SECRET` | JWT signing secret (min 32 chars) | `your-super-secret-jwt-key-here` | Yes |
| `ADMIN_KEY` | Admin authentication key | `admin-secret-key` | Yes |

### CORS Configuration
| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `CORS_ORIGIN` | Allowed origins (comma-separated) | `https://test.eskisiniveryenisinia.com,http://localhost:3000` | Yes |

### Cookie Settings
| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `COOKIE_SECURE` | Secure cookie flag | `true` (production), `false` (development) | Yes |
| `COOKIE_SAMESITE` | SameSite cookie attribute | `lax`, `strict`, `none` | No |

### Business Logic
| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `FREE_LISTING_QUOTA` | Free listings per user | `5` | Yes |
| `BUMP_DAYS` | Days to bump listings | `0` | Yes |
| `FEATURED_DAYS` | Featured listing duration | `7` | Yes |
| `HIGHLIGHT_DAYS` | Highlight listing duration | `30` | Yes |

### Payment Configuration
| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `PAY_PROVIDER` | Payment provider | `mock`, `stripe`, `paypal` | Yes |
| `ADMIN_EMAILS` | Admin email addresses | `admin@example.com` | Yes |
| `TRADE_EXCLUSIVE` | Enable trade-only mode | `true/false` | Yes |
| `PAYMENT_CURRENCY` | Payment currency code | `TRY`, `USD`, `EUR` | Yes |
| `PAYMENT_CURRENCY_SYMBOL` | Currency symbol | `₺`, `$`, `€` | Yes |

### Cloudinary (Image Hosting)
| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | `your-cloud-name` | Yes |
| `CLOUDINARY_API_KEY` | Cloudinary API key | `123456789012345` | Yes |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | `your-api-secret` | Yes |

### OpenAI (AI Features)
| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `OPENAI_API_KEY` | OpenAI API key | `sk-proj-...` | Yes |
| `OPENAI_MODEL` | OpenAI model to use | `gpt-4o-mini`, `gpt-4` | Yes |

### AI Auto-Approval
| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `AI_AUTO_APPROVE_ENABLED` | Enable AI auto-approval | `true/false` | Yes |
| `AI_AUTO_APPROVE_THRESHOLD` | Approval confidence threshold | `85` | Yes |
| `AI_AUTO_REJECT_THRESHOLD` | Rejection confidence threshold | `20` | Yes |

## Production Domain Configuration

### Your Production Setup
- **Frontend Domain:** `test.eskisiniveryenisinial.com`
- **Backend API Domain:** `api.eskisiniveryenisinial.com`

### Required CORS Configuration
```bash
CORS_ORIGIN=https://test.eskisiniveryenisinial.com,http://localhost:5500,http://127.0.0.1:5500,http://localhost:3000
```

### Frontend API Configuration
The frontend automatically detects the domain and configures API endpoints:
- **Local Development:** `http://localhost:3000`
- **Production:** `https://api.eskisiniveryenisinial.com`

## Security Best Practices

### For Development
- Use separate database and API keys for development
- Never share your `.env` file
- Use weak/test credentials for local development

### For Production
- Use environment variables or secret management services
- Rotate secrets regularly
- Use strong, unique passwords
- Enable SSL/TLS for database connections
- Set `COOKIE_SECURE=true`
- Set `COOKIE_SAMESITE=lax`
- Use HTTPS for all `CORS_ORIGIN` entries

### Secret Management Services
Consider using:
- AWS Secrets Manager
- Azure Key Vault
- Google Secret Manager
- HashiCorp Vault
- Environment variables in your hosting platform

## Getting API Keys

### Cloudinary
1. Sign up at [cloudinary.com](https://cloudinary.com)
2. Get your cloud name, API key, and API secret from the dashboard

### OpenAI
1. Sign up at [platform.openai.com](https://platform.openai.com)
2. Create an API key in the API keys section
3. Set usage limits for cost control

## Troubleshooting

### Database Connection Issues
- Verify database server is running
- Check host, port, username, and password
- Ensure database exists
- Check firewall settings

### API Key Issues
- Verify keys are correct and not expired
- Check API quotas and billing
- Ensure keys have necessary permissions

### CORS Issues
- Add your frontend URL to `CORS_ORIGIN`
- Check protocol (http vs https)
- Verify port numbers