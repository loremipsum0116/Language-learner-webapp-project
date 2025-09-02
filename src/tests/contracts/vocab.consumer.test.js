// src/tests/contracts/vocab.consumer.test.js
const { Pact } = require('@pact-foundation/pact');
const { like, eachLike } = require('@pact-foundation/pact/src/dsl/matchers');
const path = require('path');
const fetch = require('node-fetch');
const { getNextAvailablePort } = require('../setup/port-utils');

// Mock Vocabulary API client
let mockServerPort;

const VocabAPI = {
  getVocabulary: async (token, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = `http://localhost:${mockServerPort}/api/v1/vocab${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return response.json();
  },

  addVocabulary: async (token, vocabData) => {
    const response = await fetch(`http://localhost:${mockServerPort}/api/v1/vocab`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(vocabData),
    });
    return response.json();
  },

  updateVocabulary: async (token, vocabId, vocabData) => {
    const response = await fetch(`http://localhost:${mockServerPort}/api/v1/vocab/${vocabId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(vocabData),
    });
    return response.json();
  },

  deleteVocabulary: async (token, vocabId) => {
    const response = await fetch(`http://localhost:${mockServerPort}/api/v1/vocab/${vocabId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  }
};

describe('Vocabulary API Consumer Contract Tests', () => {
  let provider;

  beforeAll(async () => {
    mockServerPort = await getNextAvailablePort();
    provider = new Pact({
      consumer: 'Language-Learner-Client',
      provider: 'Language-Learner-API',
      port: mockServerPort,
      log: path.resolve(process.cwd(), 'logs', 'mockserver-integration.log'),
      dir: path.resolve(process.cwd(), 'pacts'),
      logLevel: 'INFO',
    });
    await provider.setup();
  });

  afterAll(async () => {
    await provider.finalize();
  });

  afterEach(async () => {
    await provider.verify();
  });

  describe('Get Vocabulary', () => {
    it('should retrieve vocabulary list successfully', async () => {
      const expectedResponse = {
        success: true,
        data: eachLike({
          id: like(1),
          word: like('hello'),
          meaning: like('a greeting'),
          pronunciation: like('/həˈloʊ/'),
          level: like('A1'),
          category: like('greetings'),
          examples: eachLike({
            sentence: like('Hello, how are you?'),
            translation: like('안녕하세요, 어떻게 지내세요?')
          }, { min: 1 })
        }, { min: 1 }),
        pagination: {
          page: like(1),
          limit: like(20),
          total: like(100),
          totalPages: like(5)
        }
      };

      await provider.addInteraction({
        state: 'vocabulary exists',
        uponReceiving: 'a request for vocabulary list',
        withRequest: {
          method: 'GET',
          path: '/api/v1/vocab',
          headers: {
            'Authorization': like('Bearer valid.jwt.token'),
            'Content-Type': 'application/json',
          },
          query: {
            page: '1',
            limit: '20'
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

      const result = await VocabAPI.getVocabulary('valid.jwt.token', {
        page: '1',
        limit: '20'
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].word).toBe('hello');
      expect(result.pagination.page).toBe(1);
    });

    it('should retrieve vocabulary filtered by level', async () => {
      const expectedResponse = {
        success: true,
        data: eachLike({
          id: like(1),
          word: like('basic'),
          meaning: like('fundamental'),
          level: like('A1'),
          category: like('adjectives')
        }, { min: 1 })
      };

      await provider.addInteraction({
        state: 'A1 level vocabulary exists',
        uponReceiving: 'a request for A1 level vocabulary',
        withRequest: {
          method: 'GET',
          path: '/api/v1/vocab',
          headers: {
            'Authorization': like('Bearer valid.jwt.token'),
            'Content-Type': 'application/json',
          },
          query: {
            level: 'A1'
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

      const result = await VocabAPI.getVocabulary('valid.jwt.token', {
        level: 'A1'
      });

      expect(result.success).toBe(true);
      expect(result.data[0].level).toBe('A1');
    });
  });

  describe('Add Vocabulary', () => {
    it('should add new vocabulary successfully', async () => {
      const expectedResponse = {
        success: true,
        data: {
          id: like(123),
          word: like('wonderful'),
          meaning: like('extremely good'),
          pronunciation: like('/ˈwʌndərfəl/'),
          level: like('B1'),
          category: like('adjectives')
        },
        message: like('Vocabulary added successfully')
      };

      await provider.addInteraction({
        state: 'authenticated user',
        uponReceiving: 'a request to add new vocabulary',
        withRequest: {
          method: 'POST',
          path: '/api/v1/vocab',
          headers: {
            'Authorization': like('Bearer valid.jwt.token'),
            'Content-Type': 'application/json',
          },
          body: {
            word: 'wonderful',
            meaning: 'extremely good',
            pronunciation: '/ˈwʌndərfəl/',
            level: 'B1',
            category: 'adjectives'
          }
        },
        willRespondWith: {
          status: 201,
          headers: {
            'Content-Type': 'application/json',
          },
          body: expectedResponse
        }
      });

      const result = await VocabAPI.addVocabulary('valid.jwt.token', {
        word: 'wonderful',
        meaning: 'extremely good',
        pronunciation: '/ˈwʌndərfəl/',
        level: 'B1',
        category: 'adjectives'
      });

      expect(result.success).toBe(true);
      expect(result.data.word).toBe('wonderful');
      expect(result.data.id).toBe(123);
    });

    it('should fail to add vocabulary without authentication', async () => {
      await provider.addInteraction({
        state: 'unauthenticated user',
        uponReceiving: 'a request to add vocabulary without auth token',
        withRequest: {
          method: 'POST',
          path: '/api/v1/vocab',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            word: 'test',
            meaning: 'test meaning'
          }
        },
        willRespondWith: {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            success: false,
            error: like('Authentication required')
          }
        }
      });

      const result = await VocabAPI.addVocabulary(null, {
        word: 'test',
        meaning: 'test meaning'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Update Vocabulary', () => {
    it('should update existing vocabulary successfully', async () => {
      const expectedResponse = {
        success: true,
        data: {
          id: like(1),
          word: like('amazing'),
          meaning: like('causing great surprise or wonder'),
          level: like('B2')
        },
        message: like('Vocabulary updated successfully')
      };

      await provider.addInteraction({
        state: 'vocabulary with id 1 exists',
        uponReceiving: 'a request to update vocabulary',
        withRequest: {
          method: 'PUT',
          path: '/api/v1/vocab/1',
          headers: {
            'Authorization': like('Bearer valid.jwt.token'),
            'Content-Type': 'application/json',
          },
          body: {
            meaning: 'causing great surprise or wonder',
            level: 'B2'
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

      const result = await VocabAPI.updateVocabulary('valid.jwt.token', 1, {
        meaning: 'causing great surprise or wonder',
        level: 'B2'
      });

      expect(result.success).toBe(true);
      expect(result.data.level).toBe('B2');
    });

    it('should fail to update non-existent vocabulary', async () => {
      await provider.addInteraction({
        state: 'vocabulary with id 999 does not exist',
        uponReceiving: 'a request to update non-existent vocabulary',
        withRequest: {
          method: 'PUT',
          path: '/api/v1/vocab/999',
          headers: {
            'Authorization': like('Bearer valid.jwt.token'),
            'Content-Type': 'application/json',
          },
          body: {
            meaning: 'updated meaning'
          }
        },
        willRespondWith: {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            success: false,
            error: like('Vocabulary not found')
          }
        }
      });

      const result = await VocabAPI.updateVocabulary('valid.jwt.token', 999, {
        meaning: 'updated meaning'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Delete Vocabulary', () => {
    it('should delete vocabulary successfully', async () => {
      const expectedResponse = {
        success: true,
        message: like('Vocabulary deleted successfully')
      };

      await provider.addInteraction({
        state: 'vocabulary with id 1 exists',
        uponReceiving: 'a request to delete vocabulary',
        withRequest: {
          method: 'DELETE',
          path: '/api/v1/vocab/1',
          headers: {
            'Authorization': like('Bearer valid.jwt.token')
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

      const result = await VocabAPI.deleteVocabulary('valid.jwt.token', 1);

      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });

    it('should fail to delete non-existent vocabulary', async () => {
      await provider.addInteraction({
        state: 'vocabulary with id 999 does not exist',
        uponReceiving: 'a request to delete non-existent vocabulary',
        withRequest: {
          method: 'DELETE',
          path: '/api/v1/vocab/999',
          headers: {
            'Authorization': like('Bearer valid.jwt.token')
          }
        },
        willRespondWith: {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            success: false,
            error: like('Vocabulary not found')
          }
        }
      });

      const result = await VocabAPI.deleteVocabulary('valid.jwt.token', 999);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});