// src/tests/contracts/auth.consumer.test.js
const { Pact } = require('@pact-foundation/pact');
const { like, eachLike } = require('@pact-foundation/pact/src/dsl/matchers');
const path = require('path');

// Mock API client using axios-like interface for testing
const AuthAPI = {
  login: async (credentials) => {
    const axios = require('axios');
    const response = await axios.post('http://localhost:1234/api/v1/auth/login', credentials, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  },

  register: async (userData) => {
    const axios = require('axios');
    const response = await axios.post('http://localhost:1234/api/v1/auth/register', userData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  },

  refreshToken: async (refreshToken) => {
    const axios = require('axios');
    const response = await axios.post('http://localhost:1234/api/v1/auth/refresh', { refreshToken }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  }
};

describe('Auth API Consumer Contract Tests', () => {
  const provider = new Pact({
    consumer: 'Language-Learner-Client',
    provider: 'Language-Learner-API',
    port: 1234,
    log: path.resolve(process.cwd(), 'logs', 'mockserver-integration.log'),
    dir: path.resolve(process.cwd(), 'pacts'),
    logLevel: 'INFO',
  });

  beforeAll(async () => {
    await provider.setup();
  });

  afterAll(async () => {
    await provider.finalize();
  });

  afterEach(async () => {
    await provider.verify();
  });

  describe('User Login', () => {
    it('should login successfully with valid credentials', async () => {
      const expectedResponse = {
        success: true,
        user: {
          id: like(1),
          email: like('test@example.com'),
          role: like('user')
        },
        token: like('jwt.token.here'),
        refreshToken: like('refresh.token.here')
      };

      await provider.addInteraction({
        state: 'user exists with valid credentials',
        uponReceiving: 'a login request with valid credentials',
        withRequest: {
          method: 'POST',
          path: '/api/v1/auth/login',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            email: 'test@example.com',
            password: 'validPassword123'
          }
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: expectedResponse
        }
      });

      const result = await AuthAPI.login({
        email: 'test@example.com',
        password: 'validPassword123'
      });

      expect(result.success).toBe(true);
      expect(result.user.email).toBe('test@example.com');
      expect(result.token).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should fail login with invalid credentials', async () => {
      await provider.addInteraction({
        state: 'user does not exist or invalid credentials',
        uponReceiving: 'a login request with invalid credentials',
        withRequest: {
          method: 'POST',
          path: '/api/v1/auth/login',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            email: 'test@example.com',
            password: 'wrongPassword'
          }
        },
        willRespondWith: {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            success: false,
            error: like('Invalid credentials')
          }
        }
      });

      const result = await AuthAPI.login({
        email: 'test@example.com',
        password: 'wrongPassword'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const expectedResponse = {
        success: true,
        user: {
          id: like(1),
          email: like('newuser@example.com'),
          role: like('user')
        },
        message: like('User registered successfully')
      };

      await provider.addInteraction({
        state: 'no existing user with this email',
        uponReceiving: 'a registration request with valid data',
        withRequest: {
          method: 'POST',
          path: '/api/v1/auth/register',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            email: 'newuser@example.com',
            password: 'newPassword123',
            confirmPassword: 'newPassword123'
          }
        },
        willRespondWith: {
          status: 201,
          headers: {
            'Content-Type': 'application/json',
          },
          body: expectedResponse
        }
      });

      const result = await AuthAPI.register({
        email: 'newuser@example.com',
        password: 'newPassword123',
        confirmPassword: 'newPassword123'
      });

      expect(result.success).toBe(true);
      expect(result.user.email).toBe('newuser@example.com');
    });

    it('should fail registration with existing email', async () => {
      await provider.addInteraction({
        state: 'user already exists with this email',
        uponReceiving: 'a registration request with existing email',
        withRequest: {
          method: 'POST',
          path: '/api/v1/auth/register',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            email: 'existing@example.com',
            password: 'newPassword123',
            confirmPassword: 'newPassword123'
          }
        },
        willRespondWith: {
          status: 409,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            success: false,
            error: like('User already exists')
          }
        }
      });

      const result = await AuthAPI.register({
        email: 'existing@example.com',
        password: 'newPassword123',
        confirmPassword: 'newPassword123'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Token Refresh', () => {
    it('should refresh token successfully with valid refresh token', async () => {
      const expectedResponse = {
        success: true,
        token: like('new.jwt.token.here'),
        refreshToken: like('new.refresh.token.here')
      };

      await provider.addInteraction({
        state: 'valid refresh token exists',
        uponReceiving: 'a token refresh request with valid refresh token',
        withRequest: {
          method: 'POST',
          path: '/api/v1/auth/refresh',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            refreshToken: 'valid.refresh.token'
          }
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: expectedResponse
        }
      });

      const result = await AuthAPI.refreshToken('valid.refresh.token');

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should fail token refresh with invalid refresh token', async () => {
      await provider.addInteraction({
        state: 'invalid or expired refresh token',
        uponReceiving: 'a token refresh request with invalid refresh token',
        withRequest: {
          method: 'POST',
          path: '/api/v1/auth/refresh',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            refreshToken: 'invalid.refresh.token'
          }
        },
        willRespondWith: {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            success: false,
            error: like('Invalid or expired refresh token')
          }
        }
      });

      const result = await AuthAPI.refreshToken('invalid.refresh.token');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});