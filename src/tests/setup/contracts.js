// src/tests/setup/contracts.js - Consumer contract testing setup
const path = require('path');
const fs = require('fs');

// Setup for Pact consumer tests
beforeAll(async () => {
  // Ensure directories exist
  const dirs = [
    path.resolve(process.cwd(), 'pacts'),
    path.resolve(process.cwd(), 'logs')
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  console.log('Contract testing environment setup complete');
});

afterAll(async () => {
  console.log('Contract testing cleanup complete');
});

// Global test configuration
jest.setTimeout(30000);

// No need for fetch mocking with axios