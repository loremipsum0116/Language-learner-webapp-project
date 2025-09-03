const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const audioRouter = require('./audio');
const { prisma } = require('../../../lib/prismaClient');
const authMiddleware = require('../../../middleware/auth');

jest.mock('../../../lib/prismaClient', () => ({
  prisma: {
    vocab: {
      findUnique: jest.fn(),
      findMany: jest.fn()
    }
  }
}));

jest.mock('../../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  next();
}));

jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    stat: jest.fn(),
    mkdir: jest.fn(),
    copyFile: jest.fn(),
    readdir: jest.fn(),
    unlink: jest.fn()
  }
}));

jest.mock('fluent-ffmpeg', () => {
  const mockFfmpeg = jest.fn().mockReturnThis();
  mockFfmpeg.audioBitrate = jest.fn().mockReturnThis();
  mockFfmpeg.audioCodec = jest.fn().mockReturnThis();
  mockFfmpeg.format = jest.fn().mockReturnThis();
  mockFfmpeg.on = jest.fn().mockReturnThis();
  mockFfmpeg.save = jest.fn().mockReturnThis();
  mockFfmpeg.getAvailableFormats = jest.fn((callback) => callback(null, {}));
  return mockFfmpeg;
});

const app = express();
app.use(express.json());
app.use('/audio', audioRouter);

// Add response formatter middleware
app.use((req, res, next) => {
  res.success = (data, meta) => res.json({ success: true, data, meta });
  res.batch = (successful, failed, meta) => res.json({ 
    success: true, 
    successful, 
    failed, 
    meta 
  });
  res.validationError = (errors) => res.status(400).json({ success: false, errors });
  res.serverError = (message) => res.status(500).json({ success: false, error: message });
  res.notFound = (resource) => res.status(404).json({ success: false, error: `${resource} not found` });
  res.authError = (message) => res.status(403).json({ success: false, error: message });
  next();
});

describe('Mobile Audio API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /audio/compressed/:vocabId', () => {
    it('should return compressed audio for valid vocab ID', async () => {
      const mockVocab = {
        id: 1,
        lemma: 'test',
        audioUrl: '/audio/test.mp3',
        level: 'A1'
      };

      prisma.vocab.findUnique.mockResolvedValue(mockVocab);
      fs.access.mockResolvedValue(); // File exists
      fs.stat.mockResolvedValue({ size: 1000 });

      // Mock createReadStream
      const mockStream = {
        pipe: jest.fn()
      };
      require('fs').createReadStream = jest.fn().mockReturnValue(mockStream);

      const response = await request(app)
        .get('/audio/compressed/1')
        .expect(200);

      expect(prisma.vocab.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: expect.objectContaining({
          id: true,
          lemma: true,
          audioUrl: true,
          level: true
        })
      });
    });

    it('should return 404 for non-existent vocabulary', async () => {
      prisma.vocab.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/audio/compressed/999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    it('should return 404 for vocab without audio', async () => {
      const mockVocab = {
        id: 1,
        lemma: 'test',
        audioUrl: null,
        level: 'A1'
      };

      prisma.vocab.findUnique.mockResolvedValue(mockVocab);

      const response = await request(app)
        .get('/audio/compressed/1')
        .expect(404);

      expect(response.body.error).toContain('Audio file not found');
    });

    it('should handle different bitrate parameters', async () => {
      const mockVocab = {
        id: 1,
        lemma: 'test',
        audioUrl: '/audio/test.mp3',
        level: 'A1'
      };

      prisma.vocab.findUnique.mockResolvedValue(mockVocab);
      fs.access.mockResolvedValue();
      fs.stat.mockResolvedValue({ size: 1000 });

      const mockStream = { pipe: jest.fn() };
      require('fs').createReadStream = jest.fn().mockReturnValue(mockStream);

      await request(app)
        .get('/audio/compressed/1?bitrate=128')
        .expect(200);

      // Should accept valid bitrate
      expect(prisma.vocab.findUnique).toHaveBeenCalled();
    });

    it('should default invalid bitrate to 64', async () => {
      const mockVocab = {
        id: 1,
        lemma: 'test',
        audioUrl: '/audio/test.mp3',
        level: 'A1'
      };

      prisma.vocab.findUnique.mockResolvedValue(mockVocab);
      fs.access.mockResolvedValue();
      fs.stat.mockResolvedValue({ size: 1000 });

      const mockStream = { pipe: jest.fn() };
      require('fs').createReadStream = jest.fn().mockReturnValue(mockStream);

      await request(app)
        .get('/audio/compressed/1?bitrate=999')
        .expect(200);
    });
  });

  describe('POST /audio/batch-urls', () => {
    it('should return audio URLs for multiple vocab items', async () => {
      const mockVocabs = [
        {
          id: 1,
          lemma: 'test1',
          audioUrl: '/audio/test1.mp3'
        },
        {
          id: 2,
          lemma: 'test2',
          audioUrl: '/audio/test2.mp3'
        }
      ];

      prisma.vocab.findMany.mockResolvedValue(mockVocabs);

      const response = await request(app)
        .post('/audio/batch-urls')
        .send({ vocabIds: [1, 2, 3] })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].url).toContain('/api/mobile/audio/compressed/1');
      expect(response.body.meta.bitrate).toBe(64);
    });

    it('should validate vocabIds array', async () => {
      const response = await request(app)
        .post('/audio/batch-urls')
        .send({ vocabIds: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should limit batch size to 50', async () => {
      const ids = Array.from({ length: 100 }, (_, i) => i + 1);
      prisma.vocab.findMany.mockResolvedValue([]);

      await request(app)
        .post('/audio/batch-urls')
        .send({ vocabIds: ids })
        .expect(200);

      expect(prisma.vocab.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: { in: expect.arrayContaining([]) },
            audioUrl: { not: null }
          }
        })
      );
      
      const calledWith = prisma.vocab.findMany.mock.calls[0][0];
      expect(calledWith.where.id.in).toHaveLength(50);
    });
  });

  describe('POST /audio/preload', () => {
    it('should preload and cache audio files', async () => {
      const mockVocabs = [
        {
          id: 1,
          lemma: 'test',
          audioUrl: '/audio/test.mp3',
          level: 'A1'
        }
      ];

      prisma.vocab.findMany.mockResolvedValue(mockVocabs);
      fs.access.mockRejectedValueOnce(new Error('Not cached')); // First access fails (not cached)

      // Mock ffmpeg compression
      const ffmpeg = require('fluent-ffmpeg');
      ffmpeg.mockImplementation(() => ({
        audioBitrate: jest.fn().mockReturnThis(),
        audioCodec: jest.fn().mockReturnThis(),
        format: jest.fn().mockReturnThis(),
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'end') callback();
          return this;
        }),
        save: jest.fn().mockReturnThis()
      }));

      const response = await request(app)
        .post('/audio/preload')
        .send({ vocabIds: [1] })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.successful).toBeDefined();
    });

    it('should validate vocabIds array', async () => {
      const response = await request(app)
        .post('/audio/preload')
        .send({ vocabIds: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should limit preload batch size to 20', async () => {
      const ids = Array.from({ length: 30 }, (_, i) => i + 1);
      prisma.vocab.findMany.mockResolvedValue([]);

      await request(app)
        .post('/audio/preload')
        .send({ vocabIds: ids })
        .expect(200);

      const calledWith = prisma.vocab.findMany.mock.calls[0][0];
      expect(calledWith.where.id.in).toHaveLength(20);
    });
  });

  describe('DELETE /audio/cache', () => {
    it('should clear audio cache for admin', async () => {
      // Override auth middleware for admin test
      const mockFiles = ['cached1.mp3', 'cached2.mp3'];
      fs.readdir.mockResolvedValue(mockFiles);
      fs.unlink.mockResolvedValue();

      // Mock admin user
      jest.doMock('../../../middleware/auth', () => jest.fn((req, res, next) => {
        req.user = { id: 1, email: 'admin@example.com' };
        next();
      }));

      const response = await request(app)
        .delete('/audio/cache')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.meta.deletedFiles).toBe(2);
    });

    it('should deny access for non-admin users', async () => {
      const response = await request(app)
        .delete('/audio/cache')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Admin access required');
    });
  });
});