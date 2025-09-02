// src/tests/contracts/srs.consumer.test.js
const { Pact } = require('@pact-foundation/pact');
const { like, eachLike } = require('@pact-foundation/pact/src/dsl/matchers');
const path = require('path');
const fetch = require('node-fetch');

// Mock SRS (Spaced Repetition System) API client
const SRSAPI = {
  getReviewItems: async (token, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = `http://localhost:1234/api/v1/srs/reviews${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return response.json();
  },

  submitReview: async (token, reviewData) => {
    const response = await fetch('http://localhost:1234/api/v1/srs/reviews', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reviewData),
    });
    return response.json();
  },

  getStudyStats: async (token, userId) => {
    const response = await fetch(`http://localhost:1234/api/v1/srs/stats/${userId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return response.json();
  },

  resetItem: async (token, itemId) => {
    const response = await fetch(`http://localhost:1234/api/v1/srs/items/${itemId}/reset`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return response.json();
  }
};

describe('SRS API Consumer Contract Tests', () => {
  const provider = new Pact({
    consumer: 'Language-Learner-Client',
    provider: 'Language-Learner-API',
    port: 1234,
    log: path.resolve(process.cwd(), 'logs', 'mockserver-integration.log'),
    dir: path.resolve(process.cwd(), 'pacts'),
    logLevel: 'INFO',
  });

  beforeAll(async () => {
    await provider.setup();
  });

  afterAll(async () => {
    await provider.finalize();
  });

  afterEach(async () => {
    await provider.verify();
  });

  describe('Get Review Items', () => {
    it('should retrieve review items for study session', async () => {
      const expectedResponse = {
        success: true,
        data: {
          reviewItems: eachLike({
            id: like(1),
            vocabularyId: like(101),
            word: like('hello'),
            meaning: like('a greeting'),
            level: like(1),
            nextReviewAt: like('2024-01-01T10:00:00Z'),
            interval: like(86400),
            easeFactor: like(2.5)
          }, { min: 1 }),
          totalReviews: like(25),
          newItems: like(5)
        }
      };

      await provider.addInteraction({
        state: 'user has review items available',
        uponReceiving: 'a request for review items',
        withRequest: {
          method: 'GET',
          path: '/api/v1/srs/reviews',
          headers: {
            'Authorization': like('Bearer valid.jwt.token'),
            'Content-Type': 'application/json',
          },
          query: {
            limit: '10'
          }
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: expectedResponse
        }
      });

      const result = await SRSAPI.getReviewItems('valid.jwt.token', { limit: '10' });

      expect(result.success).toBe(true);
      expect(result.data.reviewItems).toHaveLength(1);
      expect(result.data.reviewItems[0].word).toBe('hello');
      expect(result.data.totalReviews).toBe(25);
    });

    it('should return empty list when no reviews available', async () => {
      const expectedResponse = {
        success: true,
        data: {
          reviewItems: [],
          totalReviews: 0,
          newItems: 0
        }
      };

      await provider.addInteraction({
        state: 'user has no review items available',
        uponReceiving: 'a request for review items when none available',
        withRequest: {
          method: 'GET',
          path: '/api/v1/srs/reviews',
          headers: {
            'Authorization': like('Bearer valid.jwt.token'),
            'Content-Type': 'application/json',
          }
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: expectedResponse
        }
      });

      const result = await SRSAPI.getReviewItems('valid.jwt.token');

      expect(result.success).toBe(true);
      expect(result.data.reviewItems).toHaveLength(0);
      expect(result.data.totalReviews).toBe(0);
    });
  });

  describe('Submit Review', () => {
    it('should submit review result successfully', async () => {
      const expectedResponse = {
        success: true,
        data: {
          itemId: like(1),
          newLevel: like(2),
          nextReviewAt: like('2024-01-02T10:00:00Z'),
          newInterval: like(172800),
          newEaseFactor: like(2.6)
        },
        message: like('Review submitted successfully')
      };

      await provider.addInteraction({
        state: 'review item exists and is due for review',
        uponReceiving: 'a review submission with correct answer',
        withRequest: {
          method: 'POST',
          path: '/api/v1/srs/reviews',
          headers: {
            'Authorization': like('Bearer valid.jwt.token'),
            'Content-Type': 'application/json',
          },
          body: {
            itemId: 1,
            quality: 4,
            timeSpent: 3000,
            answerType: 'meaning'
          }
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: expectedResponse
        }
      });

      const result = await SRSAPI.submitReview('valid.jwt.token', {
        itemId: 1,
        quality: 4,
        timeSpent: 3000,
        answerType: 'meaning'
      });

      expect(result.success).toBe(true);
      expect(result.data.newLevel).toBe(2);
      expect(result.data.itemId).toBe(1);
    });

    it('should handle incorrect answer with level decrease', async () => {
      const expectedResponse = {
        success: true,
        data: {
          itemId: like(1),
          newLevel: like(1),
          nextReviewAt: like('2024-01-01T10:30:00Z'),
          newInterval: like(1800),
          newEaseFactor: like(2.3)
        },
        message: like('Review submitted - item reset due to incorrect answer')
      };

      await provider.addInteraction({
        state: 'review item exists and user answered incorrectly',
        uponReceiving: 'a review submission with incorrect answer',
        withRequest: {
          method: 'POST',
          path: '/api/v1/srs/reviews',
          headers: {
            'Authorization': like('Bearer valid.jwt.token'),
            'Content-Type': 'application/json',
          },
          body: {
            itemId: 1,
            quality: 1,
            timeSpent: 5000,
            answerType: 'meaning'
          }
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: expectedResponse
        }
      });

      const result = await SRSAPI.submitReview('valid.jwt.token', {
        itemId: 1,
        quality: 1,
        timeSpent: 5000,
        answerType: 'meaning'
      });

      expect(result.success).toBe(true);
      expect(result.data.newLevel).toBe(1);
      expect(result.data.newEaseFactor).toBe(2.3);
    });
  });

  describe('Get Study Stats', () => {
    it('should retrieve user study statistics', async () => {
      const expectedResponse = {
        success: true,
        data: {
          userId: like(1),
          totalItems: like(150),
          reviewsToday: like(25),
          accuracyRate: like(85.5),
          streakDays: like(7),
          levelDistribution: {
            level1: like(30),
            level2: like(40),
            level3: like(35),
            level4: like(25),
            level5: like(20)
          },
          monthlyProgress: eachLike({
            month: like('2024-01'),
            itemsLearned: like(45),
            reviewsCompleted: like(320)
          }, { min: 1 })
        }
      };

      await provider.addInteraction({
        state: 'user exists with study statistics',
        uponReceiving: 'a request for user study statistics',
        withRequest: {
          method: 'GET',
          path: '/api/v1/srs/stats/1',
          headers: {
            'Authorization': like('Bearer valid.jwt.token'),
            'Content-Type': 'application/json',
          }
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: expectedResponse
        }
      });

      const result = await SRSAPI.getStudyStats('valid.jwt.token', 1);

      expect(result.success).toBe(true);
      expect(result.data.totalItems).toBe(150);
      expect(result.data.accuracyRate).toBe(85.5);
      expect(result.data.streakDays).toBe(7);
    });
  });

  describe('Reset Item', () => {
    it('should reset SRS item to initial state', async () => {
      const expectedResponse = {
        success: true,
        data: {
          itemId: like(1),
          newLevel: like(1),
          newEaseFactor: like(2.5),
          nextReviewAt: like('2024-01-01T10:00:00Z')
        },
        message: like('Item reset successfully')
      };

      await provider.addInteraction({
        state: 'SRS item with id 1 exists',
        uponReceiving: 'a request to reset SRS item',
        withRequest: {
          method: 'POST',
          path: '/api/v1/srs/items/1/reset',
          headers: {
            'Authorization': like('Bearer valid.jwt.token'),
            'Content-Type': 'application/json',
          }
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: expectedResponse
        }
      });

      const result = await SRSAPI.resetItem('valid.jwt.token', 1);

      expect(result.success).toBe(true);
      expect(result.data.newLevel).toBe(1);
      expect(result.data.newEaseFactor).toBe(2.5);
    });

    it('should fail to reset non-existent item', async () => {
      await provider.addInteraction({
        state: 'SRS item with id 999 does not exist',
        uponReceiving: 'a request to reset non-existent SRS item',
        withRequest: {
          method: 'POST',
          path: '/api/v1/srs/items/999/reset',
          headers: {
            'Authorization': like('Bearer valid.jwt.token'),
            'Content-Type': 'application/json',
          }
        },
        willRespondWith: {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            success: false,
            error: like('SRS item not found')
          }
        }
      });

      const result = await SRSAPI.resetItem('valid.jwt.token', 999);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});