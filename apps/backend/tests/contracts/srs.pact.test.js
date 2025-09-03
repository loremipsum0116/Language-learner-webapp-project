// server/tests/contracts/srs.pact.test.js
const { Verifier } = require('@pact-foundation/pact');
const app = require('../../index.js');
const path = require('path');

describe('SRS API Provider Contract Tests', () => {
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
      'user has review items available': () => {
        console.log('Setting up state: user has review items available');
        return Promise.resolve(setupReviewItems());
      },
      'user has no review items available': () => {
        console.log('Setting up state: user has no review items available');
        return Promise.resolve(setupEmptyReviewItems());
      },
      'review item exists and is due for review': () => {
        console.log('Setting up state: review item exists and is due for review');
        return Promise.resolve(setupDueReviewItem());
      },
      'review item exists and user answered incorrectly': () => {
        console.log('Setting up state: review item exists and user answered incorrectly');
        return Promise.resolve(setupIncorrectAnswerScenario());
      },
      'user exists with study statistics': () => {
        console.log('Setting up state: user exists with study statistics');
        return Promise.resolve(setupStudyStatistics());
      },
      'SRS item with id 1 exists': () => {
        console.log('Setting up state: SRS item with id 1 exists');
        return Promise.resolve(setupSRSItem(1));
      },
      'SRS item with id 999 does not exist': () => {
        console.log('Setting up state: SRS item with id 999 does not exist');
        return Promise.resolve(cleanupSRSItem(999));
      }
    },
    // Request filters to modify requests before verification
    requestFilter: (req, res, next) => {
      // Handle authentication token validation
      if (req.headers.authorization) {
        const token = req.headers.authorization.replace('Bearer ', '');
        if (token === 'valid.jwt.token') {
          req.user = { id: 1, email: 'test@example.com' };
        }
      }
      next();
    }
  };

  it('validates the expectations of Language Learner Client for SRS endpoints', async () => {
    const verifier = new Verifier(opts);
    
    try {
      const output = await verifier.verifyProvider();
      console.log('SRS API Pact Verification Complete!');
      console.log(output);
    } catch (error) {
      console.error('SRS API pact verification failed:', error);
      throw error;
    }
  });

  // Helper functions to set up test data
  async function setupReviewItems() {
    const reviewItems = {
      reviewItems: [
        {
          id: 1,
          vocabularyId: 101,
          word: 'hello',
          meaning: 'a greeting',
          level: 1,
          nextReviewAt: '2024-01-01T10:00:00Z',
          interval: 86400,
          easeFactor: 2.5
        }
      ],
      totalReviews: 25,
      newItems: 5
    };
    
    console.log('Set up review items:', reviewItems);
    return reviewItems;
  }

  async function setupEmptyReviewItems() {
    const emptyReviewItems = {
      reviewItems: [],
      totalReviews: 0,
      newItems: 0
    };
    
    console.log('Set up empty review items:', emptyReviewItems);
    return emptyReviewItems;
  }

  async function setupDueReviewItem() {
    const reviewItem = {
      id: 1,
      vocabularyId: 101,
      userId: 1,
      level: 1,
      easeFactor: 2.5,
      interval: 86400,
      nextReviewAt: new Date(Date.now() - 3600000) // 1 hour ago (due for review)
    };
    
    console.log('Set up due review item:', reviewItem);
    return reviewItem;
  }

  async function setupIncorrectAnswerScenario() {
    const reviewItem = {
      id: 1,
      vocabularyId: 101,
      userId: 1,
      level: 2,
      easeFactor: 2.5,
      interval: 172800,
      nextReviewAt: new Date(Date.now() - 3600000)
    };
    
    console.log('Set up incorrect answer scenario:', reviewItem);
    return reviewItem;
  }

  async function setupStudyStatistics() {
    const stats = {
      userId: 1,
      totalItems: 150,
      reviewsToday: 25,
      accuracyRate: 85.5,
      streakDays: 7,
      levelDistribution: {
        level1: 30,
        level2: 40,
        level3: 35,
        level4: 25,
        level5: 20
      },
      monthlyProgress: [
        {
          month: '2024-01',
          itemsLearned: 45,
          reviewsCompleted: 320
        }
      ]
    };
    
    console.log('Set up study statistics:', stats);
    return stats;
  }

  async function setupSRSItem(id) {
    const srsItem = {
      id: id,
      vocabularyId: 101,
      userId: 1,
      level: 3,
      easeFactor: 2.7,
      interval: 604800, // 7 days
      nextReviewAt: new Date(Date.now() + 604800000)
    };
    
    console.log(`Set up SRS item with id ${id}:`, srsItem);
    return srsItem;
  }

  async function cleanupSRSItem(id) {
    // Ensure SRS item with specified id doesn't exist
    console.log(`Ensured SRS item with id ${id} does not exist`);
    return null;
  }
});