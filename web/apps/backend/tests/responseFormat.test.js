/**
 * Response Format Tests
 * Validates that all API responses follow the { data, error, meta } standard
 */

const ResponseFormatter = require('../utils/responseFormatter');
const { validateResponseFormat } = require('../middleware/responseFormat');

describe('Response Format Standards', () => {
  describe('ResponseFormatter utility', () => {
    test('success response should have correct structure', () => {
      const response = ResponseFormatter.success({ id: 1, name: 'Test' });
      
      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('error');
      expect(response).toHaveProperty('meta');
      expect(response.error).toBeNull();
      expect(response.meta).toHaveProperty('timestamp');
      expect(response.data).toEqual({ id: 1, name: 'Test' });
    });

    test('error response should have correct structure', () => {
      const response = ResponseFormatter.error('Test error', 'TEST_ERROR');
      
      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('error');
      expect(response).toHaveProperty('meta');
      expect(response.data).toBeNull();
      expect(response.error).toHaveProperty('message', 'Test error');
      expect(response.error).toHaveProperty('code', 'TEST_ERROR');
      expect(response.error).toHaveProperty('timestamp');
    });

    test('paginated response should have correct structure', () => {
      const items = [{ id: 1 }, { id: 2 }];
      const response = ResponseFormatter.paginated(items, 1, 10, 25);
      
      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('error');
      expect(response).toHaveProperty('meta');
      expect(response.data).toEqual(items);
      expect(response.error).toBeNull();
      expect(response.meta).toHaveProperty('pagination');
      expect(response.meta.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNext: true,
        hasPrev: false,
        nextPage: 2,
        prevPage: null
      });
    });

    test('empty response should have correct structure', () => {
      const response = ResponseFormatter.empty();
      
      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('error');
      expect(response).toHaveProperty('meta');
      expect(response.data).toEqual([]);
      expect(response.error).toBeNull();
      expect(response.meta).toHaveProperty('count', 0);
      expect(response.meta).toHaveProperty('message', 'No data available');
    });

    test('validation error response should have correct structure', () => {
      const errors = [
        { field: 'email', message: 'Invalid email' },
        { field: 'password', message: 'Too short' }
      ];
      const response = ResponseFormatter.validationError(errors);
      
      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('error');
      expect(response).toHaveProperty('meta');
      expect(response.data).toBeNull();
      expect(response.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(response.error).toHaveProperty('details');
      expect(response.error.details).toEqual(errors);
    });

    test('auth error response should have correct structure', () => {
      const response = ResponseFormatter.authError('Invalid token');
      
      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('error');
      expect(response).toHaveProperty('meta');
      expect(response.data).toBeNull();
      expect(response.error).toHaveProperty('code', 'AUTH_ERROR');
      expect(response.error).toHaveProperty('message', 'Invalid token');
    });

    test('not found response should have correct structure', () => {
      const response = ResponseFormatter.notFound('User');
      
      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('error');
      expect(response).toHaveProperty('meta');
      expect(response.data).toBeNull();
      expect(response.error).toHaveProperty('code', 'NOT_FOUND');
      expect(response.error).toHaveProperty('message', 'User not found');
    });

    test('batch response should handle mixed results', () => {
      const successful = [{ id: 1 }, { id: 2 }];
      const failed = [{ id: 3, error: 'Failed' }];
      const response = ResponseFormatter.batch(successful, failed);
      
      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('error');
      expect(response).toHaveProperty('meta');
      expect(response.data).toHaveProperty('successful', successful);
      expect(response.data).toHaveProperty('failed', failed);
      expect(response.error).not.toBeNull();
      expect(response.error).toHaveProperty('code', 'PARTIAL_ERROR');
      expect(response.meta).toHaveProperty('successCount', 2);
      expect(response.meta).toHaveProperty('failedCount', 1);
    });
  });

  describe('Response format validation', () => {
    test('should validate correct response format', () => {
      const validResponse = {
        data: { id: 1 },
        error: null,
        meta: { timestamp: new Date().toISOString() }
      };
      
      expect(validateResponseFormat(validResponse)).toBe(true);
    });

    test('should reject response without data or error', () => {
      const invalidResponse = {
        meta: { timestamp: new Date().toISOString() }
      };
      
      expect(validateResponseFormat(invalidResponse)).toBe(false);
    });

    test('should reject response without meta', () => {
      const invalidResponse = {
        data: { id: 1 },
        error: null
      };
      
      expect(validateResponseFormat(invalidResponse)).toBe(false);
    });

    test('should reject error response with invalid structure', () => {
      const invalidResponse = {
        data: null,
        error: 'Just a string error', // Should be an object
        meta: {}
      };
      
      expect(validateResponseFormat(invalidResponse)).toBe(false);
    });

    test('should accept error response with proper structure', () => {
      const validResponse = {
        data: null,
        error: {
          message: 'Error occurred',
          code: 'ERROR_CODE',
          timestamp: new Date().toISOString(),
          details: null
        },
        meta: {}
      };
      
      expect(validateResponseFormat(validResponse)).toBe(true);
    });
  });

  describe('Edge cases and boundary conditions', () => {
    test('should handle empty arrays correctly', () => {
      const response = ResponseFormatter.success([]);
      
      expect(response.data).toEqual([]);
      expect(response.error).toBeNull();
      expect(validateResponseFormat(response)).toBe(true);
    });

    test('should handle null data correctly', () => {
      const response = ResponseFormatter.success(null);
      
      expect(response.data).toBeNull();
      expect(response.error).toBeNull();
      expect(validateResponseFormat(response)).toBe(true);
    });

    test('should handle pagination with zero items', () => {
      const response = ResponseFormatter.paginated([], 1, 10, 0);
      
      expect(response.data).toEqual([]);
      expect(response.meta.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
      });
      expect(validateResponseFormat(response)).toBe(true);
    });

    test('should handle pagination at last page', () => {
      const response = ResponseFormatter.paginated([{ id: 1 }], 3, 10, 25);
      
      expect(response.meta.pagination).toMatchObject({
        page: 3,
        totalPages: 3,
        hasNext: false,
        hasPrev: true,
        nextPage: null,
        prevPage: 2
      });
    });

    test('should include custom meta fields', () => {
      const customMeta = { version: '1.0', requestId: 'abc123' };
      const response = ResponseFormatter.success({ id: 1 }, customMeta);
      
      expect(response.meta).toMatchObject(customMeta);
      expect(response.meta).toHaveProperty('timestamp');
    });

    test('should handle rate limit with retry after', () => {
      const response = ResponseFormatter.rateLimitError(120);
      
      expect(response.error).toHaveProperty('code', 'RATE_LIMIT_EXCEEDED');
      expect(response.error.details).toHaveProperty('retryAfter', 120);
    });
  });
});