// backend/config.js - Centralized Configuration
require('dotenv/config');

// Port Configuration
const API_PORT = Number(process.env.PORT) || 3000;
const FRONTEND_PORT = Number(process.env.FRONTEND_PORT) || 5500;
const FRONTEND_HOST = process.env.FRONTEND_HOST || '0.0.0.0';

// Determine environment
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isProduction;

// API Base URL - determines where frontend should connect
function getApiBase() {
  const hostname = process.env.API_HOSTNAME;

  if (hostname) {
    return `https://${hostname}`;
  }

  // Development default
  return `http://localhost:${API_PORT}`;
}

// Frontend Base URL - determines CORS origins
function getFrontendBase() {
  const hostname = process.env.FRONTEND_HOSTNAME;

  if (hostname) {
    return `https://${hostname}`;
  }

  // Development default
  return `http://localhost:${FRONTEND_PORT}`;
}

// API Target for frontend proxy
const API_TARGET = process.env.API_TARGET || getApiBase();

// CORS Origins - parse from env or build from config
function getCorsOrigins() {
  if (process.env.CORS_ORIGIN) {
    return process.env.CORS_ORIGIN
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }

  // Default CORS origins for development
  return [
    getFrontendBase(),
    `http://localhost:${FRONTEND_PORT}`,
    `http://127.0.0.1:${FRONTEND_PORT}`,
    `http://localhost:${API_PORT}`,
    `http://127.0.0.1:${API_PORT}`,
  ];
}

// Database Configuration
const DB_CONFIG = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
};

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_KEY = process.env.ADMIN_KEY;

// Cookie Configuration
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';
const COOKIE_SAMESITE = process.env.COOKIE_SAMESITE || 'lax';

// Cloudinary Configuration
const CLOUDINARY_CONFIG = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
};

// OpenAI Configuration
const OPENAI_CONFIG = {
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  autoApproveEnabled: process.env.AI_AUTO_APPROVE_ENABLED === 'true',
  autoApproveThreshold: Number(process.env.AI_AUTO_APPROVE_THRESHOLD) || 85,
  autoRejectThreshold: Number(process.env.AI_AUTO_REJECT_THRESHOLD) || 20,
};

// Business Logic Settings
const BUSINESS_CONFIG = {
  freeListingQuota: Number(process.env.FREE_LISTING_QUOTA) || 5,
  bumpDays: Number(process.env.BUMP_DAYS) || 0,
  featuredDays: Number(process.env.FEATURED_DAYS) || 7,
  highlightDays: Number(process.env.HIGHLIGHT_DAYS) || 30,
  tradeExclusive: process.env.TRADE_EXCLUSIVE === 'true',
  paymentCurrency: process.env.PAYMENT_CURRENCY || 'TRY',
  paymentCurrencySymbol: process.env.PAYMENT_CURRENCY_SYMBOL || '₺',
};

// Export configuration
module.exports = {
  // Environment
  isProduction,
  isDevelopment,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Ports
  API_PORT,
  FRONTEND_PORT,
  FRONTEND_HOST,

  // URLs
  API_BASE: getApiBase(),
  FRONTEND_BASE: getFrontendBase(),
  API_TARGET,

  // CORS
  CORS_ORIGINS: getCorsOrigins(),

  // Database
  DB_CONFIG,

  // Auth
  JWT_SECRET,
  ADMIN_KEY,
  COOKIE_SECURE,
  COOKIE_SAMESITE,

  // External Services
  CLOUDINARY_CONFIG,
  OPENAI_CONFIG,

  // Business Logic
  BUSINESS_CONFIG,

  // Helper functions
  getApiBase,
  getFrontendBase,
  getCorsOrigins,
};
