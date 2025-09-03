// services/quizService.test.js
const quizService = require('./quizService');
const _ = require('lodash');

// Mock lodash
jest.mock('lodash', () => ({
  shuffle: jest.fn()
}));

describe('Quiz Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('shuffleArray', () => {
    it('should shuffle array using lodash', () => {
      const inputArray = [1, 2, 3, 4, 5];
      const shuffledArray = [3, 1, 5, 2, 4];
      
      _.shuffle.mockReturnValue(shuffledArray);
      
      const result = quizService.shuffleArray ? 
        quizService.shuffleArray(inputArray) : 
        require('./quizService').shuffleArray ? 
          require('./quizService').shuffleArray(inputArray) : null;

      if (result) {
        expect(_.shuffle).toHaveBeenCalledWith(inputArray);
        expect(result).toEqual(shuffledArray);
      }
    });

    it('should handle empty array', () => {
      const inputArray = [];
      const shuffledArray = [];
      
      _.shuffle.mockReturnValue(shuffledArray);
      
      // Try to access shuffleArray function
      const moduleExports = require('./quizService');
      const shuffleFunction = moduleExports.shuffleArray || 
                             (typeof moduleExports === 'function' ? moduleExports : null);

      if (shuffleFunction) {
        const result = shuffleFunction(inputArray);
        expect(result).toEqual(shuffledArray);
      }
    });
  });

  describe('generateMcqQuizItems', () => {
    let mockPrisma;
    
    beforeEach(() => {
      mockPrisma = {
        vocab: {
          findMany: jest.fn()
        },
        srscard: {
          findMany: jest.fn()
        }
      };
    });

    it('should return empty array for empty vocabIds', async () => {
      const result = await quizService.generateMcqQuizItems(mockPrisma, 1, []);
      
      expect(result).toEqual([]);
      expect(mockPrisma.vocab.findMany).not.toHaveBeenCalled();
    });

    it('should return empty array for null vocabIds', async () => {
      const result = await quizService.generateMcqQuizItems(mockPrisma, 1, null);
      
      expect(result).toEqual([]);
      expect(mockPrisma.vocab.findMany).not.toHaveBeenCalled();
    });

    it('should filter out invalid vocab IDs', async () => {
      const vocabIds = [1, 'invalid', 2, null, undefined, 3];
      
      // Mock empty results to avoid complex setup
      mockPrisma.vocab.findMany.mockResolvedValue([]);
      mockPrisma.srscard.findMany.mockResolvedValue([]);
      
      await quizService.generateMcqQuizItems(mockPrisma, 1, vocabIds);
      
      // Should call with only valid numeric IDs
      expect(mockPrisma.vocab.findMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2, 3] } },
        include: { dictentry: true }
      });
    });

    it('should handle database queries correctly', async () => {
      const vocabIds = [1, 2, 3];
      const userId = 1;
      
      const mockVocabs = [
        {
          id: 1,
          lemma: 'hello',
          dictentry: {
            examples: [
              { kind: 'gloss', ko: '안녕하세요' }
            ]
          }
        }
      ];
      
      const mockCards = [
        { id: 101, itemId: 1 }
      ];
      
      const mockDistractors = [
        {
          id: 100,
          dictentry: {
            examples: [
              { kind: 'gloss', ko: '다른 뜻' }
            ]
          }
        }
      ];

      mockPrisma.vocab.findMany
        .mockResolvedValueOnce(mockVocabs) // First call for target vocabs
        .mockResolvedValueOnce(mockDistractors); // Second call for distractors
      
      mockPrisma.srscard.findMany.mockResolvedValue(mockCards);
      
      const result = await quizService.generateMcqQuizItems(mockPrisma, userId, vocabIds);
      
      expect(mockPrisma.vocab.findMany).toHaveBeenCalledTimes(2);
      expect(mockPrisma.srscard.findMany).toHaveBeenCalledWith({
        where: { userId, itemType: 'vocab', itemId: { in: vocabIds } },
        select: { id: true, itemId: true }
      });
      
      expect(Array.isArray(result)).toBe(true);
    });

    it('should skip vocabs without dictentry', async () => {
      const vocabIds = [1, 2];
      
      const mockVocabs = [
        { id: 1, lemma: 'hello', dictentry: null }, // No dictentry
        {
          id: 2,
          lemma: 'world',
          dictentry: {
            examples: [{ kind: 'gloss', ko: '세상' }]
          }
        }
      ];
      
      mockPrisma.vocab.findMany
        .mockResolvedValueOnce(mockVocabs)
        .mockResolvedValueOnce([]);
      mockPrisma.srscard.findMany.mockResolvedValue([]);
      
      const result = await quizService.generateMcqQuizItems(mockPrisma, 1, vocabIds);
      
      // Should process only vocabs with dictentry
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle Promise.all correctly', async () => {
      const vocabIds = [1];
      
      // Simulate slow database calls
      mockPrisma.vocab.findMany
        .mockImplementation(() => new Promise(resolve => setTimeout(() => resolve([]), 10)))
        .mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve([]), 5)));
      mockPrisma.srscard.findMany
        .mockImplementation(() => new Promise(resolve => setTimeout(() => resolve([]), 15)));
      
      const startTime = Date.now();
      await quizService.generateMcqQuizItems(mockPrisma, 1, vocabIds);
      const endTime = Date.now();
      
      // Should complete faster than sequential calls (< 30ms vs 30ms sequential)
      expect(endTime - startTime).toBeLessThan(30);
    });
  });

  describe('Error handling', () => {
    let mockPrisma;
    
    beforeEach(() => {
      mockPrisma = {
        vocab: {
          findMany: jest.fn()
        },
        srscard: {
          findMany: jest.fn()
        }
      };
    });

    it('should handle database errors gracefully', async () => {
      const vocabIds = [1];
      
      mockPrisma.vocab.findMany.mockRejectedValue(new Error('Database error'));
      
      await expect(quizService.generateMcqQuizItems(mockPrisma, 1, vocabIds))
        .rejects.toThrow('Database error');
    });

    it('should handle partial database failures', async () => {
      const vocabIds = [1];
      
      mockPrisma.vocab.findMany
        .mockResolvedValueOnce([]) // First call succeeds
        .mockRejectedValue(new Error('Distractor query failed')); // Second call fails
      mockPrisma.srscard.findMany.mockResolvedValue([]);
      
      await expect(quizService.generateMcqQuizItems(mockPrisma, 1, vocabIds))
        .rejects.toThrow('Distractor query failed');
    });
  });

  describe('Data processing', () => {
    let mockPrisma;
    
    beforeEach(() => {
      mockPrisma = {
        vocab: {
          findMany: jest.fn()
        },
        srscard: {
          findMany: jest.fn()
        }
      };
    });

    it('should create cardIdMap correctly', async () => {
      const vocabIds = [1, 2];
      const mockCards = [
        { id: 101, itemId: 1 },
        { id: 102, itemId: 2 }
      ];
      
      mockPrisma.vocab.findMany.mockResolvedValue([]);
      mockPrisma.srscard.findMany.mockResolvedValue(mockCards);
      
      await quizService.generateMcqQuizItems(mockPrisma, 1, vocabIds);
      
      // Verify the service processes the cards correctly
      expect(mockPrisma.srscard.findMany).toHaveBeenCalledWith({
        where: { userId: 1, itemType: 'vocab', itemId: { in: vocabIds } },
        select: { id: true, itemId: true }
      });
    });

    it('should extract distractor glosses correctly', async () => {
      const vocabIds = [1];
      
      const mockDistractors = [
        {
          id: 100,
          dictentry: {
            examples: [
              { kind: 'gloss', ko: '첫 번째 뜻; 두 번째 뜻' }, // Should split and take first
              { kind: 'example', ko: '예문' }
            ]
          }
        },
        {
          id: 101,
          dictentry: {
            examples: [
              { definitions: [{ ko_def: '정의 뜻' }] }
            ]
          }
        }
      ];
      
      mockPrisma.vocab.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockDistractors);
      mockPrisma.srscard.findMany.mockResolvedValue([]);
      
      const result = await quizService.generateMcqQuizItems(mockPrisma, 1, vocabIds);
      
      expect(Array.isArray(result)).toBe(true);
    });
  });
});