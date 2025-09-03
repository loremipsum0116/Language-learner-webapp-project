const ResponseFormatter = require('./responseFormatter');

describe('ResponseFormatter', () => {
  describe('success', () => {
    it('should format successful response with data', () => {
      const data = { message: 'test' };
      const result = ResponseFormatter.success(data);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
      expect(result.timestamp).toBeDefined();
    });

    it('should include meta information when provided', () => {
      const data = { message: 'test' };
      const meta = { total: 10 };
      const result = ResponseFormatter.success(data, meta);
      
      expect(result.meta).toEqual(meta);
    });

    it('should handle null data', () => {
      const result = ResponseFormatter.success(null);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe('error', () => {
    it('should format error response', () => {
      const message = 'Something went wrong';
      const result = ResponseFormatter.error(message);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe(message);
      expect(result.timestamp).toBeDefined();
    });

    it('should include error code when provided', () => {
      const message = 'Unauthorized';
      const code = 'AUTH_ERROR';
      const result = ResponseFormatter.error(message, code);
      
      expect(result.code).toBe(code);
    });

    it('should include details when provided', () => {
      const message = 'Validation failed';
      const details = [{ field: 'email', message: 'Required' }];
      const result = ResponseFormatter.error(message, null, details);
      
      expect(result.details).toEqual(details);
    });
  });

  describe('paginated', () => {
    it('should format paginated response', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const page = 1;
      const limit = 10;
      const total = 50;
      
      const result = ResponseFormatter.paginated(data, page, limit, total);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
      expect(result.pagination).toEqual({
        page,
        limit,
        total,
        totalPages: 5,
        hasNext: true,
        hasPrev: false
      });
    });

    it('should calculate pagination correctly for last page', () => {
      const data = [{ id: 1 }];
      const page = 5;
      const limit = 10;
      const total = 41;
      
      const result = ResponseFormatter.paginated(data, page, limit, total);
      
      expect(result.pagination.totalPages).toBe(5);
      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrev).toBe(true);
    });

    it('should include meta information', () => {
      const data = [];
      const meta = { cursor: 'abc123' };
      
      const result = ResponseFormatter.paginated(data, 1, 10, 0, meta);
      
      expect(result.meta).toEqual(meta);
    });
  });

  describe('validation', () => {
    it('should format validation error response', () => {
      const errors = [
        { field: 'email', message: 'Required' },
        { field: 'password', message: 'Too short' }
      ];
      
      const result = ResponseFormatter.validation(errors);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation failed');
      expect(result.details).toEqual(errors);
      expect(result.code).toBe('VALIDATION_ERROR');
    });

    it('should handle empty errors array', () => {
      const result = ResponseFormatter.validation([]);
      
      expect(result.success).toBe(false);
      expect(result.details).toEqual([]);
    });
  });

  describe('batch', () => {
    it('should format batch operation response', () => {
      const successful = [{ id: 1, status: 'success' }];
      const failed = [{ id: 2, error: 'Failed' }];
      
      const result = ResponseFormatter.batch(successful, failed);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        successful,
        failed,
        summary: {
          total: 2,
          successful: 1,
          failed: 1
        }
      });
    });

    it('should handle empty arrays', () => {
      const result = ResponseFormatter.batch([], []);
      
      expect(result.data.summary).toEqual({
        total: 0,
        successful: 0,
        failed: 0
      });
    });

    it('should include meta information', () => {
      const meta = { processTime: '100ms' };
      const result = ResponseFormatter.batch([], [], meta);
      
      expect(result.meta).toEqual(meta);
    });
  });
});