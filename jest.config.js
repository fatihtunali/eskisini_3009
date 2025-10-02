// Jest configuration for Eskisini Ver Yenisini Al project
module.exports = {
  // Use CommonJS since project uses "type": "commonjs"
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'backend/**/*.js',
    'frontend/public/js/**/*.js',
    '!**/node_modules/**',
    '!**/vendor/**',
    '!**/__tests__/**',
    '!**/coverage/**'
  ],

  // Coverage thresholds (disabled for now, enable when adding real tests)
  // coverageThreshold: {
  //   global: {
  //     branches: 30,
  //     functions: 30,
  //     lines: 30,
  //     statements: 30
  //   }
  // },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Test timeout (useful for database/API tests)
  testTimeout: 10000,

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/frontend/public/css/dist/',
    '/backend/routes/',
    '/backend/mw/',
    '/backend/services/'
  ],

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html'],

  // Module directories
  moduleDirectories: ['node_modules', '<rootDir>']
};