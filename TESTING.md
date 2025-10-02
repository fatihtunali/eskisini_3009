# Testing Guide

Complete testing documentation for **Eskisini Ver Yenisini Al** project.

## Table of Contents
- [Overview](#overview)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Coverage](#test-coverage)
- [Continuous Integration](#continuous-integration)
- [Best Practices](#best-practices)

## Overview

This project uses **Jest** as the testing framework with **Supertest** for API integration testing.

### Testing Stack
- **Jest** - Modern JavaScript testing framework
- **Supertest** - HTTP assertion library for API testing
- **@types/jest** - TypeScript definitions for better IDE support

### Test Types
1. **Unit Tests** - Test individual functions and modules in isolation
2. **Integration Tests** - Test multiple components working together
3. **API Tests** - Test HTTP endpoints with real requests/responses

## Test Structure

```
tests/
├── setup.js              # Global test configuration
├── unit/                 # Unit tests
│   └── formatPrice.test.js
├── integration/          # Integration tests
│   └── checkout.test.js
├── api/                  # API endpoint tests
│   └── auth.test.js
└── helpers/              # Test utilities and mocks
```

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode (re-run on file changes)
```bash
npm run test:watch
```

### With Coverage Report
```bash
npm run test:coverage
```

### Specific Test Types
```bash
npm run test:unit          # Run only unit tests
npm run test:integration   # Run only integration tests
npm run test:api           # Run only API tests
```

### Single Test File
```bash
npx jest tests/unit/formatPrice.test.js
```

### Single Test Suite
```bash
npx jest -t "Auth API"
```

## Writing Tests

### Unit Test Example

Test pure functions without external dependencies:

```javascript
// tests/unit/utils.test.js
describe('formatPrice utility', () => {
  test('formats 10000 minor as 100,00 ₺', () => {
    const result = formatPrice(10000, 'TRY');
    expect(result).toBe('100,00 ₺');
  });

  test('handles negative values', () => {
    const result = formatPrice(-5000, 'TRY');
    expect(result).toBe('-50,00 ₺');
  });
});
```

### API Integration Test Example

Test HTTP endpoints with Supertest:

```javascript
// tests/api/listings.test.js
const request = require('supertest');
const app = require('../../server');

describe('Listings API', () => {
  test('GET /api/listings returns listings', async () => {
    const response = await request(app)
      .get('/api/listings')
      .expect(200);

    expect(response.body.ok).toBe(true);
    expect(response.body.listings).toBeInstanceOf(Array);
  });

  test('POST /api/listings requires authentication', async () => {
    const response = await request(app)
      .post('/api/listings')
      .send({ title: 'Test' })
      .expect(401);

    expect(response.body.ok).toBe(false);
  });
});
```

### Integration Test Example

Test business logic flows:

```javascript
// tests/integration/cart.test.js
describe('Shopping Cart Flow', () => {
  let cart;

  beforeEach(() => {
    cart = createEmptyCart();
  });

  test('adding item increases cart total', () => {
    cart.addItem({ id: 1, price_minor: 10000, quantity: 1 });
    expect(cart.total_minor).toBe(10000);
  });

  test('free shipping over threshold', () => {
    cart.addItem({ id: 1, price_minor: 25000, quantity: 1 });
    expect(cart.getShippingCost()).toBe(0);
  });
});
```

## Test Coverage

### Viewing Coverage

After running `npm run test:coverage`, open:
```
coverage/lcov-report/index.html
```

### Coverage Thresholds

Current thresholds (configured in `jest.config.js`):
- **Branches**: 30%
- **Functions**: 30%
- **Lines**: 30%
- **Statements**: 30%

Tests will fail if coverage drops below these thresholds.

### Improving Coverage

1. Identify untested code:
   ```bash
   npm run test:coverage
   ```

2. Look for red/yellow files in the coverage report

3. Add tests for uncovered lines

4. Gradually increase thresholds in `jest.config.js`

## Test Environment

### Environment Variables

Create `.env.test` for test-specific configuration:

```env
NODE_ENV=test
DB_HOST=localhost
DB_USER=test_user
DB_PASSWORD=test_pass
DB_NAME=eskisini_test
JWT_SECRET=test-secret-key-min-32-chars-long
```

### Test Database

For integration tests that need a database:

1. Create a test database:
   ```sql
   CREATE DATABASE eskisini_test;
   ```

2. Import schema:
   ```bash
   mysql -u user -p eskisini_test < database/schema.sql
   ```

3. Use separate connection pool in tests:
   ```javascript
   const { pool } = require('./tests/helpers/testDb');
   ```

## Mocking

### Mocking Dependencies

```javascript
// Mock external APIs
jest.mock('../services/cloudinary', () => ({
  uploadImage: jest.fn().mockResolvedValue({
    url: 'https://fake.url/image.jpg'
  })
}));

// Mock database
jest.mock('../db', () => ({
  pool: {
    query: jest.fn()
  }
}));
```

### Spy on Functions

```javascript
const sendEmail = require('../services/email');

test('order confirmation sends email', async () => {
  const spy = jest.spyOn(sendEmail, 'send');

  await createOrder({...});

  expect(spy).toHaveBeenCalledWith({
    to: 'user@example.com',
    subject: 'Order Confirmation'
  });

  spy.mockRestore();
});
```

## Continuous Integration

### GitHub Actions Example

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Generate coverage
        run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Best Practices

### 1. Test Organization

- **One concept per test** - Each test should verify a single behavior
- **Descriptive names** - Test names should explain what they're testing
- **AAA Pattern** - Arrange, Act, Assert

```javascript
test('cart total includes shipping cost', () => {
  // Arrange
  const cart = createCart({ items: [...], subtotal: 15000 });

  // Act
  const total = cart.calculateTotal();

  // Assert
  expect(total).toBe(15999); // 150 + 9.99 shipping
});
```

### 2. Isolation

- Each test should be independent
- Use `beforeEach`/`afterEach` for setup/teardown
- Don't rely on test execution order

```javascript
describe('User Authentication', () => {
  let user;

  beforeEach(() => {
    user = createTestUser();
  });

  afterEach(() => {
    cleanupUser(user);
  });

  test('login with valid credentials', () => {
    // Test uses fresh user created in beforeEach
  });
});
```

### 3. Test Data

- Use factories for consistent test data
- Avoid hardcoded IDs
- Use meaningful test values

```javascript
// Good
const user = testHelpers.createTestUser({
  email: 'john@example.com',
  role: 'seller'
});

// Bad
const user = { id: 123, email: 'a@b.c', x: 1 };
```

### 4. Async Testing

```javascript
// Async/await (preferred)
test('fetches user data', async () => {
  const user = await fetchUser(1);
  expect(user.name).toBe('Test User');
});

// Promise
test('fetches user data', () => {
  return fetchUser(1).then(user => {
    expect(user.name).toBe('Test User');
  });
});

// Callback (avoid if possible)
test('fetches user data', done => {
  fetchUser(1, (err, user) => {
    expect(user.name).toBe('Test User');
    done();
  });
});
```

### 5. Error Testing

```javascript
test('throws error for invalid input', () => {
  expect(() => {
    createListing({ price: -100 });
  }).toThrow('Price must be positive');
});

test('rejects with error message', async () => {
  await expect(
    loginUser('invalid', 'credentials')
  ).rejects.toThrow('Invalid credentials');
});
```

### 6. Matchers

```javascript
// Equality
expect(value).toBe(5);                    // Strict equality
expect(value).toEqual({ a: 1 });          // Deep equality

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();
expect(value).toBeDefined();

// Numbers
expect(value).toBeGreaterThan(10);
expect(value).toBeLessThanOrEqual(100);
expect(value).toBeCloseTo(0.3, 2);       // Floating point

// Strings
expect(text).toMatch(/pattern/);
expect(text).toContain('substring');

// Arrays
expect(array).toContain('item');
expect(array).toHaveLength(3);

// Objects
expect(obj).toHaveProperty('key');
expect(obj).toMatchObject({ a: 1 });
```

## Debugging Tests

### Run Single Test
```bash
npx jest -t "test name"
```

### Debug in VSCode

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "${file}"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Verbose Output
```bash
npx jest --verbose
```

### Show Console Logs
```bash
npx jest --silent=false
```

## Common Issues

### Tests Hanging

- Check for unresolved promises
- Use `--detectOpenHandles` to find leaks:
  ```bash
  npx jest --detectOpenHandles
  ```

### Database Connection Issues

- Ensure test database exists
- Check `.env.test` configuration
- Close connections in `afterAll()`

### Flaky Tests

- Check for race conditions
- Avoid relying on timing
- Use `waitFor` helpers for async operations

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

## Next Steps

1. **Add More Tests**: Prioritize critical paths (auth, checkout, payments)
2. **Increase Coverage**: Aim for 50%+ coverage on backend
3. **CI/CD Integration**: Automate testing on every commit
4. **E2E Tests**: Consider Playwright/Cypress for full browser testing
5. **Performance Tests**: Add load testing for critical endpoints

---

For questions or suggestions, see [CLAUDE.md](CLAUDE.md) or project documentation.