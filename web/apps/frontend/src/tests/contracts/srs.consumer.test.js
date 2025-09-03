// src/tests/contracts/srs.consumer.test.js
const { Pact } = require('@pact-foundation/pact');
const { like, eachLike } = require('@pact-foundation/pact/src/dsl/matchers');
const path = require('path');
const http = require('http');
const { getNextAvailablePort } = require('../setup/port-utils');

// Helper function for HTTP requests
const makeHttpRequest = (url, options = {}) => {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = {
            status: res.statusCode,
            data: data ? JSON.parse(data) : {}
          };
          resolve(response);
        } catch (error) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
};

// Mock SRS (Spaced Repetition System) API client
let mockServerPort;

const SRSAPI = {
  getReviewItems: async (token, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = `http://127.0.0.1:${mockServerPort}/api/v1/srs/reviews${queryString ? `?${queryString}` : ''}`;
    
    const response = await makeHttpRequest(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });
    return response.data;
  },

  submitReview: async (token, reviewData) => {
    const response = await makeHttpRequest(`http://127.0.0.1:${mockServerPort}/api/v1/srs/reviews`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: reviewData
    });
    return response.data;
  },

  getStudyStats: async (token, userId) => {
    const response = await makeHttpRequest(`http://127.0.0.1:${mockServerPort}/api/v1/srs/stats/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });
    return response.data;
  },

  resetItem: async (token, itemId) => {
    const response = await makeHttpRequest(`http://127.0.0.1:${mockServerPort}/api/v1/srs/items/${itemId}/reset`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: {}
    });
    return response.data;
  }
};

describe('SRS API Consumer Contract Tests', () => {
  let provider;

  beforeAll(async () => {
    mockServerPort = await getNextAvailablePort();
    provider = new Pact({
      consumer: 'Language-Learner-Client',
      provider: 'Language-Learner-API',
      port: mockServerPort,
      log: path.resolve(process.cwd(), 'logs', 'mockserver-integration.log'),
      dir: path.resolve(process.cwd(), 'pacts'),
      logLevel: 'DEBUG',
      spec: 2
    });
    
    console.log(`Setting up Pact provider on port ${mockServerPort}`);
    await provider.setup();
    console.log(`Pact provider setup completed on port ${mockServerPort}`);
    
    // Wait for mock server to be ready
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  afterAll(async () => {
    try {
      console.log('Finalizing Pact provider...');
      await provider.finalize();
      console.log('Pact provider finalized successfully');
    } catch (error) {
      console.error('Error finalizing Pact provider:', error);
    }
  });

  beforeEach(async () => {
    // Clear any previous interactions
    await provider.removeInteractions();
  });

  afterEach(async () => {
    try {
      await provider.verify();
    } catch (error) {
      console.error('Pact verification failed:', error.message);
      throw error;
    }
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