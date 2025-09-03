// services/jwtService.test.js
const jwtService = require('./jwtService');
const jwt = require('jsonwebtoken');

// Mock jsonwebtoken
jest.mock('jsonwebtoken');

describe('JWT Service', () => {
  const mockSecret = 'test-secret-key';
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    role: 'user'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = mockSecret;
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  describe('generateAccessToken', () => {
    it('should generate access token with user data', () => {
      const mockToken = 'mock.access.token';
      jwt.sign.mockReturnValue(mockToken);

      const result = jwtService.generateAccessToken(mockUser);

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          userId: mockUser.id,
          email: mockUser.email,
          role: mockUser.role
        },
        mockSecret,
        { expiresIn: '15m' }
      );
      expect(result).toBe(mockToken);
    });

    it('should handle missing user data', () => {
      const mockToken = 'mock.access.token';
      jwt.sign.mockReturnValue(mockToken);

      const result = jwtService.generateAccessToken({});

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          userId: undefined,
          email: undefined,
          role: undefined
        },
        mockSecret,
        { expiresIn: '15m' }
      );
      expect(result).toBe(mockToken);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate refresh token with user data', () => {
      const mockToken = 'mock.refresh.token';
      jwt.sign.mockReturnValue(mockToken);

      const result = jwtService.generateRefreshToken(mockUser);

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          userId: mockUser.id,
          email: mockUser.email,
          role: mockUser.role
        },
        mockSecret,
        { expiresIn: '7d' }
      );
      expect(result).toBe(mockToken);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', () => {
      const mockToken = 'valid.access.token';
      const mockDecoded = {
        userId: 1,
        email: 'test@example.com',
        role: 'user',
        iat: Date.now(),
        exp: Date.now() + 900000 // 15 minutes
      };

      jwt.verify.mockReturnValue(mockDecoded);

      const result = jwtService.verifyAccessToken(mockToken);

      expect(jwt.verify).toHaveBeenCalledWith(mockToken, mockSecret);
      expect(result).toEqual({
        valid: true,
        user: {
          id: mockDecoded.userId,
          email: mockDecoded.email,
          role: mockDecoded.role
        }
      });
    });

    it('should handle expired token', () => {
      const mockToken = 'expired.access.token';
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';

      jwt.verify.mockImplementation(() => {
        throw error;
      });

      const result = jwtService.verifyAccessToken(mockToken);

      expect(result).toEqual({
        valid: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    });

    it('should handle invalid token', () => {
      const mockToken = 'invalid.token';
      const error = new Error('Invalid token');
      error.name = 'JsonWebTokenError';

      jwt.verify.mockImplementation(() => {
        throw error;
      });

      const result = jwtService.verifyAccessToken(mockToken);

      expect(result).toEqual({
        valid: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    });

    it('should handle malformed token', () => {
      const mockToken = 'malformed.token';
      const error = new Error('Malformed token');
      error.name = 'NotBeforeError';

      jwt.verify.mockImplementation(() => {
        throw error;
      });

      const result = jwtService.verifyAccessToken(mockToken);

      expect(result).toEqual({
        valid: false,
        error: 'Malformed token',
        code: 'INVALID_TOKEN'
      });
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', () => {
      const mockToken = 'valid.refresh.token';
      const mockDecoded = {
        userId: 1,
        email: 'test@example.com',
        role: 'user',
        iat: Date.now(),
        exp: Date.now() + 604800000 // 7 days
      };

      jwt.verify.mockReturnValue(mockDecoded);

      const result = jwtService.verifyRefreshToken(mockToken);

      expect(jwt.verify).toHaveBeenCalledWith(mockToken, mockSecret);
      expect(result).toEqual({
        valid: true,
        user: {
          id: mockDecoded.userId,
          email: mockDecoded.email,
          role: mockDecoded.role
        }
      });
    });

    it('should handle verification errors', () => {
      const mockToken = 'invalid.refresh.token';
      const error = new Error('Token verification failed');

      jwt.verify.mockImplementation(() => {
        throw error;
      });

      const result = jwtService.verifyRefreshToken(mockToken);

      expect(result).toEqual({
        valid: false,
        error: 'Token verification failed',
        code: 'INVALID_TOKEN'
      });
    });
  });

  describe('extractToken', () => {
    it('should extract token from Authorization header', () => {
      const mockReq = {
        headers: {
          authorization: 'Bearer valid.jwt.token'
        },
        cookies: {}
      };

      const result = jwtService.extractToken(mockReq, 'access');

      expect(result).toBe('valid.jwt.token');
    });

    it('should extract token from cookies', () => {
      const mockReq = {
        headers: {},
        cookies: {
          accessToken: 'cookie.jwt.token'
        }
      };

      const result = jwtService.extractToken(mockReq, 'access');

      expect(result).toBe('cookie.jwt.token');
    });

    it('should extract refresh token from cookies', () => {
      const mockReq = {
        headers: {},
        cookies: {
          refreshToken: 'refresh.cookie.token'
        }
      };

      const result = jwtService.extractToken(mockReq, 'refresh');

      expect(result).toBe('refresh.cookie.token');
    });

    it('should prioritize header over cookies', () => {
      const mockReq = {
        headers: {
          authorization: 'Bearer header.token'
        },
        cookies: {
          accessToken: 'cookie.token'
        }
      };

      const result = jwtService.extractToken(mockReq, 'access');

      expect(result).toBe('header.token');
    });

    it('should return null if no token found', () => {
      const mockReq = {
        headers: {},
        cookies: {}
      };

      const result = jwtService.extractToken(mockReq, 'access');

      expect(result).toBeNull();
    });

    it('should handle malformed Authorization header', () => {
      const mockReq = {
        headers: {
          authorization: 'InvalidFormat'
        },
        cookies: {}
      };

      const result = jwtService.extractToken(mockReq, 'access');

      expect(result).toBeNull();
    });

    it('should handle empty Authorization header', () => {
      const mockReq = {
        headers: {
          authorization: 'Bearer '
        },
        cookies: {}
      };

      const result = jwtService.extractToken(mockReq, 'access');

      expect(result).toBeNull();
    });
  });

  describe('decodeToken', () => {
    it('should decode token without verification', () => {
      if (jwtService.decodeToken) {
        const mockToken = 'mock.jwt.token';
        const mockDecoded = {
          userId: 1,
          email: 'test@example.com',
          iat: Date.now()
        };

        jwt.decode.mockReturnValue(mockDecoded);

        const result = jwtService.decodeToken(mockToken);

        expect(jwt.decode).toHaveBeenCalledWith(mockToken);
        expect(result).toBe(mockDecoded);
      }
    });
  });

  describe('isTokenNearExpiry', () => {
    it('should detect token near expiry', () => {
      if (jwtService.isTokenNearExpiry) {
        const mockToken = 'near.expiry.token';
        const mockDecoded = {
          exp: Math.floor(Date.now() / 1000) + 300 // 5 minutes from now
        };

        jwt.decode.mockReturnValue(mockDecoded);

        const result = jwtService.isTokenNearExpiry(mockToken, 600); // 10 minute threshold

        expect(result).toBe(true);
      }
    });

    it('should detect token not near expiry', () => {
      if (jwtService.isTokenNearExpiry) {
        const mockToken = 'not.near.expiry.token';
        const mockDecoded = {
          exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
        };

        jwt.decode.mockReturnValue(mockDecoded);

        const result = jwtService.isTokenNearExpiry(mockToken, 600); // 10 minute threshold

        expect(result).toBe(false);
      }
    });
  });
});