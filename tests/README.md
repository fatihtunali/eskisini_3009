# Testing Quick Start

## Run Tests

```bash
# Run all tests
npm test

# Watch mode (auto-rerun on changes)
npm run test:watch

# With coverage report
npm run test:coverage

# Run specific test types
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:api           # API tests only
```

## Test Structure

```
tests/
├── setup.js              # Global test configuration
├── unit/                 # Unit tests (pure functions)
├── integration/          # Integration tests (workflows)
├── api/                  # API endpoint tests
└── helpers/              # Test utilities and mocks
```

## Example Tests

### ✅ Unit Test - Price Formatting
- **File**: `tests/unit/formatPrice.test.js`
- **Tests**: 8 passing tests
- **Coverage**: Turkish Lira formatting, other currencies, edge cases

### ✅ API Test - Authentication
- **File**: `tests/api/auth.test.js`
- **Tests**: 6 passing tests
- **Coverage**: Login endpoint, /me endpoint, validation

### ✅ Integration Test - Checkout Flow
- **File**: `tests/integration/checkout.test.js`
- **Tests**: 15 passing tests
- **Coverage**: Cart validation, shipping calculation, payment fees, address validation, order creation

## Current Status

- ✅ **29 tests passing**
- ✅ **3 test suites** (unit, api, integration)
- ✅ **Test infrastructure** fully configured
- ✅ **Coverage reporting** enabled

## Next Steps

1. **Add Real Tests**: Replace example tests with tests for actual project code
2. **Increase Coverage**: Aim for critical paths first (auth, checkout, payments)
3. **Enable Thresholds**: Uncomment coverage thresholds in `jest.config.js` when ready
4. **CI/CD**: Add GitHub Actions workflow for automated testing
5. **E2E Tests**: Consider Playwright/Cypress for full browser testing

## Documentation

For complete testing guide, see [TESTING.md](../TESTING.md)

## Test Commands Reference

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Generate coverage report |
| `npm run test:unit` | Run unit tests only |
| `npm run test:integration` | Run integration tests only |
| `npm run test:api` | Run API tests only |
| `npx jest <file>` | Run specific test file |
| `npx jest -t "name"` | Run tests matching name |