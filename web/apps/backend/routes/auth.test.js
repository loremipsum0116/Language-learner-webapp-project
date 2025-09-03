const request = require('supertest');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../lib/prismaClient');
const authRoutes = require('./auth');
const cookieParser = require('cookie-parser');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/auth', authRoutes);

// Mock Prisma functions for testing
jest.mock('../lib/prismaClient', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    }
  }
}));

// Mock JWT
jest.mock('jsonwebtoken');

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123'
      };

      // Mock user doesn't exist
      prisma.user.findUnique.mockResolvedValue(null);
      
      // Mock user creation
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const newUser = {
        id: 1,
        email: userData.email,
        passwordHash: hashedPassword,
        role: 'USER',
        createdAt: new Date()
      };
      prisma.user.create.mockResolvedValue(newUser);

      // Mock JWT token
      jwt.sign.mockReturnValue('fake-jwt-token');

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.role).toBe('USER');
      expect(response.body.user.passwordHash).toBeUndefined();
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: userData.email,
          passwordHash: expect.any(String),
          role: 'USER'
        }
      });
    });

    it('should return error if user already exists', async () => {
      const userData = {
        email: 'existing@example.com',
        password: 'password123'
      };

      // Mock user already exists
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: userData.email
      });

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe('User already exists');
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({})
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /auth/login', () => {
    it('should login user with valid credentials', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123'
      };

      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const existingUser = {
        id: 1,
        email: userData.email,
        passwordHash: hashedPassword,
        role: 'USER'
      };

      prisma.user.findUnique.mockResolvedValue(existingUser);
      jwt.sign.mockReturnValue('fake-jwt-token');

      const response = await request(app)
        .post('/auth/login')
        .send(userData)
        .expect(200);

      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.passwordHash).toBeUndefined();
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should return error for invalid email', async () => {
      const userData = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      prisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/auth/login')
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe('User does not exist');
    });

    it('should return error for invalid password', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      const hashedPassword = await bcrypt.hash('correctpassword', 10);
      const existingUser = {
        id: 1,
        email: userData.email,
        passwordHash: hashedPassword,
        role: 'USER'
      };

      prisma.user.findUnique.mockResolvedValue(existingUser);

      const response = await request(app)
        .post('/auth/login')
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe('Invalid password');
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout user successfully', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .expect(200);

      expect(response.body.message).toBe('Logged out successfully');
      expect(response.headers['set-cookie']).toBeDefined();
    });
  });

  describe('GET /auth/me', () => {
    it('should return user info when authenticated', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        role: 'USER'
      };

      jwt.verify.mockReturnValue({ userId: 1 });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/auth/me')
        .set('Cookie', 'token=valid-jwt-token')
        .expect(200);

      expect(response.body.user.email).toBe(mockUser.email);
    });

    it('should return error when not authenticated', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const response = await request(app)
        .get('/auth/me')
        .expect(401);

      expect(response.body.error).toBeDefined();
    });
  });
});