const {
  detectDevice,
  validateMobileHeaders,
  compressionOptimization
} = require('./mobile');

describe('Mobile Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      body: {},
      method: 'GET',
      path: '/api/mobile/test'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('detectDevice', () => {
    it('should detect iOS device', () => {
      req.headers['user-agent'] = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)';
      
      detectDevice(req, res, next);
      
      expect(req.deviceInfo).toEqual(
        expect.objectContaining({
          type: 'mobile',
          os: 'ios',
          userAgent: expect.any(String)
        })
      );
      expect(next).toHaveBeenCalled();
    });

    it('should detect Android device', () => {
      req.headers['user-agent'] = 'Mozilla/5.0 (Linux; Android 10; SM-G975F)';
      
      detectDevice(req, res, next);
      
      expect(req.deviceInfo).toEqual(
        expect.objectContaining({
          type: 'mobile',
          os: 'android'
        })
      );
    });

    it('should detect tablet device', () => {
      req.headers['user-agent'] = 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)';
      
      detectDevice(req, res, next);
      
      expect(req.deviceInfo).toEqual(
        expect.objectContaining({
          type: 'tablet',
          os: 'ios'
        })
      );
    });

    it('should detect desktop device', () => {
      req.headers['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
      
      detectDevice(req, res, next);
      
      expect(req.deviceInfo).toEqual(
        expect.objectContaining({
          type: 'desktop',
          os: 'windows'
        })
      );
    });

    it('should handle missing user agent', () => {
      detectDevice(req, res, next);
      
      expect(req.deviceInfo).toEqual(
        expect.objectContaining({
          type: 'unknown',
          os: 'unknown'
        })
      );
    });

    it('should detect app version from custom headers', () => {
      req.headers['x-app-version'] = '1.2.3';
      req.headers['x-app-platform'] = 'react-native';
      
      detectDevice(req, res, next);
      
      expect(req.deviceInfo).toEqual(
        expect.objectContaining({
          appVersion: '1.2.3',
          platform: 'react-native'
        })
      );
    });
  });

  describe('validateMobileHeaders', () => {
    it('should validate required mobile headers', () => {
      req.headers['x-mobile-client'] = 'true';
      req.headers['x-api-version'] = 'mobile-v1';
      
      validateMobileHeaders(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });

    it('should add default headers when missing', () => {
      validateMobileHeaders(req, res, next);
      
      expect(req.headers['x-mobile-client']).toBe('false');
      expect(req.headers['x-api-version']).toBe('mobile-v1');
      expect(next).toHaveBeenCalled();
    });

    it('should validate API version compatibility', () => {
      req.headers['x-api-version'] = 'mobile-v2';
      
      validateMobileHeaders(req, res, next);
      
      // Should still proceed but might log a warning
      expect(next).toHaveBeenCalled();
    });

    it('should handle deprecated API versions', () => {
      req.headers['x-api-version'] = 'v1'; // Old version
      
      validateMobileHeaders(req, res, next);
      
      expect(res.setHeader).toHaveBeenCalledWith(
        'X-API-Deprecated', 
        'This API version is deprecated'
      );
    });
  });

  describe('compressionOptimization', () => {
    it('should enable compression for mobile clients', () => {
      req.headers['accept-encoding'] = 'gzip, deflate';
      req.headers['x-mobile-client'] = 'true';
      
      compressionOptimization(req, res, next);
      
      expect(res.setHeader).toHaveBeenCalledWith(
        'X-Compression-Enabled',
        'true'
      );
      expect(next).toHaveBeenCalled();
    });

    it('should optimize for low bandwidth connections', () => {
      req.headers['x-connection-type'] = '2g';
      
      compressionOptimization(req, res, next);
      
      expect(res.setHeader).toHaveBeenCalledWith(
        'X-Low-Bandwidth-Mode',
        'true'
      );
    });

    it('should handle high bandwidth connections', () => {
      req.headers['x-connection-type'] = 'wifi';
      
      compressionOptimization(req, res, next);
      
      expect(res.setHeader).toHaveBeenCalledWith(
        'X-High-Bandwidth-Mode',
        'true'
      );
    });

    it('should set appropriate cache headers for mobile', () => {
      req.headers['x-mobile-client'] = 'true';
      req.method = 'GET';
      
      compressionOptimization(req, res, next);
      
      expect(res.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        expect.stringContaining('mobile-optimized')
      );
    });

    it('should handle offline capability detection', () => {
      req.headers['x-offline-capable'] = 'true';
      
      compressionOptimization(req, res, next);
      
      expect(res.setHeader).toHaveBeenCalledWith(
        'X-Offline-Support',
        'enabled'
      );
    });

    it('should optimize response size for mobile', () => {
      const originalJson = res.json;
      req.headers['x-mobile-client'] = 'true';
      
      compressionOptimization(req, res, next);
      
      // Should wrap res.json for mobile optimization
      expect(res.json).not.toBe(originalJson);
    });

    it('should handle data usage preferences', () => {
      req.headers['x-data-saver'] = 'enabled';
      
      compressionOptimization(req, res, next);
      
      expect(res.setHeader).toHaveBeenCalledWith(
        'X-Data-Saver-Mode',
        'active'
      );
    });
  });
});