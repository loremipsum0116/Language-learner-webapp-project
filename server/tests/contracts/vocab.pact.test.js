// server/tests/contracts/vocab.pact.test.js
const { Verifier } = require('@pact-foundation/pact');
const app = require('../../index.js');
const path = require('path');

describe('Vocabulary API Provider Contract Tests', () => {
  const opts = {
    provider: 'Language-Learner-API',
    providerBaseUrl: 'http://localhost:3001',
    pactUrls: [
      path.resolve(__dirname, '../../../pacts/language-learner-client-language-learner-api.json')
    ],
    publishVerificationResult: process.env.CI === 'true',
    providerVersion: '1.0.0',
    // State handlers for different provider states
    stateHandlers: {
      'vocabulary exists': () => {
        console.log('Setting up state: vocabulary exists');
        return Promise.resolve(setupVocabularyData());
      },
      'A1 level vocabulary exists': () => {
        console.log('Setting up state: A1 level vocabulary exists');
        return Promise.resolve(setupA1VocabularyData());
      },
      'authenticated user': () => {
        console.log('Setting up state: authenticated user');
        return Promise.resolve(setupAuthenticatedUser());
      },
      'unauthenticated user': () => {
        console.log('Setting up state: unauthenticated user');
        return Promise.resolve(); // No setup needed for unauthenticated state
      },
      'vocabulary with id 1 exists': () => {
        console.log('Setting up state: vocabulary with id 1 exists');
        return Promise.resolve(setupSpecificVocabulary(1));
      },
      'vocabulary with id 999 does not exist': () => {
        console.log('Setting up state: vocabulary with id 999 does not exist');
        return Promise.resolve(cleanupSpecificVocabulary(999));
      }
    },
    // Request filters to modify requests before verification
    requestFilter: (req, res, next) => {
      // Handle authentication token validation
      if (req.headers.authorization) {
        // Simulate token validation
        const token = req.headers.authorization.replace('Bearer ', '');
        if (token === 'valid.jwt.token') {
          req.user = { id: 1, email: 'test@example.com' };
        }
      }
      next();
    }
  };

  it('validates the expectations of Language Learner Client for vocabulary endpoints', async () => {
    const verifier = new Verifier(opts);
    
    try {
      const output = await verifier.verifyProvider();
      console.log('Vocabulary API Pact Verification Complete!');
      console.log(output);
    } catch (error) {
      console.error('Vocabulary API pact verification failed:', error);
      throw error;
    }
  });

  // Helper functions to set up test data
  async function setupVocabularyData() {
    // Mock vocabulary data setup
    const testVocabulary = [
      {
        id: 1,
        word: 'hello',
        meaning: 'a greeting',
        pronunciation: '/həˈloʊ/',
        level: 'A1',
        category: 'greetings',
        examples: [
          {
            sentence: 'Hello, how are you?',
            translation: '안녕하세요, 어떻게 지내세요?'
          }
        ]
      }
    ];
    
    // In a real implementation, you would insert this into a test database
    console.log('Set up vocabulary test data:', testVocabulary);
    return testVocabulary;
  }

  async function setupA1VocabularyData() {
    const a1Vocabulary = [
      {
        id: 1,
        word: 'basic',
        meaning: 'fundamental',
        level: 'A1',
        category: 'adjectives'
      }
    ];
    
    console.log('Set up A1 vocabulary test data:', a1Vocabulary);
    return a1Vocabulary;
  }

  async function setupAuthenticatedUser() {
    const testUser = {
      id: 1,
      email: 'test@example.com',
      role: 'user'
    };
    
    console.log('Set up authenticated user:', testUser);
    return testUser;
  }

  async function setupSpecificVocabulary(id) {
    const vocabulary = {
      id: id,
      word: 'amazing',
      meaning: 'causing great surprise or wonder',
      level: 'B2'
    };
    
    console.log(`Set up vocabulary with id ${id}:`, vocabulary);
    return vocabulary;
  }

  async function cleanupSpecificVocabulary(id) {
    // Ensure vocabulary with specified id doesn't exist
    console.log(`Ensured vocabulary with id ${id} does not exist`);
    return null;
  }
});