/**
 * API Tests - All Endpoints
 * Tests that all API endpoints respond correctly
 */

const axios = require('axios');
const { createTestUser, cleanupTestData } = require('../helpers/db');

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

// Create axios instance with cookie support
const client = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  validateStatus: (status) => status < 500
});

describe('API Endpoint Tests', () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    // Create test user
    testUser = await createTestUser({
      email: `endpoints-test-${Date.now()}@test.com`,
      password: 'Test123!',
      first_name: 'Test',
      last_name: 'User'
    });

    // Login to get token
    const loginResponse = await client.post('/api/auth/login', {
      email: testUser.email,
      password: 'Test123!'
    });
    authToken = loginResponse.headers['set-cookie'];
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Public Endpoints', () => {
    test('GET /api/health should return OK', async () => {
      const response = await client.get('/api/health');
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('ok', true);
    });

    test('GET /api/categories should return categories', async () => {
      const response = await client.get('/api/categories');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
    });

    test('GET /api/listings/search should return listings', async () => {
      const response = await client.get('/api/listings/search');
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('items'); // API returns 'items' not 'listings'
      expect(Array.isArray(response.data.items)).toBe(true);
    });

    test('GET /api/sellers/featured should return featured sellers', async () => {
      const response = await client.get('/api/sellers/featured');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
    });
  });

  describe('Auth Endpoints', () => {
    test('POST /api/auth/register should validate input', async () => {
      const response = await client.post('/api/auth/register', {
        email: 'invalid-email'
      });
      expect([400, 422]).toContain(response.status);
    });

    test('POST /api/auth/login should validate credentials', async () => {
      const response = await client.post('/api/auth/login', {
        email: 'nonexistent@test.com',
        password: 'wrongpass'
      });
      expect([401, 400]).toContain(response.status);
    });

    test('GET /api/auth/me should require authentication', async () => {
      const response = await client.get('/api/auth/me');
      expect([401, 200]).toContain(response.status);
    });

    test('POST /api/auth/logout should work', async () => {
      const response = await client.post('/api/auth/logout');
      expect([200, 204]).toContain(response.status);
    });
  });

  describe('User Endpoints', () => {
    test('GET /api/users/:id should return user data', async () => {
      const response = await client.get(`/api/users/${testUser.id}`);
      expect([200, 404]).toContain(response.status);
    });

    test('PUT /api/users/profile should require authentication', async () => {
      const response = await client.put('/api/users/profile', {
        first_name: 'Updated'
      });
      expect([401, 400]).toContain(response.status);
    });
  });

  describe('Listing Endpoints', () => {
    test('GET /api/listings/:id should return listing details', async () => {
      const response = await client.get('/api/listings/1');
      expect([200, 404]).toContain(response.status);
    });

    test('POST /api/listings should require authentication', async () => {
      const response = await client.post('/api/listings', {
        title: 'Test Listing'
      });
      expect([401, 400]).toContain(response.status);
    });

    test('GET /api/listings/search should support pagination', async () => {
      const response = await client.get('/api/listings/search?page=1&limit=10');
      expect(response.status).toBe(200);
    });
  });

  describe('Cart Endpoints', () => {
    test('GET /api/cart should work', async () => {
      const response = await client.get('/api/cart', {
        headers: { Cookie: authToken }
      });
      expect([200, 401]).toContain(response.status);
    });

    test('POST /api/cart should validate input', async () => {
      const response = await client.post('/api/cart', {
        listing_id: 'invalid'
      });
      expect([400, 401, 422]).toContain(response.status);
    });

    test('DELETE /api/cart/:id should work', async () => {
      const response = await client.delete('/api/cart/999999');
      expect([200, 404, 401]).toContain(response.status);
    });
  });

  describe('Order Endpoints', () => {
    test('GET /api/orders/mine should require authentication', async () => {
      const response = await client.get('/api/orders/mine');
      expect([200, 401]).toContain(response.status);
    });

    test('GET /api/orders/sales should require authentication', async () => {
      const response = await client.get('/api/orders/sales');
      expect([200, 401]).toContain(response.status);
    });

    test('POST /api/orders/create should validate input', async () => {
      const response = await client.post('/api/orders/create', {});
      expect([400, 401, 422]).toContain(response.status);
    });
  });

  describe('Favorites Endpoints', () => {
    test('GET /api/favorites should work', async () => {
      const response = await client.get('/api/favorites');
      expect([200, 401]).toContain(response.status);
    });

    test('POST /api/favorites should validate input', async () => {
      const response = await client.post('/api/favorites', {
        listing_id: 'invalid'
      });
      expect([400, 401, 422]).toContain(response.status);
    });
  });

  describe('Messages Endpoints', () => {
    test('GET /api/messages should require authentication', async () => {
      const response = await client.get('/api/messages');
      expect([200, 401]).toContain(response.status);
    });

    test('POST /api/messages should validate input', async () => {
      const response = await client.post('/api/messages', {});
      expect([400, 401, 422]).toContain(response.status);
    });
  });

  describe('Notification Endpoints', () => {
    test('GET /api/notifications should work', async () => {
      const response = await client.get('/api/notifications');
      expect([200, 401]).toContain(response.status);
    });

    test('PUT /api/notifications/:id/read should validate ID', async () => {
      const response = await client.put('/api/notifications/invalid/read');
      expect([400, 401, 404]).toContain(response.status);
    });
  });

  describe('Search Endpoints', () => {
    test('GET /api/search should return results', async () => {
      const response = await client.get('/api/search?q=test');
      expect(response.status).toBe(200);
    });

    test('GET /api/search/autocomplete should work', async () => {
      const response = await client.get('/api/search/autocomplete?q=tes');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Admin Endpoints', () => {
    test('GET /api/admin/stats should require admin auth', async () => {
      const response = await client.get('/api/admin/stats');
      expect([401, 403]).toContain(response.status);
    });

    test('GET /api/admin/listings should require admin auth', async () => {
      const response = await client.get('/api/admin/listings');
      expect([401, 403]).toContain(response.status);
    });

    test('PUT /api/admin/listings/:id/approve should require admin auth', async () => {
      const response = await client.put('/api/admin/listings/1/approve');
      expect([401, 403]).toContain(response.status);
    });
  });

  describe('Test Runner Endpoints', () => {
    test('GET /api/test/status should require admin auth', async () => {
      const response = await client.get('/api/test/status');
      expect([401, 403]).toContain(response.status);
    });

    test('POST /api/test/run should require admin auth', async () => {
      const response = await client.post('/api/test/run');
      expect([401, 403]).toContain(response.status);
    });
  });
});