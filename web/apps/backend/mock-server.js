// Simple mock server for SRS API without database dependency
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Mock SRS status - different numbers from the hardcoded ones
app.get('/api/mobile/srs/status', (req, res) => {
  console.log('[MOCK] SRS status requested');
  res.json({
    data: {
      totalCards: 89,          // Different from 257
      availableCards: 5,       // Different from 12  
      waitingCards: 23,        // Different from 45
      masteredCards: 61,       // Different from 245
      currentStreak: 14,       // Different from 7
      nextReviewTime: new Date(Date.now() + 1800000).toISOString(),
      todayCompleted: 8,       // Different from 15
      todayGoal: 20,
      reviewsToday: 8,
      newCards: 2              // Different from 3
    },
    status: 'success'
  });
});

// Mock vocabulary endpoint
app.get('/simple-vocab', (req, res) => {
  console.log('[MOCK] Vocab requested');
  res.json({
    success: true,
    count: 3,
    data: [
      {
        id: 1,
        lemma: 'hello',
        pos: 'interjection',
        levelCEFR: 'A1',
        ko_gloss: '안녕하세요',
        ipa: '/həˈloʊ/'
      },
      {
        id: 2,
        lemma: 'world',
        pos: 'noun',
        levelCEFR: 'A1', 
        ko_gloss: '세계',
        ipa: '/wɜːrld/'
      },
      {
        id: 3,
        lemma: 'database',
        pos: 'noun',
        levelCEFR: 'B1',
        ko_gloss: '데이터베이스',
        ipa: '/ˈdeɪtəbeɪs/'
      }
    ]
  });
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'Mock server is running!', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Mock backend server running on http://localhost:${PORT}`);
  console.log(`📊 SRS API: http://localhost:${PORT}/api/mobile/srs/status`);
  console.log(`📖 Vocab API: http://localhost:${PORT}/simple-vocab`);
});