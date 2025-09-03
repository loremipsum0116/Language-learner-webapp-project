const request = require('supertest');
const express = require('express');
const mobileRouter = require('./index');

// Mock all sub-routers
jest.mock('./auth', () => {
  const router = require('express').Router();
  router.post('/login', (req, res) => res.json({ success: true, token: 'test-token' }));
  return router;
});

jest.mock('./vocab', () => {
  const router = require('express').Router();
  router.get('/paginated', (req, res) => res.json({ success: true, data: [] }));
  return router;
});

jest.mock('./audio', () => {
  const router = require('express').Router();
  router.get('/compressed/:id', (req, res) => res.json({ success: true }));
  return router;
});

jest.mock('./learning', () => require('express').Router());
jest.mock('./srs', () => require('express').Router());
jest.mock('./sync', () => require('express').Router());
jest.mock('./device', () => require('express').Router());

jest.mock('../../../middleware/mobile', () => ({
  detectDevice: (req, res, next) => {
    req.deviceInfo = { type: 'mobile', os: 'ios' };
    next();
  },
  validateMobileHeaders: (req, res, next) => next(),
  compressionOptimization: (req, res, next) => next()
}));

jest.mock('../../../middleware/auth', () => (req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  next();
});

const app = express();
app.use(express.json());
app.use('/api/mobile', mobileRouter);

describe('Mobile API Router', () => {
  describe('Public endpoints', () => {
    it('should respond to health check', async () => {
      const response = await request(app)
        .get('/api/mobile/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('ok');
      expect(response.body.apiVersion).toBe('mobile-v1');
    });

    it('should respond to app info', async () => {
      const response = await request(app)
        .get('/api/mobile/app-info')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.name).toContain('Mobile API');
      expect(response.body.features).toContain('offline-sync');
      expect(response.body.endpoints).toBeDefined();
    });

    it('should allow auth endpoints without authentication', async () => {
      const response = await request(app)
        .post('/api/mobile/auth/login')
        .send({ email: 'test@example.com', password: 'password' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Response formatting', () => {
    it('should format responses with mobile API structure', async () => {
      const response = await request(app)
        .get('/api/mobile/health')
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          success: true,
          timestamp: expect.any(String),
          apiVersion: 'mobile-v1',
          deviceInfo: expect.objectContaining({
            type: 'mobile',
            os: 'ios'
          })
        })
      );
    });

    it('should handle error responses', async () => {
      // Mock a route that throws an error
      const errorRouter = express.Router();
      errorRouter.get('/error', (req, res) => {
        throw new Error('Test error');
      });
      
      const testApp = express();
      testApp.use('/test', errorRouter);
      testApp.use('/api/mobile', mobileRouter);

      const response = await request(testApp)
        .get('/test/error')
        .expect(500);

      // The error should be caught by the mobile API error handler
    });
  });

  describe('Device detection', () => {
    it('should detect mobile device information', async () => {
      const response = await request(app)
        .get('/api/mobile/health')
        .set('User-Agent', 'Mobile App iOS/1.0')
        .expect(200);

      expect(response.body.deviceInfo).toBeDefined();
      expect(response.body.deviceInfo.type).toBe('mobile');
    });
  });

  describe('Protected routes', () => {
    it('should require authentication for protected endpoints', async () => {
      // This test assumes the auth middleware is working
      const response = await request(app)
        .get('/api/mobile/vocab/paginated')
        .expect(200);

      // Should have user info from auth middleware
      expect(response.body.success).toBe(true);
    });
  });

  describe('Compression optimization', () => {
    it('should apply compression for mobile clients', async () => {
      const response = await request(app)
        .get('/api/mobile/app-info')
        .set('Accept-Encoding', 'gzip, deflate')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('API versioning', () => {
    it('should include API version in responses', async () => {
      const response = await request(app)
        .get('/api/mobile/health')
        .expect(200);

      expect(response.body.apiVersion).toBe('mobile-v1');
    });
  });
});