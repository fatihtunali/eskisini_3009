// Global test setup for Jest
// This file runs before all tests

// Load environment variables for testing
require('dotenv').config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Global test timeout
jest.setTimeout(10000);

// Mock console methods to reduce noise (optional)
// Uncomment if you want quieter test output
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };

// Global test helpers
global.testHelpers = {
  // Helper to create test user data
  createTestUser: (overrides = {}) => ({
    email: 'test@example.com',
    password: 'Test123!',
    full_name: 'Test User',
    username: 'testuser',
    phone_e164: '+905321234567',
    ...overrides
  }),

  // Helper to create test listing data
  createTestListing: (overrides = {}) => ({
    title: 'Test Product',
    description: 'Test Description',
    price_minor: 10000, // 100.00 TRY
    currency: 'TRY',
    category_id: 1,
    condition: 'new',
    status: 'active',
    ...overrides
  }),

  // Helper to wait for async operations
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

console.log('🧪 Test environment initialized');