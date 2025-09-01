const { prisma } = require('../lib/prismaClient');
const srsService = require('./srsService');

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

describe('SRS Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateNextReview', () => {
    it('should calculate next review for new card (interval 0)', () => {
      const result = srsService.calculateNextReview(0, 0, 2.5);
      
      expect(result.interval).toBe(0);
      expect(result.nextReview).toBeInstanceOf(Date);
      // New cards should be reviewed again immediately or in a few minutes
      const now = new Date();
      expect(result.nextReview.getTime()).toBeCloseTo(now.getTime(), -5);
    });

    it('should calculate next review for learning card', () => {
      const result = srsService.calculateNextReview(1, 1, 2.5);
      
      expect(result.interval).toBeGreaterThan(1);
      expect(result.nextReview).toBeInstanceOf(Date);
      
      // Check that next review is scheduled for future
      const now = new Date();
      expect(result.nextReview.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should calculate next review for mature card', () => {
      const result = srsService.calculateNextReview(21, 5, 2.5);
      
      expect(result.interval).toBeGreaterThan(21);
      expect(result.nextReview).toBeInstanceOf(Date);
      
      // Mature cards should have longer intervals
      const now = new Date();
      const daysDiff = (result.nextReview - now) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeGreaterThan(21);
    });

    it('should handle edge cases gracefully', () => {
      // Very high repetitions
      const result1 = srsService.calculateNextReview(365, 100, 2.5);
      expect(result1.interval).toBeGreaterThan(365);
      
      // Very low ease factor
      const result2 = srsService.calculateNextReview(1, 1, 1.3);
      expect(result2.interval).toBeGreaterThan(0);
      
      // Zero repetitions
      const result3 = srsService.calculateNextReview(0, 0, 2.5);
      expect(result3.interval).toBe(0);
    });
  });

  describe('updateEaseFactor', () => {
    it('should maintain ease factor for good performance (quality 3-5)', () => {
      expect(srsService.updateEaseFactor(2.5, 4)).toBeCloseTo(2.5, 1);
      expect(srsService.updateEaseFactor(2.5, 5)).toBeGreaterThan(2.5);
      expect(srsService.updateEaseFactor(2.5, 3)).toBeCloseTo(2.5, 1);
    });

    it('should decrease ease factor for poor performance (quality < 3)', () => {
      expect(srsService.updateEaseFactor(2.5, 2)).toBeLessThan(2.5);
      expect(srsService.updateEaseFactor(2.5, 1)).toBeLessThan(2.5);
      expect(srsService.updateEaseFactor(2.5, 0)).toBeLessThan(2.5);
    });

    it('should not let ease factor go below minimum', () => {
      const result = srsService.updateEaseFactor(1.3, 0);
      expect(result).toBe(1.3); // Minimum ease factor
    });

    it('should handle invalid quality scores', () => {
      expect(() => srsService.updateEaseFactor(2.5, -1)).toThrow();
      expect(() => srsService.updateEaseFactor(2.5, 6)).toThrow();
      expect(() => srsService.updateEaseFactor(2.5, 'invalid')).toThrow();
    });
  });

  describe('getDueCards', () => {
    it('should return cards due for review', async () => {
      const mockCards = [
        {
          id: 1,
          userId: 1,
          nextReview: new Date(Date.now() - 1000),
          vocab: { lemma: 'test' }
        }
      ];

      prisma.srsCard.findMany.mockResolvedValue(mockCards);

      const result = await srsService.getDueCards(1);

      expect(result).toEqual(mockCards);
      expect(prisma.srsCard.findMany).toHaveBeenCalledWith({
        where: {
          userId: 1,
          nextReview: { lte: expect.any(Date) }
        },
        include: {
          vocab: {
            include: { dictentry: true }
          }
        },
        orderBy: { nextReview: 'asc' }
      });
    });

    it('should limit results when limit is provided', async () => {
      prisma.srsCard.findMany.mockResolvedValue([]);

      await srsService.getDueCards(1, 10);

      expect(prisma.srsCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 })
      );
    });
  });

  describe('getCardStats', () => {
    it('should return card statistics grouped by interval', async () => {
      const mockStats = [
        { interval: 0, _count: { id: 5 } }, // New
        { interval: 1, _count: { id: 3 } }, // Learning
        { interval: 21, _count: { id: 10 } } // Mature
      ];

      prisma.srsCard.groupBy.mockResolvedValue(mockStats);

      const result = await srsService.getCardStats(1);

      expect(result).toEqual({
        new: 5,
        learning: 3,
        mature: 10,
        total: 18
      });
    });

    it('should handle empty statistics', async () => {
      prisma.srsCard.groupBy.mockResolvedValue([]);

      const result = await srsService.getCardStats(1);

      expect(result).toEqual({
        new: 0,
        learning: 0,
        mature: 0,
        total: 0
      });
    });
  });

  describe('processReview', () => {
    it('should process good review and advance card', async () => {
      const mockCard = {
        id: 1,
        userId: 1,
        interval: 1,
        repetitions: 0,
        easeFactor: 2.5
      };

      const updatedCard = {
        ...mockCard,
        interval: 6,
        repetitions: 1,
        easeFactor: 2.5,
        nextReview: expect.any(Date)
      };

      prisma.srsCard.findUnique.mockResolvedValue(mockCard);
      prisma.srsCard.update.mockResolvedValue(updatedCard);

      const result = await srsService.processReview(1, 1, 4);

      expect(result.interval).toBeGreaterThan(mockCard.interval);
      expect(result.repetitions).toBe(1);
      expect(prisma.srsCard.update).toHaveBeenCalled();
    });

    it('should process poor review and reset card', async () => {
      const mockCard = {
        id: 1,
        userId: 1,
        interval: 21,
        repetitions: 5,
        easeFactor: 2.5
      };

      prisma.srsCard.findUnique.mockResolvedValue(mockCard);
      prisma.srsCard.update.mockResolvedValue({
        ...mockCard,
        interval: 0,
        repetitions: 0,
        easeFactor: expect.any(Number)
      });

      const result = await srsService.processReview(1, 1, 1);

      expect(result.interval).toBe(0);
      expect(result.repetitions).toBe(0);
      expect(result.easeFactor).toBeLessThan(2.5);
    });

    it('should throw error if card not found', async () => {
      prisma.srsCard.findUnique.mockResolvedValue(null);

      await expect(srsService.processReview(1, 999, 4))
        .rejects.toThrow('SRS card not found');
    });

    it('should throw error if card belongs to different user', async () => {
      const mockCard = {
        id: 1,
        userId: 2, // Different user
        interval: 1,
        repetitions: 0,
        easeFactor: 2.5
      };

      prisma.srsCard.findUnique.mockResolvedValue(mockCard);

      await expect(srsService.processReview(1, 1, 4))
        .rejects.toThrow('Access denied');
    });
  });

  describe('createCard', () => {
    it('should create new SRS card successfully', async () => {
      const mockVocab = {
        id: 1,
        lemma: 'test',
        pos: 'noun'
      };

      const newCard = {
        id: 1,
        userId: 1,
        vocabId: 1,
        interval: 0,
        repetitions: 0,
        easeFactor: 2.5,
        nextReview: expect.any(Date)
      };

      prisma.vocab.findUnique.mockResolvedValue(mockVocab);
      prisma.srsCard.findUnique.mockResolvedValue(null);
      prisma.srsCard.create.mockResolvedValue(newCard);

      const result = await srsService.createCard(1, 1);

      expect(result).toEqual(newCard);
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

    it('should throw error if vocabulary not found', async () => {
      prisma.vocab.findUnique.mockResolvedValue(null);

      await expect(srsService.createCard(1, 999))
        .rejects.toThrow('Vocabulary not found');
    });

    it('should throw error if card already exists', async () => {
      const mockVocab = { id: 1, lemma: 'test' };
      const existingCard = { id: 1, userId: 1, vocabId: 1 };

      prisma.vocab.findUnique.mockResolvedValue(mockVocab);
      prisma.srsCard.findUnique.mockResolvedValue(existingCard);

      await expect(srsService.createCard(1, 1))
        .rejects.toThrow('SRS card already exists');
    });

    it('should allow creating card with folder', async () => {
      const mockVocab = { id: 1, lemma: 'test' };
      const mockFolder = { id: 1, userId: 1, name: 'Test Folder' };

      prisma.vocab.findUnique.mockResolvedValue(mockVocab);
      prisma.srsCard.findUnique.mockResolvedValue(null);
      prisma.srsFolder.findUnique.mockResolvedValue(mockFolder);
      prisma.srsCard.create.mockResolvedValue({ id: 1, folderId: 1 });

      await srsService.createCard(1, 1, 1);

      expect(prisma.srsCard.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          folderId: 1
        })
      });
    });
  });

  describe('deleteCard', () => {
    it('should delete SRS card successfully', async () => {
      const mockCard = {
        id: 1,
        userId: 1,
        vocabId: 1
      };

      prisma.srsCard.findUnique.mockResolvedValue(mockCard);
      prisma.srsCard.delete.mockResolvedValue(mockCard);

      const result = await srsService.deleteCard(1, 1);

      expect(result).toEqual(mockCard);
      expect(prisma.srsCard.delete).toHaveBeenCalledWith({
        where: { id: 1 }
      });
    });

    it('should throw error if card not found', async () => {
      prisma.srsCard.findUnique.mockResolvedValue(null);

      await expect(srsService.deleteCard(1, 999))
        .rejects.toThrow('SRS card not found');
    });

    it('should throw error if card belongs to different user', async () => {
      const mockCard = { id: 1, userId: 2 };

      prisma.srsCard.findUnique.mockResolvedValue(mockCard);

      await expect(srsService.deleteCard(1, 1))
        .rejects.toThrow('Access denied');
    });
  });

  describe('Algorithm Integration Tests', () => {
    it('should properly graduate a card from learning to mature', async () => {
      const learningCard = {
        id: 1,
        userId: 1,
        interval: 1,
        repetitions: 2,
        easeFactor: 2.5
      };

      prisma.srsCard.findUnique.mockResolvedValue(learningCard);

      let capturedUpdate;
      prisma.srsCard.update.mockImplementation((data) => {
        capturedUpdate = data.data;
        return Promise.resolve({ ...learningCard, ...data.data });
      });

      await srsService.processReview(1, 1, 4); // Good answer

      // Should graduate to mature (interval >= 21)
      expect(capturedUpdate.interval).toBeGreaterThanOrEqual(21);
      expect(capturedUpdate.repetitions).toBe(3);
    });

    it('should handle consistent good performance', async () => {
      let currentCard = {
        id: 1,
        userId: 1,
        interval: 1,
        repetitions: 0,
        easeFactor: 2.5
      };

      // Simulate multiple good reviews
      for (let i = 0; i < 5; i++) {
        prisma.srsCard.findUnique.mockResolvedValue(currentCard);
        prisma.srsCard.update.mockImplementation((data) => {
          currentCard = { ...currentCard, ...data.data };
          return Promise.resolve(currentCard);
        });

        await srsService.processReview(1, 1, 4);

        // Each review should increase interval and repetitions
        expect(currentCard.repetitions).toBe(i + 1);
        expect(currentCard.interval).toBeGreaterThan(0);
      }

      // After 5 good reviews, should be a mature card
      expect(currentCard.interval).toBeGreaterThan(20);
      expect(currentCard.easeFactor).toBeGreaterThanOrEqual(2.5);
    });

    it('should handle mixed performance realistically', async () => {
      let currentCard = {
        id: 1,
        userId: 1,
        interval: 21,
        repetitions: 10,
        easeFactor: 2.8
      };

      // Good review followed by poor review
      prisma.srsCard.findUnique.mockResolvedValue(currentCard);
      prisma.srsCard.update.mockImplementation((data) => {
        currentCard = { ...currentCard, ...data.data };
        return Promise.resolve(currentCard);
      });

      // Good review - should advance
      await srsService.processReview(1, 1, 5);
      const afterGood = { ...currentCard };

      // Poor review - should reset
      await srsService.processReview(1, 1, 1);

      expect(currentCard.interval).toBe(0); // Reset to learning
      expect(currentCard.repetitions).toBe(0);
      expect(currentCard.easeFactor).toBeLessThan(afterGood.easeFactor);
    });
  });

  describe('Performance Tests', () => {
    it('should handle bulk operations efficiently', async () => {
      const mockCards = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        userId: 1,
        nextReview: new Date(Date.now() - 1000)
      }));

      prisma.srsCard.findMany.mockResolvedValue(mockCards);

      const start = performance.now();
      const result = await srsService.getDueCards(1);
      const end = performance.now();

      expect(result).toHaveLength(100);
      expect(end - start).toBeLessThan(100); // Should complete in < 100ms
    });
  });
});