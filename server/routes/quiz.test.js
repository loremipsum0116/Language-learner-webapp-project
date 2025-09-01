const request = require('supertest');
const express = require('express');
const { prisma } = require('../lib/prismaClient');
const quizRoutes = require('./quiz');

const app = express();
app.use(express.json());

// Mock auth middleware
app.use((req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  next();
});

app.use('/quiz', quizRoutes);

// Mock Prisma
jest.mock('../lib/prismaClient', () => ({
  prisma: {
    vocab: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    quizResult: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    userProgress: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  }
}));

describe('Quiz Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /quiz/generate', () => {
    it('should generate quiz questions successfully', async () => {
      const mockVocabs = [
        {
          id: 1,
          lemma: 'apple',
          pos: 'noun',
          levelCEFR: 'A1',
          dictentry: {
            id: 1,
            gloss: '사과',
            examples: []
          }
        },
        {
          id: 2,
          lemma: 'book',
          pos: 'noun',
          levelCEFR: 'A1',
          dictentry: {
            id: 2,
            gloss: '책',
            examples: []
          }
        },
        {
          id: 3,
          lemma: 'cat',
          pos: 'noun',
          levelCEFR: 'A1',
          dictentry: {
            id: 3,
            gloss: '고양이',
            examples: []
          }
        },
        {
          id: 4,
          lemma: 'dog',
          pos: 'noun',
          levelCEFR: 'A1',
          dictentry: {
            id: 4,
            gloss: '개',
            examples: []
          }
        }
      ];

      prisma.vocab.findMany.mockResolvedValue(mockVocabs);

      const response = await request(app)
        .get('/quiz/generate?level=A1&count=2&type=multiple_choice')
        .expect(200);

      expect(response.body.questions).toHaveLength(2);
      expect(response.body.questions[0]).toHaveProperty('question');
      expect(response.body.questions[0]).toHaveProperty('options');
      expect(response.body.questions[0]).toHaveProperty('correctAnswer');
      expect(response.body.questions[0].options).toHaveLength(4);
    });

    it('should generate fill-in-the-blank questions', async () => {
      const mockVocabs = [
        {
          id: 1,
          lemma: 'beautiful',
          pos: 'adjective',
          levelCEFR: 'A2',
          dictentry: {
            gloss: '아름다운',
            examples: [
              {
                kind: 'example',
                en: 'She is very beautiful.',
                ko: '그녀는 매우 아름답다.'
              }
            ]
          }
        }
      ];

      prisma.vocab.findMany.mockResolvedValue(mockVocabs);

      const response = await request(app)
        .get('/quiz/generate?level=A2&count=1&type=fill_blank')
        .expect(200);

      expect(response.body.questions).toHaveLength(1);
      expect(response.body.questions[0]).toHaveProperty('sentence');
      expect(response.body.questions[0]).toHaveProperty('correctAnswer');
      expect(response.body.questions[0].sentence).toContain('___');
    });

    it('should return error when not enough vocabularies', async () => {
      prisma.vocab.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/quiz/generate?level=C2&count=10&type=multiple_choice')
        .expect(400);

      expect(response.body.error).toBe('Not enough vocabularies available for quiz generation');
    });

    it('should use default parameters when not provided', async () => {
      const mockVocabs = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        lemma: `word${i + 1}`,
        pos: 'noun',
        levelCEFR: 'A1',
        dictentry: {
          gloss: `meaning${i + 1}`,
          examples: []
        }
      }));

      prisma.vocab.findMany.mockResolvedValue(mockVocabs);

      const response = await request(app)
        .get('/quiz/generate')
        .expect(200);

      expect(response.body.questions).toHaveLength(10); // default count
      expect(prisma.vocab.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            levelCEFR: 'A1' // default level
          })
        })
      );
    });
  });

  describe('POST /quiz/submit', () => {
    it('should submit quiz results successfully', async () => {
      const quizSubmission = {
        quizId: 'quiz_123',
        answers: [
          { questionId: 1, selectedAnswer: '사과', isCorrect: true },
          { questionId: 2, selectedAnswer: '개', isCorrect: false }
        ],
        level: 'A1',
        quizType: 'multiple_choice',
        score: 1,
        totalQuestions: 2
      };

      const mockQuizResult = {
        id: 1,
        userId: 1,
        ...quizSubmission,
        completedAt: new Date()
      };

      const mockUserProgress = {
        userId: 1,
        level: 'A1',
        completedQuizzes: 1,
        totalScore: 1,
        averageScore: 50.0
      };

      prisma.quizResult.create.mockResolvedValue(mockQuizResult);
      prisma.userProgress.upsert.mockResolvedValue(mockUserProgress);
      prisma.$transaction.mockImplementation(async (callback) => {
        return callback(prisma);
      });

      const response = await request(app)
        .post('/quiz/submit')
        .send(quizSubmission)
        .expect(200);

      expect(response.body.result.score).toBe(1);
      expect(response.body.result.totalQuestions).toBe(2);
      expect(response.body.progress.completedQuizzes).toBe(1);
      expect(prisma.quizResult.create).toHaveBeenCalledWith({
        data: {
          userId: 1,
          quizId: 'quiz_123',
          answers: expect.any(Array),
          level: 'A1',
          quizType: 'multiple_choice',
          score: 1,
          totalQuestions: 2
        }
      });
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/quiz/submit')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Missing required fields');
    });

    it('should validate answers format', async () => {
      const response = await request(app)
        .post('/quiz/submit')
        .send({
          quizId: 'quiz_123',
          answers: 'invalid',
          level: 'A1',
          quizType: 'multiple_choice',
          score: 1,
          totalQuestions: 2
        })
        .expect(400);

      expect(response.body.error).toBe('Answers must be an array');
    });
  });

  describe('GET /quiz/history', () => {
    it('should get user quiz history successfully', async () => {
      const mockHistory = [
        {
          id: 1,
          userId: 1,
          quizId: 'quiz_123',
          level: 'A1',
          quizType: 'multiple_choice',
          score: 8,
          totalQuestions: 10,
          completedAt: new Date('2023-12-01')
        },
        {
          id: 2,
          userId: 1,
          quizId: 'quiz_124',
          level: 'A2',
          quizType: 'fill_blank',
          score: 6,
          totalQuestions: 8,
          completedAt: new Date('2023-12-02')
        }
      ];

      prisma.quizResult.findMany.mockResolvedValue(mockHistory);

      const response = await request(app)
        .get('/quiz/history')
        .expect(200);

      expect(response.body.history).toHaveLength(2);
      expect(response.body.history[0].score).toBe(8);
      expect(response.body.history[1].level).toBe('A2');
      expect(prisma.quizResult.findMany).toHaveBeenCalledWith({
        where: { userId: 1 },
        orderBy: { completedAt: 'desc' },
        take: 50
      });
    });

    it('should filter history by level', async () => {
      const mockHistory = [
        {
          id: 1,
          userId: 1,
          level: 'A1',
          score: 8,
          totalQuestions: 10
        }
      ];

      prisma.quizResult.findMany.mockResolvedValue(mockHistory);

      const response = await request(app)
        .get('/quiz/history?level=A1')
        .expect(200);

      expect(prisma.quizResult.findMany).toHaveBeenCalledWith({
        where: {
          userId: 1,
          level: 'A1'
        },
        orderBy: { completedAt: 'desc' },
        take: 50
      });
    });

    it('should limit results with limit parameter', async () => {
      prisma.quizResult.findMany.mockResolvedValue([]);

      await request(app)
        .get('/quiz/history?limit=20')
        .expect(200);

      expect(prisma.quizResult.findMany).toHaveBeenCalledWith({
        where: { userId: 1 },
        orderBy: { completedAt: 'desc' },
        take: 20
      });
    });
  });

  describe('GET /quiz/stats', () => {
    it('should get user quiz statistics successfully', async () => {
      const mockStats = [
        { level: 'A1', _count: { id: 5 }, _avg: { score: 7.5 } },
        { level: 'A2', _count: { id: 3 }, _avg: { score: 6.0 } }
      ];

      prisma.quizResult.groupBy.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/quiz/stats')
        .expect(200);

      expect(response.body.stats).toHaveLength(2);
      expect(response.body.stats[0]).toHaveProperty('level');
      expect(response.body.stats[0]).toHaveProperty('totalQuizzes');
      expect(response.body.stats[0]).toHaveProperty('averageScore');
    });
  });

  describe('GET /quiz/:quizId/result', () => {
    it('should get specific quiz result successfully', async () => {
      const mockResult = {
        id: 1,
        userId: 1,
        quizId: 'quiz_123',
        answers: [
          { questionId: 1, selectedAnswer: '사과', isCorrect: true }
        ],
        level: 'A1',
        score: 8,
        totalQuestions: 10,
        completedAt: new Date()
      };

      prisma.quizResult.findUnique.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/quiz/quiz_123/result')
        .expect(200);

      expect(response.body.result.quizId).toBe('quiz_123');
      expect(response.body.result.score).toBe(8);
      expect(response.body.result.answers).toHaveLength(1);
    });

    it('should return error if quiz result not found', async () => {
      prisma.quizResult.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/quiz/nonexistent_quiz/result')
        .expect(404);

      expect(response.body.error).toBe('Quiz result not found');
    });

    it('should return error if user tries to access other user\'s quiz', async () => {
      const otherUserResult = {
        id: 1,
        userId: 2, // Different user
        quizId: 'quiz_123'
      };

      prisma.quizResult.findUnique.mockResolvedValue(otherUserResult);

      const response = await request(app)
        .get('/quiz/quiz_123/result')
        .expect(403);

      expect(response.body.error).toBe('Access denied');
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      prisma.vocab.findMany.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/quiz/generate')
        .expect(500);

      expect(response.body.error).toBe('Internal server error');
    });

    it('should handle invalid level parameter', async () => {
      const response = await request(app)
        .get('/quiz/generate?level=INVALID&count=10')
        .expect(400);

      expect(response.body.error).toBe('Invalid CEFR level');
    });

    it('should handle invalid count parameter', async () => {
      const response = await request(app)
        .get('/quiz/generate?level=A1&count=-5')
        .expect(400);

      expect(response.body.error).toBe('Count must be a positive number');
    });
  });
});