const request = require('supertest');
const express = require('express');
const { prisma } = require('../lib/prismaClient');
const srsRoutes = require('./srs');

const app = express();
app.use(express.json());

// Mock auth middleware
app.use((req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  next();
});

app.use('/srs', srsRoutes);

// Mock Prisma
jest.mock('../lib/prismaClient', () => ({
  prisma: {
    srsCard: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    srsFolder: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    vocab: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  }
}));

describe('SRS Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /srs/dashboard', () => {
    it('should get SRS dashboard data successfully', async () => {
      const mockStats = [
        { interval: 0, _count: { id: 5 } }, // New cards
        { interval: 1, _count: { id: 3 } }, // Learning cards
        { interval: 7, _count: { id: 10 } }, // Review cards
      ];

      const mockDueCards = [
        {
          id: 1,
          vocabId: 1,
          interval: 0,
          nextReview: new Date(),
          vocab: {
            lemma: 'test',
            pos: 'noun',
            dictentry: { gloss: 'test meaning' }
          }
        }
      ];

      prisma.srsCard.groupBy.mockResolvedValue(mockStats);
      prisma.srsCard.findMany.mockResolvedValue(mockDueCards);

      const response = await request(app)
        .get('/srs/dashboard')
        .expect(200);

      expect(response.body.stats).toBeDefined();
      expect(response.body.dueCards).toHaveLength(1);
    });
  });

  describe('GET /srs/cards', () => {
    it('should get user SRS cards', async () => {
      const mockCards = [
        {
          id: 1,
          userId: 1,
          vocabId: 1,
          interval: 1,
          easeFactor: 2.5,
          nextReview: new Date(),
          vocab: {
            lemma: 'example',
            pos: 'noun',
            dictentry: { gloss: 'sample' }
          }
        }
      ];

      prisma.srsCard.findMany.mockResolvedValue(mockCards);

      const response = await request(app)
        .get('/srs/cards')
        .expect(200);

      expect(response.body.cards).toHaveLength(1);
      expect(response.body.cards[0].vocab.lemma).toBe('example');
    });

    it('should filter cards by folder if provided', async () => {
      const mockCards = [];
      prisma.srsCard.findMany.mockResolvedValue(mockCards);

      await request(app)
        .get('/srs/cards?folderId=1')
        .expect(200);

      expect(prisma.srsCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            folderId: 1
          })
        })
      );
    });
  });

  describe('POST /srs/cards', () => {
    it('should create new SRS card successfully', async () => {
      const mockVocab = {
        id: 1,
        lemma: 'new',
        pos: 'adjective'
      };

      const mockCard = {
        id: 1,
        userId: 1,
        vocabId: 1,
        interval: 0,
        easeFactor: 2.5,
        nextReview: new Date()
      };

      prisma.vocab.findUnique.mockResolvedValue(mockVocab);
      prisma.srsCard.findUnique.mockResolvedValue(null); // Not exists
      prisma.srsCard.create.mockResolvedValue(mockCard);

      const response = await request(app)
        .post('/srs/cards')
        .send({ vocabId: 1 })
        .expect(201);

      expect(response.body.card).toBeDefined();
      expect(prisma.srsCard.create).toHaveBeenCalledWith({
        data: {
          userId: 1,
          vocabId: 1,
          interval: 0,
          repetitions: 0,
          easeFactor: 2.5,
          nextReview: expect.any(Date)
        }
      });
    });

    it('should return error if vocabulary not found', async () => {
      prisma.vocab.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/srs/cards')
        .send({ vocabId: 999 })
        .expect(404);

      expect(response.body.error).toBe('Vocabulary not found');
    });

    it('should return error if card already exists', async () => {
      const mockVocab = { id: 1, lemma: 'existing' };
      const existingCard = { id: 1, vocabId: 1, userId: 1 };

      prisma.vocab.findUnique.mockResolvedValue(mockVocab);
      prisma.srsCard.findUnique.mockResolvedValue(existingCard);

      const response = await request(app)
        .post('/srs/cards')
        .send({ vocabId: 1 })
        .expect(409);

      expect(response.body.error).toBe('SRS card already exists for this vocabulary');
    });
  });

  describe('PUT /srs/cards/:cardId/review', () => {
    it('should update card on successful review', async () => {
      const mockCard = {
        id: 1,
        userId: 1,
        vocabId: 1,
        interval: 1,
        repetitions: 0,
        easeFactor: 2.5,
        nextReview: new Date()
      };

      const updatedCard = {
        ...mockCard,
        interval: 3,
        repetitions: 1,
        nextReview: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      };

      prisma.srsCard.findUnique.mockResolvedValue(mockCard);
      prisma.srsCard.update.mockResolvedValue(updatedCard);

      const response = await request(app)
        .put('/srs/cards/1/review')
        .send({ quality: 4 })
        .expect(200);

      expect(response.body.card.interval).toBeGreaterThan(mockCard.interval);
      expect(prisma.srsCard.update).toHaveBeenCalled();
    });

    it('should reset card on poor review', async () => {
      const mockCard = {
        id: 1,
        userId: 1,
        interval: 7,
        repetitions: 3,
        easeFactor: 2.5
      };

      const resetCard = {
        ...mockCard,
        interval: 0,
        repetitions: 0,
        easeFactor: Math.max(1.3, 2.5 - 0.8)
      };

      prisma.srsCard.findUnique.mockResolvedValue(mockCard);
      prisma.srsCard.update.mockResolvedValue(resetCard);

      const response = await request(app)
        .put('/srs/cards/1/review')
        .send({ quality: 1 })
        .expect(200);

      expect(response.body.card.interval).toBe(0);
    });

    it('should return error for invalid quality score', async () => {
      const response = await request(app)
        .put('/srs/cards/1/review')
        .send({ quality: 6 })
        .expect(400);

      expect(response.body.error).toBe('Quality score must be between 0 and 5');
    });

    it('should return error if card not found', async () => {
      prisma.srsCard.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .put('/srs/cards/999/review')
        .send({ quality: 3 })
        .expect(404);

      expect(response.body.error).toBe('SRS card not found');
    });
  });

  describe('DELETE /srs/cards/:cardId', () => {
    it('should delete SRS card successfully', async () => {
      const mockCard = {
        id: 1,
        userId: 1,
        vocabId: 1
      };

      prisma.srsCard.findUnique.mockResolvedValue(mockCard);
      prisma.srsCard.delete.mockResolvedValue(mockCard);

      const response = await request(app)
        .delete('/srs/cards/1')
        .expect(200);

      expect(response.body.message).toBe('SRS card deleted successfully');
      expect(prisma.srsCard.delete).toHaveBeenCalledWith({
        where: { id: 1 }
      });
    });

    it('should return error if card not found', async () => {
      prisma.srsCard.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .delete('/srs/cards/999')
        .expect(404);

      expect(response.body.error).toBe('SRS card not found');
    });
  });

  describe('GET /srs/folders', () => {
    it('should get user SRS folders', async () => {
      const mockFolders = [
        {
          id: 1,
          userId: 1,
          name: 'Test Folder',
          description: 'Test description',
          createdAt: new Date(),
          _count: { cards: 5 }
        }
      ];

      prisma.srsFolder.findMany.mockResolvedValue(mockFolders);

      const response = await request(app)
        .get('/srs/folders')
        .expect(200);

      expect(response.body.folders).toHaveLength(1);
      expect(response.body.folders[0].name).toBe('Test Folder');
    });
  });

  describe('POST /srs/folders', () => {
    it('should create new SRS folder successfully', async () => {
      const newFolder = {
        id: 1,
        userId: 1,
        name: 'New Folder',
        description: 'New description'
      };

      prisma.srsFolder.create.mockResolvedValue(newFolder);

      const response = await request(app)
        .post('/srs/folders')
        .send({
          name: 'New Folder',
          description: 'New description'
        })
        .expect(201);

      expect(response.body.folder.name).toBe('New Folder');
      expect(prisma.srsFolder.create).toHaveBeenCalledWith({
        data: {
          userId: 1,
          name: 'New Folder',
          description: 'New description'
        }
      });
    });

    it('should require folder name', async () => {
      const response = await request(app)
        .post('/srs/folders')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Folder name is required');
    });
  });

  describe('PUT /srs/folders/:folderId', () => {
    it('should update SRS folder successfully', async () => {
      const mockFolder = {
        id: 1,
        userId: 1,
        name: 'Old Name'
      };

      const updatedFolder = {
        ...mockFolder,
        name: 'Updated Name',
        description: 'Updated description'
      };

      prisma.srsFolder.findUnique.mockResolvedValue(mockFolder);
      prisma.srsFolder.update.mockResolvedValue(updatedFolder);

      const response = await request(app)
        .put('/srs/folders/1')
        .send({
          name: 'Updated Name',
          description: 'Updated description'
        })
        .expect(200);

      expect(response.body.folder.name).toBe('Updated Name');
    });

    it('should return error if folder not found', async () => {
      prisma.srsFolder.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .put('/srs/folders/999')
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body.error).toBe('Folder not found');
    });
  });

  describe('DELETE /srs/folders/:folderId', () => {
    it('should delete SRS folder successfully', async () => {
      const mockFolder = {
        id: 1,
        userId: 1,
        name: 'To Delete'
      };

      prisma.srsFolder.findUnique.mockResolvedValue(mockFolder);
      prisma.srsFolder.delete.mockResolvedValue(mockFolder);

      const response = await request(app)
        .delete('/srs/folders/1')
        .expect(200);

      expect(response.body.message).toBe('Folder deleted successfully');
    });
  });
});