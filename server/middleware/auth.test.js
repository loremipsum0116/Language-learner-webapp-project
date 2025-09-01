const jwt = require('jsonwebtoken');
const { prisma } = require('../lib/prismaClient');
const authMiddleware = require('./auth');

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../lib/prismaClient', () => ({
  prisma: {
    user: {
      findUnique: jest.fn()
    }
  }
}));

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      cookies: {},
      headers: {},
      path: '/test',
      method: 'GET'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('Token from cookies', () => {
    it('should authenticate user with valid token in cookies', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        role: 'USER'
      };

      req.cookies.token = 'valid-token';
      jwt.verify.mockReturnValue({ id: 1, email: 'test@example.com', role: 'USER' });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await authMiddleware(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('valid-token', process.env.JWT_SECRET);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true
        }
      });
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
    });

    it('should return 401 for invalid token in cookies', async () => {
      req.cookies.token = 'invalid-token';
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Token from Authorization header', () => {
    it('should authenticate user with valid Bearer token', async () => {
      const mockUser = {
        id: 2,
        email: 'user@example.com',
        role: 'ADMIN'
      };

      req.headers.authorization = 'Bearer valid-bearer-token';
      jwt.verify.mockReturnValue({ userId: 2 });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await authMiddleware(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('valid-bearer-token', process.env.JWT_SECRET);
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
    });

    it('should return 401 for malformed Authorization header', async () => {
      req.headers.authorization = 'InvalidFormat token';

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access denied' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid Bearer token', async () => {
      req.headers.authorization = 'Bearer invalid-bearer-token';
      jwt.verify.mockImplementation(() => {
        throw new Error('Token expired');
      });

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('No token provided', () => {
    it('should return 401 when no token is provided', async () => {
      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access denied' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('User not found', () => {
    it('should return 401 when user is not found in database', async () => {
      req.cookies.token = 'valid-token';
      jwt.verify.mockReturnValue({ userId: 999 });
      prisma.user.findUnique.mockResolvedValue(null);

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Token priority', () => {
    it('should prioritize Authorization header over cookies', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        role: 'USER'
      };

      req.cookies.token = 'cookie-token';
      req.headers.authorization = 'Bearer header-token';
      jwt.verify.mockReturnValue({ id: 1, email: 'test@example.com', role: 'USER' });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await authMiddleware(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('header-token', process.env.JWT_SECRET);
      expect(jwt.verify).not.toHaveBeenCalledWith('cookie-token', expect.any(String));
      expect(next).toHaveBeenCalled();
    });
  });

  describe('JWT verification errors', () => {
    it('should handle TokenExpiredError', async () => {
      req.cookies.token = 'expired-token';
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';
      jwt.verify.mockImplementation(() => {
        throw error;
      });

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token expired' });
    });

    it('should handle JsonWebTokenError', async () => {
      req.cookies.token = 'malformed-token';
      const error = new Error('Malformed token');
      error.name = 'JsonWebTokenError';
      jwt.verify.mockImplementation(() => {
        throw error;
      });

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    });

    it('should handle NotBeforeError', async () => {
      req.cookies.token = 'not-active-token';
      const error = new Error('Token not active');
      error.name = 'NotBeforeError';
      jwt.verify.mockImplementation(() => {
        throw error;
      });

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token not active' });
    });
  });

  describe('Database errors', () => {
    it('should handle database connection errors', async () => {
      req.cookies.token = 'valid-token';
      jwt.verify.mockReturnValue({ id: 1, email: 'test@example.com', role: 'USER' });
      prisma.user.findUnique.mockRejectedValue(new Error('Database connection failed'));

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Role-based access scenarios', () => {
    it('should authenticate admin user', async () => {
      const adminUser = {
        id: 1,
        email: 'admin@example.com',
        role: 'ADMIN'
      };

      req.cookies.token = 'admin-token';
      jwt.verify.mockReturnValue({ id: 1, email: 'test@example.com', role: 'USER' });
      prisma.user.findUnique.mockResolvedValue(adminUser);

      await authMiddleware(req, res, next);

      expect(req.user.role).toBe('ADMIN');
      expect(next).toHaveBeenCalled();
    });

    it('should authenticate regular user', async () => {
      const regularUser = {
        id: 2,
        email: 'user@example.com',
        role: 'USER'
      };

      req.cookies.token = 'user-token';
      jwt.verify.mockReturnValue({ userId: 2 });
      prisma.user.findUnique.mockResolvedValue(regularUser);

      await authMiddleware(req, res, next);

      expect(req.user.role).toBe('USER');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty token in cookies', async () => {
      req.cookies.token = '';

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access denied' });
      expect(jwt.verify).not.toHaveBeenCalled();
    });

    it('should handle whitespace-only token', async () => {
      req.cookies.token = '   ';

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access denied' });
      expect(jwt.verify).not.toHaveBeenCalled();
    });

    it('should handle Authorization header with only "Bearer"', async () => {
      req.headers.authorization = 'Bearer';

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access denied' });
    });

    it('should handle Authorization header with extra spaces', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        role: 'USER'
      };

      req.headers.authorization = 'Bearer   token-with-spaces   ';
      jwt.verify.mockReturnValue({ id: 1, email: 'test@example.com', role: 'USER' });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await authMiddleware(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('token-with-spaces', process.env.JWT_SECRET);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Security tests', () => {
    it('should not expose sensitive user data', async () => {
      const userWithSensitiveData = {
        id: 1,
        email: 'test@example.com',
        role: 'USER',
        createdAt: new Date()
      };

      req.cookies.token = 'valid-token';
      jwt.verify.mockReturnValue({ id: 1, email: 'test@example.com', role: 'USER' });
      prisma.user.findUnique.mockResolvedValue(userWithSensitiveData);

      await authMiddleware(req, res, next);

      // Ensure password hash is not included
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true
        }
      });
      expect(req.user.passwordHash).toBeUndefined();
    });

    it('should handle token payload without userId', async () => {
      req.cookies.token = 'token-without-userid';
      jwt.verify.mockReturnValue({ someOtherField: 'value' });

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    });

    it('should handle token payload with invalid userId type', async () => {
      req.cookies.token = 'token-with-invalid-userid';
      jwt.verify.mockReturnValue({ userId: 'not-a-number' });

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    });
  });

  describe('Performance tests', () => {
    it('should complete authentication within reasonable time', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        role: 'USER'
      };

      req.cookies.token = 'valid-token';
      jwt.verify.mockReturnValue({ id: 1, email: 'test@example.com', role: 'USER' });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const start = performance.now();
      await authMiddleware(req, res, next);
      const end = performance.now();

      expect(end - start).toBeLessThan(50); // Should complete within 50ms
      expect(next).toHaveBeenCalled();
    });
  });
});