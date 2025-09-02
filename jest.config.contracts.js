// jest.config.contracts.js - Contract testing configuration
module.exports = {
  displayName: 'Contract Tests',
  testEnvironment: 'node',
  testMatch: [
    '**/src/tests/contracts/**/*.test.js',
    '**/tests/contracts/**/*.test.js'
  ],
  setupFilesAfterEnv: [
    '<rootDir>/src/tests/setup/contracts.js'
  ],
  testTimeout: 30000, // Pact tests may take longer
  verbose: true,
  maxWorkers: 1, // Run tests sequentially to avoid port conflicts
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/tests/**',
    '!src/index.js',
    '!src/serviceWorker.js'
  ],
  coverageDirectory: 'coverage/contracts',
  coverageReporters: ['text', 'lcov', 'html'],
  // Don't transform any node_modules to avoid ES module issues
  transformIgnorePatterns: [
    'node_modules/'
  ],
  // Mock axios completely to avoid ES module issues
  moduleNameMapper: {
    '^axios$': '<rootDir>/src/tests/setup/axios-mock.js'
  }
};