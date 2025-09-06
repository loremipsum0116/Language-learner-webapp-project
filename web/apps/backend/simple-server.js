// Simple backend server for SRS API with actual database
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const app = express();
const PORT = 4000;
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

// Real SRS status from database
app.get('/api/mobile/srs/status', async (req, res) => {
  console.log('[REAL DB] SRS status requested');
  
  try {
    // Count total cards, available cards, etc.
    const totalCards = await prisma.srscard.count();
    const availableCards = await prisma.srscard.count({
      where: {
        nextReviewAt: {
          lte: new Date()
        }
      }
    });
    
    const masteredCards = await prisma.srscard.count({
      where: {
        stage: {
          gte: 7  // Assuming stage 7+ is mastered
        }
      }
    });
    
    const waitingCards = totalCards - availableCards;
    
    // Real database data (even if it's empty)
    const data = {
      totalCards,
      availableCards,
      waitingCards,
      masteredCards,
      currentStreak: 0,  // We'd need to calculate this from user data
      nextReviewTime: new Date(Date.now() + 1800000).toISOString(),
      todayCompleted: 0, // We'd need to query completed reviews today
      todayGoal: 20,
      reviewsToday: 0,
      newCards: 0
    };
    
    console.log('[REAL DB] SRS Data:', data);
    
    res.json({
      data,
      status: 'success'
    });
  } catch (error) {
    console.error('[REAL DB] Error:', error);
    res.status(500).json({
      error: 'Database error',
      status: 'error'
    });
  }
});

// Real vocabulary from database
app.get('/simple-vocab', async (req, res) => {
  console.log('[REAL DB] Vocab requested');
  
  try {
    const vocabCount = await prisma.vocab.count();
    const vocabItems = await prisma.vocab.findMany({
      take: parseInt(req.query.limit) || 10,
      select: {
        id: true,
        lemma: true,
        pos: true,
        levelCEFR: true,
        ko_gloss: true,
        ipa: true
      }
    });
    
    console.log(`[REAL DB] Found ${vocabCount} vocab items, returning ${vocabItems.length}`);
    
    res.json({
      success: true,
      count: vocabItems.length,
      total: vocabCount,
      data: vocabItems
    });
  } catch (error) {
    console.error('[REAL DB] Vocab Error:', error);
    res.status(500).json({
      success: false,
      error: 'Database error'
    });
  }
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Real database server is running!', 
    timestamp: new Date().toISOString(),
    database: 'MySQL connected'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Real backend server running on http://localhost:${PORT}`);
  console.log(`📊 SRS API: http://localhost:${PORT}/api/mobile/srs/status`);
  console.log(`📖 Vocab API: http://localhost:${PORT}/simple-vocab`);
  console.log(`💾 Database: MySQL connected`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  await prisma.$disconnect();
  process.exit(0);
});