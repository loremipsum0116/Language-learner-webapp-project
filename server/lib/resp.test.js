// lib/resp.test.js
const { ok, fail } = require('./resp');

describe('Response Utilities', () => {
  let mockRes;

  beforeEach(() => {
    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis()
    };
  });

  describe('ok', () => {
    it('should return JSON response with data only', () => {
      const testData = { message: 'success' };
      
      ok(mockRes, testData);
      
      expect(mockRes.json).toHaveBeenCalledWith({ data: testData });
    });

    it('should return JSON response with data and meta', () => {
      const testData = { message: 'success' };
      const testMeta = { count: 1, page: 1 };
      
      ok(mockRes, testData, testMeta);
      
      expect(mockRes.json).toHaveBeenCalledWith({ 
        data: testData, 
        meta: testMeta 
      });
    });

    it('should handle null data', () => {
      ok(mockRes, null);
      
      expect(mockRes.json).toHaveBeenCalledWith({ data: null });
    });

    it('should handle undefined data', () => {
      ok(mockRes, undefined);
      
      expect(mockRes.json).toHaveBeenCalledWith({ data: undefined });
    });

    it('should handle empty object data', () => {
      const emptyData = {};
      
      ok(mockRes, emptyData);
      
      expect(mockRes.json).toHaveBeenCalledWith({ data: emptyData });
    });

    it('should handle array data', () => {
      const arrayData = [1, 2, 3];
      
      ok(mockRes, arrayData);
      
      expect(mockRes.json).toHaveBeenCalledWith({ data: arrayData });
    });
  });

  describe('fail', () => {
    it('should return error response with custom status and message', () => {
      fail(mockRes, 404, 'Not found');
      
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Not found' });
    });

    it('should use default error message when message is not provided', () => {
      fail(mockRes, 500);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'error' });
    });

    it('should handle empty string message', () => {
      fail(mockRes, 400, '');
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'error' });
    });

    it('should handle null message', () => {
      fail(mockRes, 401, null);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'error' });
    });

    it('should handle different status codes', () => {
      const testCases = [
        { status: 400, message: 'Bad Request' },
        { status: 401, message: 'Unauthorized' },
        { status: 403, message: 'Forbidden' },
        { status: 500, message: 'Internal Server Error' }
      ];

      testCases.forEach(({ status, message }) => {
        const mockResponse = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis()
        };

        fail(mockResponse, status, message);

        expect(mockResponse.status).toHaveBeenCalledWith(status);
        expect(mockResponse.json).toHaveBeenCalledWith({ error: message });
      });
    });
  });
});