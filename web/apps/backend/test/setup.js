// Test setup file
require('dotenv').config({ path: '.env.test' });

// Mock environment variables
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// Only show errors in tests
console.log = jest.fn();
console.error = jest.fn();

// Cleanup after tests
afterEach(async () => {
  // Clear all mocks after each test
  jest.clearAllMocks();
});

afterAll(async () => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  
  // Force exit after all tests
  await new Promise(resolve => setTimeout(resolve, 100));
});