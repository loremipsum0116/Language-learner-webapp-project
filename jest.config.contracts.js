// jest.config.contracts.js - Contract testing configuration
module.exports = {
  displayName: 'Contract Tests',
  testEnvironment: 'node',
  preset: 'jest-environment-node',
  testMatch: [
    '**/src/tests/contracts/**/*.test.js',
    '**/tests/contracts/**/*.test.js'
  ],
  setupFilesAfterEnv: [
    '<rootDir>/src/tests/setup/contracts.js'
  ],
  testTimeout: 30000, // Pact tests may take longer
  verbose: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/tests/**',
    '!src/index.js',
    '!src/serviceWorker.js'
  ],
  coverageDirectory: 'coverage/contracts',
  coverageReporters: ['text', 'lcov', 'html'],
  // Node.js environment for contract tests
  testEnvironment: 'node',
  // Transform ES6 modules for Pact
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(axios|@pact-foundation|node-fetch)/)'
  ],
  moduleNameMapper: {
    '^axios$': '<rootDir>/src/tests/setup/__mocks__/axios.js',
    '^node-fetch$': '<rootDir>/src/tests/setup/__mocks__/node-fetch.js'
  }
};