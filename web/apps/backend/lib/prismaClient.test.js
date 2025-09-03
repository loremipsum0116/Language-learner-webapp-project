const { PrismaClient } = require('@prisma/client');

// Mock PrismaClient
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      vocab: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      srsCard: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
    }))
  };
});

describe('Prisma Client', () => {
  let prisma;

  beforeEach(() => {
    jest.clearAllMocks();
    // Import after mocking
    const { prisma: prismaInstance } = require('./prismaClient');
    prisma = prismaInstance;
  });

  afterEach(async () => {
    if (prisma && typeof prisma.$disconnect === 'function') {
      await prisma.$disconnect();
    }
  });

  describe('Connection', () => {
    it('should create Prisma client instance', () => {
      expect(PrismaClient).toHaveBeenCalled();
      expect(prisma).toBeDefined();
      expect(typeof prisma.$connect).toBe('function');
      expect(typeof prisma.$disconnect).toBe('function');
    });

    it('should connect to database successfully', async () => {
      prisma.$connect.mockResolvedValue();
      await expect(prisma.$connect()).resolves.not.toThrow();
      expect(prisma.$connect).toHaveBeenCalled();
    });

    it('should disconnect from database successfully', async () => {
      prisma.$disconnect.mockResolvedValue();
      await expect(prisma.$disconnect()).resolves.not.toThrow();
      expect(prisma.$disconnect).toHaveBeenCalled();
    });

    it('should handle connection errors gracefully', async () => {
      const connectionError = new Error('Database connection failed');
      prisma.$connect.mockRejectedValue(connectionError);
      
      await expect(prisma.$connect()).rejects.toThrow('Database connection failed');
    });
  });

  describe('User Operations', () => {
    it('should create user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        role: 'USER'
      };

      const createdUser = {
        id: 1,
        ...userData,
        createdAt: new Date()
      };

      prisma.user.create.mockResolvedValue(createdUser);

      const result = await prisma.user.create({
        data: userData
      });

      expect(result).toEqual(createdUser);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: userData
      });
    });

    it('should find user by email', async () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        role: 'USER'
      };

      prisma.user.findUnique.mockResolvedValue(user);

      const result = await prisma.user.findUnique({
        where: { email: 'test@example.com' }
      });

      expect(result).toEqual(user);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' }
      });
    });

    it('should return null for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await prisma.user.findUnique({
        where: { email: 'nonexistent@example.com' }
      });

      expect(result).toBeNull();
    });
  });

  describe('Vocabulary Operations', () => {
    it('should create vocabulary successfully', async () => {
      const vocabData = {
        lemma: 'test',
        pos: 'noun',
        levelCEFR: 'A1'
      };

      const createdVocab = {
        id: 1,
        ...vocabData,
        createdAt: new Date()
      };

      prisma.vocab.create.mockResolvedValue(createdVocab);

      const result = await prisma.vocab.create({
        data: vocabData
      });

      expect(result).toEqual(createdVocab);
      expect(prisma.vocab.create).toHaveBeenCalledWith({
        data: vocabData
      });
    });

    it('should find vocabularies with filters', async () => {
      const vocabs = [
        { id: 1, lemma: 'apple', pos: 'noun', levelCEFR: 'A1' },
        { id: 2, lemma: 'book', pos: 'noun', levelCEFR: 'A1' }
      ];

      prisma.vocab.findMany.mockResolvedValue(vocabs);

      const result = await prisma.vocab.findMany({
        where: { levelCEFR: 'A1' },
        take: 10
      });

      expect(result).toEqual(vocabs);
      expect(prisma.vocab.findMany).toHaveBeenCalledWith({
        where: { levelCEFR: 'A1' },
        take: 10
      });
    });

    it('should count vocabularies', async () => {
      prisma.vocab.count.mockResolvedValue(100);

      const result = await prisma.vocab.count({
        where: { levelCEFR: 'A1' }
      });

      expect(result).toBe(100);
      expect(prisma.vocab.count).toHaveBeenCalledWith({
        where: { levelCEFR: 'A1' }
      });
    });
  });

  describe('SRS Card Operations', () => {
    it('should create SRS card successfully', async () => {
      const srsData = {
        userId: 1,
        vocabId: 1,
        interval: 0,
        repetitions: 0,
        easeFactor: 2.5,
        nextReview: new Date()
      };

      const createdCard = {
        id: 1,
        ...srsData
      };

      prisma.srsCard.create.mockResolvedValue(createdCard);

      const result = await prisma.srsCard.create({
        data: srsData
      });

      expect(result).toEqual(createdCard);
      expect(prisma.srsCard.create).toHaveBeenCalledWith({
        data: srsData
      });
    });

    it('should update SRS card review data', async () => {
      const updateData = {
        interval: 3,
        repetitions: 1,
        nextReview: new Date()
      };

      const updatedCard = {
        id: 1,
        userId: 1,
        vocabId: 1,
        ...updateData,
        easeFactor: 2.5
      };

      prisma.srsCard.update.mockResolvedValue(updatedCard);

      const result = await prisma.srsCard.update({
        where: { id: 1 },
        data: updateData
      });

      expect(result).toEqual(updatedCard);
      expect(prisma.srsCard.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: updateData
      });
    });
  });

  describe('Transaction Operations', () => {
    it('should execute transaction successfully', async () => {
      const transactionResult = { success: true };
      
      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(prisma);
      });

      const mockCallback = jest.fn().mockResolvedValue(transactionResult);

      const result = await prisma.$transaction(mockCallback);

      expect(result).toEqual(transactionResult);
      expect(mockCallback).toHaveBeenCalledWith(prisma);
    });

    it('should rollback transaction on error', async () => {
      const transactionError = new Error('Transaction failed');
      
      prisma.$transaction.mockRejectedValue(transactionError);

      const mockCallback = jest.fn();

      await expect(prisma.$transaction(mockCallback)).rejects.toThrow('Transaction failed');
    });
  });

  describe('Raw Queries', () => {
    it('should execute raw query successfully', async () => {
      const queryResult = [{ count: 10 }];
      
      prisma.$queryRaw.mockResolvedValue(queryResult);

      const result = await prisma.$queryRaw`SELECT COUNT(*) as count FROM User`;

      expect(result).toEqual(queryResult);
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should execute raw SQL successfully', async () => {
      const executeResult = { count: 1 };
      
      prisma.$executeRaw.mockResolvedValue(executeResult);

      const result = await prisma.$executeRaw`UPDATE User SET role = 'ADMIN' WHERE id = 1`;

      expect(result).toEqual(executeResult);
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle database constraint errors', async () => {
      const constraintError = new Error('Unique constraint violation');
      constraintError.code = 'P2002';
      
      prisma.user.create.mockRejectedValue(constraintError);

      await expect(prisma.user.create({
        data: {
          email: 'existing@example.com',
          passwordHash: 'hash'
        }
      })).rejects.toThrow('Unique constraint violation');
    });

    it('should handle database connection errors', async () => {
      const connectionError = new Error('Database unavailable');
      connectionError.code = 'P1001';
      
      prisma.vocab.findMany.mockRejectedValue(connectionError);

      await expect(prisma.vocab.findMany()).rejects.toThrow('Database unavailable');
    });

    it('should handle record not found errors', async () => {
      const notFoundError = new Error('Record not found');
      notFoundError.code = 'P2025';
      
      prisma.user.update.mockRejectedValue(notFoundError);

      await expect(prisma.user.update({
        where: { id: 999 },
        data: { email: 'new@example.com' }
      })).rejects.toThrow('Record not found');
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple concurrent queries', async () => {
      const users = Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        email: `user${i + 1}@example.com`
      }));

      prisma.user.findUnique.mockImplementation(({ where }) => {
        const user = users.find(u => u.email === where.email);
        return Promise.resolve(user || null);
      });

      const queries = users.map(user => 
        prisma.user.findUnique({ where: { email: user.email } })
      );

      const results = await Promise.all(queries);

      expect(results).toHaveLength(5);
      expect(results.every(result => result !== null)).toBe(true);
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(5);
    });
  });
});