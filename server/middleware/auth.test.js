// middleware/auth.test.js
const authMiddleware = require('./auth');
const jwtService = require('../services/jwtService');

// Mock jwtService
jest.mock('../services/jwtService', () => ({
  extractToken: jest.fn(),
  verifyAccessToken: jest.fn()
}));

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      path: '/protected',
      method: 'GET',
      headers: {},
      cookies: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Public endpoints', () => {
    const publicPaths = [
      '/audio/test.mp3',
      '/audio-files/vocab.mp3',
      '/vocab/list',
      '/vocab/test',
      '/vocab/vocab-by-pos',
      '/exam-vocab/categories',
      '/api/idiom',
      '/starter/basic',
      '/elementary/lesson1',
      '/intermediate/grammar',
      '/upper/advanced',
      '/advanced/complex',
      '/api',
      '/docs/api/v1'
    ];

    publicPaths.forEach(path => {
      it(`should skip auth for public path: ${path}`, () => {
        req.path = path;
        
        authMiddleware(req, res, next);
        
        expect(next).toHaveBeenCalledWith();
        expect(res.status).not.toHaveBeenCalled();
        expect(jwtService.extractToken).not.toHaveBeenCalled();
      });
    });
  });

  describe('Protected endpoints', () => {
    it('should require token for protected paths', () => {
      req.path = '/protected/resource';
      jwtService.extractToken.mockReturnValue(null);
      
      authMiddleware(req, res, next);
      
      expect(jwtService.extractToken).toHaveBeenCalledWith(req, 'access');
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        ok: false,
        error: 'Unauthorized',
        code: 'NO_TOKEN'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should verify valid token and call next', () => {
      const mockToken = 'valid.jwt.token';
      const mockUser = { id: 1, email: 'test@example.com', role: 'user' };
      
      req.path = '/protected/resource';
      jwtService.extractToken.mockReturnValue(mockToken);
      jwtService.verifyAccessToken.mockReturnValue({ valid: true, user: mockUser });
      
      authMiddleware(req, res, next);
      
      expect(jwtService.extractToken).toHaveBeenCalledWith(req, 'access');
      expect(jwtService.verifyAccessToken).toHaveBeenCalledWith(mockToken);
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle invalid token', () => {
      const mockToken = 'invalid.jwt.token';
      
      req.path = '/protected/resource';
      jwtService.extractToken.mockReturnValue(mockToken);
      jwtService.verifyAccessToken.mockReturnValue({ 
        valid: false, 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
      
      authMiddleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        ok: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle missing path', () => {
      delete req.path;
      jwtService.extractToken.mockReturnValue(null);
      
      authMiddleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should handle case-sensitive paths', () => {
      req.path = '/VOCAB/LIST'; // Different case
      jwtService.extractToken.mockReturnValue(null);
      
      authMiddleware(req, res, next);
      
      // Should not skip auth for case-different path
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('Error handling', () => {
    it('should handle JWT service errors', () => {
      const mockToken = 'valid.token';
      
      req.path = '/protected/resource';
      jwtService.extractToken.mockReturnValue(mockToken);
      jwtService.verifyAccessToken.mockImplementation(() => {
        throw new Error('JWT service error');
      });
      
      expect(() => authMiddleware(req, res, next)).toThrow('JWT service error');
    });
  });
});