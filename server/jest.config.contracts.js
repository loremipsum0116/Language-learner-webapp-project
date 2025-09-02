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
  ]
};