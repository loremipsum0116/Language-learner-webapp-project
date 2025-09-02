// jest.config.contracts.js - Contract testing configuration
module.exports = {
  displayName: 'Contract Tests',
  testEnvironment: 'node',
  testMatch: [
    '**/src/tests/contracts/**/*.test.js'
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
  // Transform configuration
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@pact-foundation|axios)/)'
  ],
  // Mock both axios and node-fetch to avoid ES module issues
  moduleNameMapper: {
    '^axios$': '<rootDir>/src/tests/setup/axios-mock.js',
    '^node-fetch$': '<rootDir>/src/tests/setup/axios-mock.js'
  },
  // Force CommonJS for this config
  preset: undefined,
  extensionsToTreatAsEsm: [],
  globals: {
    'ts-jest': {
      useESM: false
    }
  }
};