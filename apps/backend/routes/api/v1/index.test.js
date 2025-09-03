// routes/api/v1/index.test.js
const request = require('supertest');
const express = require('express');
const v1Router = require('./index');

// Create test app
const app = express();
app.use('/api/v1', v1Router);

// Mock auth middleware to avoid authentication issues in tests
jest.mock('../../../middleware/auth', () => {
  return (req, res, next) => {
    req.user = { id: 1, email: 'test@example.com', role: 'user' };
    next();
  };
});

// Mock all route modules
jest.mock('../../auth', () => {
  const router = require('express').Router();
  router.get('/test', (req, res) => res.json({ route: 'auth' }));
  return router;
});

jest.mock('../../learn', () => {
  const router = require('express').Router();
  router.get('/test', (req, res) => res.json({ route: 'learn' }));
  return router;
});

jest.mock('../../vocab', () => {
  const router = require('express').Router();
  router.get('/test', (req, res) => res.json({ route: 'vocab' }));
  return router;
});

jest.mock('../../quiz', () => {
  const router = require('express').Router();
  router.get('/test', (req, res) => res.json({ route: 'quiz' }));
  return router;
});

jest.mock('../../srs', () => {
  const router = require('express').Router();
  router.get('/test', (req, res) => res.json({ route: 'srs' }));
  return router;
});

// Mock other dependencies
const mockRoutes = [
  '../../user', '../../reading', '../../categories', '../../my-wordbook',
  '../../my-idioms', '../../odat-note', '../../dict', '../../examVocab',
  '../../autoFolder', '../../listening', '../../idiom_working', '../../admin'
];

mockRoutes.forEach(route => {
  jest.mock(route, () => {
    const router = require('express').Router();
    const routeName = route.split('/').pop();
    router.get('/test', (req, res) => res.json({ route: routeName }));
    return router;
  });
});

// Mock special routers with .router property
jest.mock('../../timeMachine', () => ({
  router: (() => {
    const router = require('express').Router();
    router.get('/test', (req, res) => res.json({ route: 'timeMachine' }));
    return router;
  })()
}));

jest.mock('../../timeAccelerator', () => ({
  router: (() => {
    const router = require('express').Router();
    router.get('/test', (req, res) => res.json({ route: 'timeAccelerator' }));
    return router;
  })()
}));

describe('API v1 Router', () => {
  describe('GET /', () => {
    it('should return API version information', async () => {
      const response = await request(app)
        .get('/api/v1/')
        .expect(200);

      expect(response.body).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('name', 'Language Learner API');
      expect(response.body).toHaveProperty('description');
      expect(response.body).toHaveProperty('endpoints');
      expect(response.body.endpoints).toBeInstanceOf(Array);
    });

    it('should include comprehensive endpoint list', async () => {
      const response = await request(app)
        .get('/api/v1/')
        .expect(200);

      const expectedEndpoints = [
        '/auth', '/learn', '/vocab', '/quiz', '/srs',
        '/user', '/reading', '/categories', '/my-wordbook',
        '/my-idioms', '/odat-note', '/dict', '/exam-vocab',
        '/auto-folder', '/listening', '/idiom', '/time-machine',
        '/admin', '/time-accelerator'
      ];

      expectedEndpoints.forEach(endpoint => {
        expect(response.body.endpoints).toContain(endpoint);
      });
    });

    it('should return valid JSON structure', async () => {
      const response = await request(app)
        .get('/api/v1/')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body).toMatchObject({
        version: expect.any(String),
        name: expect.any(String),
        description: expect.any(String),
        endpoints: expect.any(Array),
        timestamp: expect.any(String)
      });
    });

    it('should include timestamp in response', async () => {
      const beforeRequest = new Date();
      const response = await request(app)
        .get('/api/v1/')
        .expect(200);

      const responseTime = new Date(response.body.timestamp);
      const afterRequest = new Date();

      expect(responseTime).toBeInstanceOf(Date);
      expect(responseTime.getTime()).toBeGreaterThanOrEqual(beforeRequest.getTime() - 1000);
      expect(responseTime.getTime()).toBeLessThanOrEqual(afterRequest.getTime() + 1000);
    });
  });

  describe('Route mounting', () => {
    it('should mount auth routes correctly', async () => {
      await request(app)
        .get('/api/v1/auth/test')
        .expect(200)
        .expect({ route: 'auth' });
    });

    it('should mount learn routes correctly', async () => {
      await request(app)
        .get('/api/v1/learn/test')
        .expect(200)
        .expect({ route: 'learn' });
    });

    it('should mount vocab routes correctly', async () => {
      await request(app)
        .get('/api/v1/vocab/test')
        .expect(200)
        .expect({ route: 'vocab' });
    });

    it('should mount quiz routes correctly', async () => {
      await request(app)
        .get('/api/v1/quiz/test')
        .expect(200)
        .expect({ route: 'quiz' });
    });

    it('should mount srs routes correctly', async () => {
      await request(app)
        .get('/api/v1/srs/test')
        .expect(200)
        .expect({ route: 'srs' });
    });

    it('should handle non-existent routes', async () => {
      await request(app)
        .get('/api/v1/nonexistent')
        .expect(404);
    });
  });

  describe('Error handling', () => {
    it('should handle malformed URLs gracefully', async () => {
      await request(app)
        .get('/api/v1//double-slash')
        .expect(404);
    });

    it('should handle very long URLs', async () => {
      const longPath = '/api/v1/' + 'a'.repeat(1000);
      await request(app)
        .get(longPath)
        .expect(404);
    });
  });

  describe('HTTP methods', () => {
    it('should handle POST requests to root', async () => {
      await request(app)
        .post('/api/v1/')
        .expect(404);
    });

    it('should handle PUT requests to root', async () => {
      await request(app)
        .put('/api/v1/')
        .expect(404);
    });

    it('should handle DELETE requests to root', async () => {
      await request(app)
        .delete('/api/v1/')
        .expect(404);
    });
  });
});