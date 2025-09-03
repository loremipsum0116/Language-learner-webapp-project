const request = require('supertest');
const express = require('express');
const { prisma } = require('../lib/prismaClient');
const vocabRoutes = require('./vocab');
const authMiddleware = require('../middleware/auth');

const app = express();
app.use(express.json());

// Mock auth middleware
app.use((req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  next();
});

app.use('/vocab', vocabRoutes);

// Mock Prisma
jest.mock('../lib/prismaClient', () => ({
  prisma: {
    vocab: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    dictentry: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    userVocab: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  }
}));

describe('Vocab Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /vocab/search', () => {
    it('should search vocabularies successfully', async () => {
      const mockVocabs = [
        {
          id: 1,
          lemma: 'test',
          pos: 'noun',
          levelCEFR: 'A1',
          dictentry: {
            id: 1,
            gloss: 'test meaning'
          }
        }
      ];

      prisma.vocab.findMany.mockResolvedValue(mockVocabs);
      prisma.vocab.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/vocab/search?q=test')
        .expect(200);

      expect(response.body.vocabularies).toHaveLength(1);
      expect(response.body.vocabularies[0].lemma).toBe('test');
      expect(response.body.total).toBe(1);
    });

    it('should return empty results when no query provided', async () => {
      const response = await request(app)
        .get('/vocab/search')
        .expect(200);

      expect(response.body.vocabularies).toHaveLength(0);
      expect(response.body.total).toBe(0);
    });
  });

  describe('GET /vocab/:id', () => {
    it('should get vocabulary by id successfully', async () => {
      const mockVocab = {
        id: 1,
        lemma: 'test',
        pos: 'noun',
        levelCEFR: 'A1',
        dictentry: {
          id: 1,
          gloss: 'test meaning',
          examples: []
        }
      };

      prisma.vocab.findUnique.mockResolvedValue(mockVocab);

      const response = await request(app)
        .get('/vocab/1')
        .expect(200);

      expect(response.body.vocab.lemma).toBe('test');
      expect(response.body.vocab.pos).toBe('noun');
    });

    it('should return 404 for non-existent vocabulary', async () => {
      prisma.vocab.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/vocab/999')
        .expect(404);

      expect(response.body.error).toBe('Vocabulary not found');
    });
  });

  describe('POST /vocab/add-to-wordbook', () => {
    it('should add vocabulary to user wordbook successfully', async () => {
      const mockUserVocab = {
        id: 1,
        userId: 1,
        vocabId: 1,
        addedAt: new Date(),
        progress: 0
      };

      prisma.userVocab.findUnique.mockResolvedValue(null); // Not already added
      prisma.userVocab.create.mockResolvedValue(mockUserVocab);

      const response = await request(app)
        .post('/vocab/add-to-wordbook')
        .send({ vocabId: 1 })
        .expect(200);

      expect(response.body.message).toBe('Vocabulary added to wordbook');
      expect(prisma.userVocab.create).toHaveBeenCalledWith({
        data: {
          userId: 1,
          vocabId: 1
        }
      });
    });

    it('should return error if vocabulary already in wordbook', async () => {
      const existingUserVocab = {
        id: 1,
        userId: 1,
        vocabId: 1
      };

      prisma.userVocab.findUnique.mockResolvedValue(existingUserVocab);

      const response = await request(app)
        .post('/vocab/add-to-wordbook')
        .send({ vocabId: 1 })
        .expect(400);

      expect(response.body.error).toBe('Vocabulary already in wordbook');
      expect(prisma.userVocab.create).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /vocab/remove-from-wordbook/:vocabId', () => {
    it('should remove vocabulary from wordbook successfully', async () => {
      const existingUserVocab = {
        id: 1,
        userId: 1,
        vocabId: 1
      };

      prisma.userVocab.findUnique.mockResolvedValue(existingUserVocab);
      prisma.userVocab.delete.mockResolvedValue(existingUserVocab);

      const response = await request(app)
        .delete('/vocab/remove-from-wordbook/1')
        .expect(200);

      expect(response.body.message).toBe('Vocabulary removed from wordbook');
      expect(prisma.userVocab.delete).toHaveBeenCalledWith({
        where: { id: 1 }
      });
    });

    it('should return error if vocabulary not in wordbook', async () => {
      prisma.userVocab.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .delete('/vocab/remove-from-wordbook/1')
        .expect(404);

      expect(response.body.error).toBe('Vocabulary not found in wordbook');
      expect(prisma.userVocab.delete).not.toHaveBeenCalled();
    });
  });

  describe('GET /vocab/levels/:level', () => {
    it('should get vocabularies by CEFR level successfully', async () => {
      const mockVocabs = [
        {
          id: 1,
          lemma: 'basic',
          pos: 'adjective',
          levelCEFR: 'A1',
          dictentry: {
            gloss: 'fundamental'
          }
        },
        {
          id: 2,
          lemma: 'simple',
          pos: 'adjective',
          levelCEFR: 'A1',
          dictentry: {
            gloss: 'easy'
          }
        }
      ];

      prisma.vocab.findMany.mockResolvedValue(mockVocabs);

      const response = await request(app)
        .get('/vocab/levels/A1')
        .expect(200);

      expect(response.body.vocabularies).toHaveLength(2);
      expect(response.body.vocabularies.every(v => v.levelCEFR === 'A1')).toBe(true);
      expect(prisma.vocab.findMany).toHaveBeenCalledWith({
        where: { levelCEFR: 'A1' },
        include: { dictentry: true },
        orderBy: { lemma: 'asc' }
      });
    });

    it('should return empty array for invalid level', async () => {
      prisma.vocab.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/vocab/levels/INVALID')
        .expect(200);

      expect(response.body.vocabularies).toHaveLength(0);
    });
  });

  describe('GET /vocab/random/:level', () => {
    it('should get random vocabularies by level', async () => {
      const mockVocabs = [
        {
          id: 1,
          lemma: 'random1',
          pos: 'noun',
          levelCEFR: 'A2',
          dictentry: { gloss: 'meaning1' }
        },
        {
          id: 2,
          lemma: 'random2',
          pos: 'verb',
          levelCEFR: 'A2',
          dictentry: { gloss: 'meaning2' }
        }
      ];

      prisma.vocab.findMany.mockResolvedValue(mockVocabs);

      const response = await request(app)
        .get('/vocab/random/A2?count=2')
        .expect(200);

      expect(response.body.vocabularies).toHaveLength(2);
      expect(prisma.vocab.findMany).toHaveBeenCalledWith({
        where: { levelCEFR: 'A2' },
        include: { dictentry: true },
        take: 2,
        skip: expect.any(Number)
      });
    });

    it('should use default count when not specified', async () => {
      prisma.vocab.findMany.mockResolvedValue([]);

      await request(app)
        .get('/vocab/random/A1')
        .expect(200);

      expect(prisma.vocab.findMany).toHaveBeenCalledWith({
        where: { levelCEFR: 'A1' },
        include: { dictentry: true },
        take: 10,
        skip: expect.any(Number)
      });
    });
  });

  describe('GET /vocab/user/wordbook', () => {
    it('should get user wordbook vocabularies', async () => {
      const mockUserVocabs = [
        {
          id: 1,
          userId: 1,
          vocabId: 1,
          addedAt: new Date(),
          vocab: {
            id: 1,
            lemma: 'saved',
            pos: 'verb',
            levelCEFR: 'B1',
            dictentry: {
              gloss: 'stored'
            }
          }
        }
      ];

      prisma.userVocab.findMany.mockResolvedValue(mockUserVocabs);

      const response = await request(app)
        .get('/vocab/user/wordbook')
        .expect(200);

      expect(response.body.wordbook).toHaveLength(1);
      expect(response.body.wordbook[0].vocab.lemma).toBe('saved');
      expect(prisma.userVocab.findMany).toHaveBeenCalledWith({
        where: { userId: 1 },
        include: {
          vocab: {
            include: { dictentry: true }
          }
        },
        orderBy: { addedAt: 'desc' }
      });
    });

    it('should return empty wordbook for new user', async () => {
      prisma.userVocab.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/vocab/user/wordbook')
        .expect(200);

      expect(response.body.wordbook).toHaveLength(0);
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      prisma.vocab.findMany.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/vocab/search?q=test')
        .expect(500);

      expect(response.body.error).toBe('Internal server error');
    });

    it('should handle invalid JSON input', async () => {
      const response = await request(app)
        .post('/vocab/add-to-wordbook')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);
    });
  });
});