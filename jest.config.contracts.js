// jest.config.contracts.js - Contract testing configuration
module.exports = {
  displayName: 'Contract Tests',
  testEnvironment: 'node',
  testMatch: [
    '**/src/tests/contracts/simple.consumer.test.js'
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
  // Mock axios in @pact-foundation to avoid ES module issues
  moduleNameMapper: {
    '^axios$': '<rootDir>/src/tests/setup/axios-mock.js'
  },
  // Transform configuration
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@pact-foundation)/)'
  ],
  // Clear and simple configuration - axios 0.27.2 is CommonJS
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};