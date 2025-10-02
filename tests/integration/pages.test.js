/**
 * Integration Tests - All Pages
 * Tests that all HTML pages load correctly with proper status codes
 */

const axios = require('axios');

const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:5500';

// Helper function to check if page loads
async function checkPageLoads(pagePath) {
  const response = await axios.get(`${BASE_URL}${pagePath}`, {
    validateStatus: (status) => status < 500 // Accept any status < 500
  });
  return response;
}

describe('Page Load Tests', () => {
  describe('Public Pages', () => {
    test('Home page (index.html) should load', async () => {
      const response = await checkPageLoads('/');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
    });

    test('About page should load', async () => {
      const response = await checkPageLoads('/about.html');
      expect(response.status).toBe(200);
    });

    test('Contact page should load', async () => {
      const response = await checkPageLoads('/contact.html');
      expect(response.status).toBe(200);
    });

    test('FAQ page should load', async () => {
      const response = await checkPageLoads('/faq.html');
      expect(response.status).toBe(200);
    });

    test('Help page should load', async () => {
      const response = await checkPageLoads('/help.html');
      expect(response.status).toBe(200);
    });

    test('Terms page should load', async () => {
      const response = await checkPageLoads('/terms.html');
      expect(response.status).toBe(200);
    });

    test('Privacy page should load', async () => {
      const response = await checkPageLoads('/privacy.html');
      expect(response.status).toBe(200);
    });

    test('Pricing page should load', async () => {
      const response = await checkPageLoads('/pricing.html');
      expect(response.status).toBe(200);
    });
  });

  describe('Authentication Pages', () => {
    test('Login page should load', async () => {
      const response = await checkPageLoads('/login.html');
      expect(response.status).toBe(200);
    });

    test('Register page should load', async () => {
      const response = await checkPageLoads('/register.html');
      expect(response.status).toBe(200);
    });

    test('Admin login page should load', async () => {
      const response = await checkPageLoads('/admin-login.html');
      expect(response.status).toBe(200);
    });
  });

  describe('Listing & Shopping Pages', () => {
    test('Search page should load', async () => {
      const response = await checkPageLoads('/search.html');
      expect(response.status).toBe(200);
    });

    test('Category page should load', async () => {
      const response = await checkPageLoads('/category.html');
      expect(response.status).toBe(200);
    });

    test('Listing detail page should load', async () => {
      const response = await checkPageLoads('/listing.html');
      expect(response.status).toBe(200);
    });

    test('Seller profile page should load', async () => {
      const response = await checkPageLoads('/seller-profile.html');
      expect(response.status).toBe(200);
    });

    test('Cart page should load', async () => {
      const response = await checkPageLoads('/cart.html');
      expect(response.status).toBe(200);
    });

    test('Checkout page should load', async () => {
      const response = await checkPageLoads('/checkout.html');
      expect(response.status).toBe(200);
    });

    test('Order success page should load', async () => {
      const response = await checkPageLoads('/order-success.html');
      expect(response.status).toBe(200);
    });

    test('Favorites page should load', async () => {
      const response = await checkPageLoads('/favorites.html');
      expect(response.status).toBe(200);
    });
  });

  describe('User Account Pages', () => {
    test('Profile page should load', async () => {
      const response = await checkPageLoads('/profile.html');
      expect(response.status).toBe(200);
    });

    test('Settings page should load', async () => {
      const response = await checkPageLoads('/settings.html');
      expect(response.status).toBe(200);
    });

    test('Messages page should load', async () => {
      const response = await checkPageLoads('/messages.html');
      expect(response.status).toBe(200);
    });

    test('KYC page should load', async () => {
      const response = await checkPageLoads('/kyc.html');
      expect(response.status).toBe(200);
    });
  });

  describe('Seller Pages', () => {
    test('Sell page should load', async () => {
      const response = await checkPageLoads('/sell.html');
      expect(response.status).toBe(200);
    });

    test('Shop setup page should load', async () => {
      const response = await checkPageLoads('/shop-setup.html');
      expect(response.status).toBe(200);
    });

    test('Shop settings page should load', async () => {
      const response = await checkPageLoads('/shop-settings.html');
      expect(response.status).toBe(200);
    });
  });

  describe('Trade Pages', () => {
    test('Trade session page should load', async () => {
      const response = await checkPageLoads('/trade-session.html');
      expect(response.status).toBe(200);
    });

    test('Thread page should load', async () => {
      const response = await checkPageLoads('/thread.html');
      expect(response.status).toBe(200);
    });
  });

  describe('Admin Pages', () => {
    test('Admin panel page should load', async () => {
      const response = await checkPageLoads('/admin.html');
      expect(response.status).toBe(200);
    });
  });
});

describe('Page Content Tests', () => {
  test('Home page should contain expected title', async () => {
    const response = await checkPageLoads('/');
    expect(response.data).toContain('<title>');
  });

  test('Pages should load Bootstrap CSS', async () => {
    const response = await checkPageLoads('/');
    expect(response.data).toContain('bootstrap');
  });

  test('Pages should include dependency-manager.js', async () => {
    const response = await checkPageLoads('/');
    expect(response.data).toContain('dependency-manager.js');
  });
});