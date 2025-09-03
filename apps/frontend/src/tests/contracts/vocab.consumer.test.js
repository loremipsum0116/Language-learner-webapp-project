// src/tests/contracts/vocab.consumer.test.js
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

// Mock Vocabulary API client
let mockServerPort;

const VocabAPI = {
  getVocabulary: async (token, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = `http://127.0.0.1:${mockServerPort}/api/v1/vocab${queryString ? `?${queryString}` : ''}`;
    
    console.log(`Making request to: ${url}`);
    console.log(`With params:`, params);
    console.log(`Query string: ${queryString}`);
    
    try {
      const response = await makeHttpRequest(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });
      
      console.log(`Response status: ${response.status}`);
      console.log(`Response data:`, response.data);
      return response.data;
    } catch (error) {
      console.error('Error in getVocabulary:', error);
      throw error;
    }
  },

  addVocabulary: async (token, vocabData) => {
    const response = await makeHttpRequest(`http://127.0.0.1:${mockServerPort}/api/v1/vocab`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: vocabData
    });
    return response.data;
  },

  updateVocabulary: async (token, vocabId, vocabData) => {
    const response = await makeHttpRequest(`http://127.0.0.1:${mockServerPort}/api/v1/vocab/${vocabId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: vocabData
    });
    return response.data;
  },

  deleteVocabulary: async (token, vocabId) => {
    const response = await makeHttpRequest(`http://127.0.0.1:${mockServerPort}/api/v1/vocab/${vocabId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    });
    return response.data;
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

  describe('Get Vocabulary', () => {
    it('should retrieve vocabulary list successfully', async () => {
      console.log('Test case started');
      console.log('Mock server port:', mockServerPort);
      
      // Start with a simple, static response structure
      const expectedResponse = {
        success: true,
        data: [{
          id: 1,
          word: 'hello',
          meaning: 'a greeting',
          pronunciation: '/həˈloʊ/',
          level: 'A1',
          category: 'greetings'
        }],
        pagination: {
          page: 1,
          limit: 20,
          total: 100,
          totalPages: 5
        }
      };

      console.log('About to add interaction to provider...');
      
      try {
        await provider.addInteraction({
          state: 'vocabulary exists',
          uponReceiving: 'a request for vocabulary list',
          withRequest: {
            method: 'GET',
            path: '/api/v1/vocab',
            query: 'page=1&limit=20'
          },
          willRespondWith: {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
            body: expectedResponse
          }
        });
        
        console.log('Interaction added successfully to provider');
      } catch (error) {
        console.error('Error adding interaction:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        throw error;
      }
      
      // Wait for interaction to be registered
      await new Promise(resolve => setTimeout(resolve, 200));

      console.log('About to call VocabAPI.getVocabulary...');
      console.log('mockServerPort value:', mockServerPort);
      console.log('typeof mockServerPort:', typeof mockServerPort);
      
      // Direct HTTP call using axios
      console.log('Making direct HTTP call with axios...');
      let result;
      
      try {
        const directUrl = `http://127.0.0.1:${mockServerPort}/api/v1/vocab?page=1&limit=20`;
        console.log('Direct URL:', directUrl);
        
        const directResponse = await makeHttpRequest(directUrl);
        console.log('Direct response status:', directResponse.status);
        console.log('Direct response data:', directResponse.data);
        
        result = directResponse.data;
        console.log('Direct call successful, result:', result);
      } catch (error) {
        console.error('Direct HTTP call failed:', error.message);
        if (error.response) {
          console.error('Error response status:', error.response.status);
          console.error('Error response data:', error.response.data);
        }
        throw error;
      }

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