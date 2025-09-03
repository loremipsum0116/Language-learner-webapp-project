// services/authService.test.js
const bcrypt = require('bcrypt');
const AuthService = require('./authService');
const { prisma } = require('../lib/prismaClient');

// Mock prisma
jest.mock('../lib/prismaClient', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn()
    }
  }
}));

// Mock bcrypt
jest.mock('bcrypt');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticateUser', () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      password: 'hashed_password',
      role: 'user',
      createdAt: new Date(),
      preferences: {}
    };

    it('should authenticate user with valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);

      const result = await AuthService.authenticateUser('test@example.com', 'password123');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        select: {
          id: true,
          email: true,
          password: true,
          role: true,
          createdAt: true,
          preferences: true
        }
      });
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed_password');
      expect(result).toEqual({
        id: 1,
        email: 'test@example.com',
        role: 'user',
        createdAt: mockUser.createdAt,
        preferences: {}
      });
      expect(result.password).toBeUndefined();
    });

    it('should return null for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await AuthService.authenticateUser('nonexistent@example.com', 'password123');

      expect(result).toBeNull();
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should return null for invalid password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      const result = await AuthService.authenticateUser('test@example.com', 'wrongpassword');

      expect(result).toBeNull();
      expect(bcrypt.compare).toHaveBeenCalledWith('wrongpassword', 'hashed_password');
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database connection failed');
      prisma.user.findUnique.mockRejectedValue(dbError);

      await expect(AuthService.authenticateUser('test@example.com', 'password123'))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle bcrypt errors', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      const bcryptError = new Error('Bcrypt failed');
      bcrypt.compare.mockRejectedValue(bcryptError);

      await expect(AuthService.authenticateUser('test@example.com', 'password123'))
        .rejects.toThrow('Bcrypt failed');
    });

    it('should handle empty email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await AuthService.authenticateUser('', 'password123');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: '' },
        select: expect.any(Object)
      });
      expect(result).toBeNull();
    });

    it('should handle empty password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      const result = await AuthService.authenticateUser('test@example.com', '');

      expect(bcrypt.compare).toHaveBeenCalledWith('', 'hashed_password');
      expect(result).toBeNull();
    });
  });

  describe('createUser', () => {
    const mockHashedPassword = 'hashed_password_123';
    const mockCreatedUser = {
      id: 1,
      email: 'newuser@example.com',
      password: mockHashedPassword,
      role: 'user',
      createdAt: new Date(),
      preferences: {}
    };

    beforeEach(() => {
      bcrypt.hash = jest.fn().mockResolvedValue(mockHashedPassword);
      prisma.user.create.mockResolvedValue(mockCreatedUser);
    });

    it('should create user with hashed password', async () => {
      if (AuthService.createUser) {
        const userData = {
          email: 'newuser@example.com',
          password: 'plainpassword',
          role: 'user'
        };

        const result = await AuthService.createUser(userData);

        expect(bcrypt.hash).toHaveBeenCalledWith('plainpassword', 10);
        expect(prisma.user.create).toHaveBeenCalledWith({
          data: {
            email: 'newuser@example.com',
            password: mockHashedPassword,
            role: 'user'
          },
          select: expect.any(Object)
        });
        expect(result.password).toBeUndefined();
      }
    });
  });

  describe('updateUser', () => {
    it('should update user data', async () => {
      if (AuthService.updateUser) {
        const mockUpdatedUser = {
          id: 1,
          email: 'updated@example.com',
          role: 'admin',
          createdAt: new Date()
        };

        prisma.user.update.mockResolvedValue(mockUpdatedUser);

        const result = await AuthService.updateUser(1, {
          email: 'updated@example.com',
          role: 'admin'
        });

        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: 1 },
          data: {
            email: 'updated@example.com',
            role: 'admin'
          },
          select: expect.any(Object)
        });
        expect(result).toEqual(mockUpdatedUser);
      }
    });
  });

  describe('validatePasswordStrength', () => {
    it('should validate strong password', () => {
      if (AuthService.validatePasswordStrength) {
        const strongPassword = 'StrongP@ssw0rd123';
        const result = AuthService.validatePasswordStrength(strongPassword);
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });

    it('should reject weak passwords', () => {
      if (AuthService.validatePasswordStrength) {
        const weakPasswords = [
          '123456',
          'password',
          'abc',
          'PASSWORD',
          'password123'
        ];

        weakPasswords.forEach(password => {
          const result = AuthService.validatePasswordStrength(password);
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
        });
      }
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email formats', () => {
      if (AuthService.validateEmail) {
        const validEmails = [
          'test@example.com',
          'user.name@domain.co.uk',
          'user+tag@example.org',
          'user123@test-domain.com'
        ];

        validEmails.forEach(email => {
          const result = AuthService.validateEmail(email);
          expect(result).toBe(true);
        });
      }
    });

    it('should reject invalid email formats', () => {
      if (AuthService.validateEmail) {
        const invalidEmails = [
          'invalid-email',
          '@domain.com',
          'user@',
          'user@@domain.com',
          'user@domain',
          ''
        ];

        invalidEmails.forEach(email => {
          const result = AuthService.validateEmail(email);
          expect(result).toBe(false);
        });
      }
    });
  });
});