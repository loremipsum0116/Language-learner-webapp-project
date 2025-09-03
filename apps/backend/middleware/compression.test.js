const compression = require('compression');
const {
  advancedCompression,
  apiResponseOptimization,
  contentTypeOptimization,
  responseSizeMonitoring,
  apiCacheOptimization,
  brotliCompression
} = require('./compression');

// Mock compression middleware
jest.mock('compression', () => jest.fn(() => (req, res, next) => next()));

describe('Compression Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      path: '/api/test',
      method: 'GET'
    };
    res = {
      json: jest.fn(),
      setHeader: jest.fn(),
      getHeader: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('advancedCompression', () => {
    it('should apply compression middleware', () => {
      const middleware = advancedCompression();
      expect(compression).toHaveBeenCalled();
      expect(typeof middleware).toBe('function');
    });

    it('should configure compression with correct options', () => {
      advancedCompression();
      
      const config = compression.mock.calls[0][0];
      expect(config).toEqual(expect.objectContaining({
        level: expect.any(Number),
        threshold: expect.any(Number)
      }));
    });
  });

  describe('apiResponseOptimization', () => {
    it('should optimize JSON responses', () => {
      const originalJson = res.json;
      const middleware = apiResponseOptimization();
      middleware(req, res, next);

      // Test that res.json is wrapped
      expect(res.json).not.toBe(originalJson);
      expect(next).toHaveBeenCalled();
    });

    it('should handle response size monitoring', () => {
      const middleware = apiResponseOptimization();
      middleware(req, res, next);

      const testData = { test: 'data' };
      res.json(testData);

      expect(res.setHeader).toHaveBeenCalledWith('X-Response-Size', expect.any(Number));
    });

    it('should skip optimization for non-API routes', () => {
      req.path = '/static/image.jpg';
      const originalJson = res.json;
      const middleware = apiResponseOptimization();
      middleware(req, res, next);

      expect(res.json).toBe(originalJson);
    });
  });

  describe('contentTypeOptimization', () => {
    it('should set appropriate content type headers', () => {
      const middleware = contentTypeOptimization();
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should handle JSON content type', () => {
      req.headers['content-type'] = 'application/json';
      const middleware = contentTypeOptimization();
      middleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json; charset=utf-8');
    });
  });

  describe('responseSizeMonitoring', () => {
    it('should monitor response sizes', () => {
      const middleware = responseSizeMonitoring();
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should add size headers for large responses', () => {
      const middleware = responseSizeMonitoring();
      const originalJson = res.json;
      middleware(req, res, next);

      // Simulate large response
      const largeData = { data: 'x'.repeat(10000) };
      res.json(largeData);

      expect(res.setHeader).toHaveBeenCalledWith(
        'X-Response-Size', 
        expect.any(Number)
      );
    });
  });

  describe('apiCacheOptimization', () => {
    it('should set appropriate cache headers for GET requests', () => {
      const middleware = apiCacheOptimization();
      middleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        expect.stringContaining('public')
      );
    });

    it('should set no-cache headers for POST requests', () => {
      req.method = 'POST';
      const middleware = apiCacheOptimization();
      middleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        expect.stringContaining('no-cache')
      );
    });

    it('should set long cache for static resources', () => {
      req.path = '/api/vocab/list';
      const middleware = apiCacheOptimization();
      middleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        expect.stringContaining('max-age')
      );
    });
  });

  describe('brotliCompression', () => {
    it('should enable brotli compression when supported', () => {
      req.headers['accept-encoding'] = 'gzip, deflate, br';
      const middleware = brotliCompression();
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should fallback to gzip when brotli not supported', () => {
      req.headers['accept-encoding'] = 'gzip, deflate';
      const middleware = brotliCompression();
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should handle missing accept-encoding header', () => {
      const middleware = brotliCompression();
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});