// server/jest.config.contracts.js - Server contract testing configuration
module.exports = {
  displayName: 'Server Contract Tests',
  testEnvironment: 'node',
  testMatch: [
    '**/tests/contracts/**/*.pact.test.js',
    '**/tests/contracts/**/*provider*.test.js'
  ],
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/contracts.js'
  ],
  testTimeout: 60000, // Provider verification may take longer
  verbose: true,
  maxWorkers: 1, // Run tests sequentially to avoid port conflicts
  collectCoverageFrom: [
    'routes/**/*.js',
    'services/**/*.js',
    'middleware/**/*.js',
    '!tests/**',
    '!coverage/**',
    '!dist/**',
    '!node_modules/**'
  ],
  coverageDirectory: 'coverage/contracts',
  coverageReporters: ['text', 'lcov', 'html'],
  // Pact-specific environment variables
  setupFiles: [
    '<rootDir>/tests/setup/pact-env.js'
  ],
  // Transform ES6 modules for Pact
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(axios|@pact-foundation|node-fetch)/)'
  ],
  // Remove axios mock for contract tests to allow Pact HTTP handling
  // moduleNameMapper: {
  //   '^axios$': '<rootDir>/../src/tests/setup/__mocks__/axios.js',
  //   '^node-fetch$': '<rootDir>/../src/tests/setup/__mocks__/node-fetch.js'
  // }
};