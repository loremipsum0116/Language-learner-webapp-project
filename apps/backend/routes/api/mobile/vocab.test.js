const request = require('supertest');
const express = require('express');
const vocabRouter = require('./vocab');
const { prisma } = require('../../../lib/prismaClient');
const authMiddleware = require('../../../middleware/auth');

jest.mock('../../../lib/prismaClient', () => ({
  prisma: {
    vocab: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn()
    },
    srsCard: {
      findMany: jest.fn()
    }
  }
}));

jest.mock('../../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  next();
}));

jest.mock('../../../utils/responseFormatter', () => ({
  success: (data, meta) => ({ success: true, data, meta })
}));

const app = express();
app.use(express.json());
app.use('/vocab', vocabRouter);

// Add response formatter middleware
app.use((req, res, next) => {
  res.success = (data, meta) => res.json({ success: true, data, meta });
  res.paginated = (data, page, limit, total, meta) => res.json({
    success: true,
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    meta
  });
  res.validationError = (errors) => res.status(400).json({ success: false, errors });
  res.serverError = (message) => res.status(500).json({ success: false, error: message });
  next();
});

describe('Mobile Vocab API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /vocab/paginated', () => {
    it('should return paginated vocabulary with default parameters', async () => {
      const mockVocabs = [
        {
          id: 1,
          lemma: 'test',
          level: 'A1',
          pos: 'noun',
          dictentry: {
            gloss: 'a test',
            koGloss: '테스트',
            examples: [
              { example: 'This is a test', translation: '이것은 테스트다' }
            ]
          },
          userVocabs: [{
            learningLevel: 1,
            reviewCount: 5,
            nextReviewAt: new Date(),
            isLearned: false
          }],
          examCategories: [{ name: 'TOEFL' }],
          audioUrl: '/audio/test.mp3'
        }
      ];

      prisma.vocab.findMany.mockResolvedValue(mockVocabs);
      prisma.vocab.count.mockResolvedValue(100);

      const response = await request(app)
        .get('/vocab/paginated')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].word).toBe('test');
      expect(response.body.data[0].meaning).toBe('테스트');
      expect(response.body.pagination.total).toBe(100);
    });

    it('should handle search parameter', async () => {
      prisma.vocab.findMany.mockResolvedValue([]);
      prisma.vocab.count.mockResolvedValue(0);

      await request(app)
        .get('/vocab/paginated?search=test')
        .expect(200);

      expect(prisma.vocab.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { lemma: { contains: 'test', mode: 'insensitive' } }
            ])
          })
        })
      );
    });

    it('should handle level filter', async () => {
      prisma.vocab.findMany.mockResolvedValue([]);
      prisma.vocab.count.mockResolvedValue(0);

      await request(app)
        .get('/vocab/paginated?level=A1')
        .expect(200);

      expect(prisma.vocab.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            level: 'A1'
          })
        })
      );
    });

    it('should handle cursor-based pagination', async () => {
      prisma.vocab.findMany.mockResolvedValue([]);
      prisma.vocab.count.mockResolvedValue(0);

      await request(app)
        .get('/vocab/paginated?cursor=5')
        .expect(200);

      expect(prisma.vocab.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 5 },
          skip: 1
        })
      );
    });
  });

  describe('POST /vocab/batch', () => {
    it('should return vocabulary items by IDs', async () => {
      const mockVocabs = [
        {
          id: 1,
          lemma: 'test',
          level: 'A1',
          pos: 'noun',
          dictentry: {
            gloss: 'a test',
            koGloss: '테스트',
            examples: []
          },
          userVocabs: [],
          audioUrl: null
        }
      ];

      prisma.vocab.findMany.mockResolvedValue(mockVocabs);

      const response = await request(app)
        .post('/vocab/batch')
        .send({ ids: [1, 2, 3] })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(prisma.vocab.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: [1, 2, 3] } }
        })
      );
    });

    it('should validate IDs array', async () => {
      const response = await request(app)
        .post('/vocab/batch')
        .send({ ids: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should limit batch size to 100', async () => {
      const ids = Array.from({ length: 150 }, (_, i) => i + 1);
      prisma.vocab.findMany.mockResolvedValue([]);

      await request(app)
        .post('/vocab/batch')
        .send({ ids })
        .expect(200);

      expect(prisma.vocab.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: expect.arrayContaining([]) } }
        })
      );
      
      const calledWith = prisma.vocab.findMany.mock.calls[0][0];
      expect(calledWith.where.id.in).toHaveLength(100);
    });
  });

  describe('GET /vocab/search', () => {
    it('should search vocabulary by query', async () => {
      const mockVocabs = [
        {
          id: 1,
          lemma: 'test',
          level: 'A1',
          dictentry: {
            gloss: 'a test',
            koGloss: '테스트'
          }
        }
      ];

      prisma.vocab.findMany.mockResolvedValue(mockVocabs);

      const response = await request(app)
        .get('/vocab/search?q=test')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].word).toBe('test');
    });

    it('should validate query length', async () => {
      const response = await request(app)
        .get('/vocab/search?q=t')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should limit results', async () => {
      prisma.vocab.findMany.mockResolvedValue([]);

      await request(app)
        .get('/vocab/search?q=test&limit=5')
        .expect(200);

      expect(prisma.vocab.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5
        })
      );
    });
  });
});