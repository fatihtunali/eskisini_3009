// API Integration Test: Auth endpoints
// tests/api/auth.test.js

const request = require('supertest');
const express = require('express');

describe('Auth API Endpoints', () => {
  let app;

  beforeAll(() => {
    // Create a minimal Express app for testing
    // In real tests, you'd import your actual server
    app = express();
    app.use(express.json());

    // Mock auth routes for demonstration
    app.post('/api/auth/login', (req, res) => {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ ok: false, error: 'missing_credentials' });
      }

      // Mock successful login
      if (email === 'test@example.com' && password === 'Test123!') {
        return res.status(200).json({
          ok: true,
          user: {
            id: 1,
            email: 'test@example.com',
            full_name: 'Test User'
          }
        });
      }

      // Mock failed login
      return res.status(401).json({ ok: false, error: 'invalid_credentials' });
    });

    app.get('/api/auth/me', (req, res) => {
      const token = req.headers.authorization;

      if (!token) {
        return res.status(401).json({ ok: false, error: 'unauthorized' });
      }

      return res.status(200).json({
        ok: true,
        user: {
          id: 1,
          email: 'test@example.com',
          full_name: 'Test User'
        }
      });
    });
  });

  describe('POST /api/auth/login', () => {
    test('returns 400 when credentials are missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toBe('missing_credentials');
    });

    test('returns 401 with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrong@example.com',
          password: 'wrongpass'
        });

      expect(response.status).toBe(401);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toBe('invalid_credentials');
    });

    test('returns 200 with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test123!'
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('test@example.com');
    });

    test('returns user data on successful login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test123!'
        });

      expect(response.body.user).toMatchObject({
        id: expect.any(Number),
        email: 'test@example.com',
        full_name: 'Test User'
      });
    });
  });

  describe('GET /api/auth/me', () => {
    test('returns 401 without authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.ok).toBe(false);
    });

    test('returns user data with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer fake-token');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.user).toBeDefined();
    });
  });
});