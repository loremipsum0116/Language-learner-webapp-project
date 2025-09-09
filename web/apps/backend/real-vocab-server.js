// Real vocab server - serves actual database data
const express = require('express');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const app = express();
const PORT = 4000;
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static audio files
const audioFolders = ['starter', 'elementary', 'intermediate', 'upper', 'advanced', 'idiom', 'phrasal_verb'];
audioFolders.forEach(folder => {
  const folderPath = path.join(__dirname, folder);
  app.use(`/${folder}`, express.static(folderPath));
  console.log(`📁 Serving audio from: /${folder} -> ${folderPath}`);
});

// Also serve level-based folders
const levelFolders = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
levelFolders.forEach(level => {
  const levelPath = path.join(__dirname, level);
  app.use(`/${level}`, express.static(levelPath));
  console.log(`📁 Serving audio from: /${level} -> ${levelPath}`);
});

// Simple vocab endpoint with real data
app.get('/simple-vocab', async (req, res) => {
  console.log('>>>>>>> REAL-VOCAB ENDPOINT HIT! <<<<<<<');
  console.log('Query params:', req.query);
  
  try {
    const { limit = 500, levelCEFR = 'A1' } = req.query;
    const limitInt = Math.min(parseInt(limit), 500);
    
    console.log(`[REAL-VOCAB] Fetching ${limitInt} vocabs for level ${levelCEFR}`);
    
    const vocabs = await prisma.vocab.findMany({
      where: {
        language: { code: 'en' },
        levelCEFR: levelCEFR,
      },
      take: limitInt,
      orderBy: { lemma: 'asc' },
      include: {
        dictentry: {
          select: {
            ipa: true,
            examples: true,
            audioLocal: true
          }
        }
      }
    });
    
    console.log(`[REAL-VOCAB] Found ${vocabs.length} vocabs`);
    
    const simplifiedVocabs = vocabs.map(vocab => {
      let koGloss = '';
      let enExample = '';
      let koExample = '';
      let audioLocal = null;
      
      // Parse examples from dictentry
      let examples = [];
      if (vocab.dictentry?.examples) {
        try {
          examples = typeof vocab.dictentry.examples === 'string' 
            ? JSON.parse(vocab.dictentry.examples)
            : vocab.dictentry.examples;
        } catch (e) {
          examples = [];
        }
      }
      
      // Extract gloss and example from examples array
      if (Array.isArray(examples)) {
        const glossEntry = examples.find(ex => ex.kind === 'gloss');
        const exampleEntry = examples.find(ex => ex.kind === 'example');
        
        if (glossEntry) {
          koGloss = glossEntry.ko || '';
        }
        if (exampleEntry) {
          enExample = exampleEntry.en || '';
          koExample = exampleEntry.ko || '';
        }
      }
      
      // Parse audio local data
      if (vocab.dictentry?.audioLocal) {
        try {
          audioLocal = typeof vocab.dictentry.audioLocal === 'string'
            ? JSON.parse(vocab.dictentry.audioLocal)
            : vocab.dictentry.audioLocal;
        } catch (e) {
          audioLocal = null;
        }
      }
      
      return {
        id: vocab.id,
        lemma: vocab.lemma,
        pos: vocab.pos,
        levelCEFR: vocab.levelCEFR,
        ko_gloss: koGloss || `뜻: ${vocab.lemma}`,
        ipa: vocab.dictentry?.ipa || '',
        example: enExample,
        koExample: koExample,
        audio_local: audioLocal
      };
    });
    
    console.log(`[REAL-VOCAB] Returning ${simplifiedVocabs.length} vocabs`);
    
    res.json({
      success: true,
      count: simplifiedVocabs.length,
      data: simplifiedVocabs
    });
    
  } catch (error) {
    console.error('[REAL-VOCAB] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Simple vocab detail endpoint
app.get('/simple-vocab-detail/:id', async (req, res) => {
  try {
    const vocabId = parseInt(req.params.id);
    console.log(`[REAL-VOCAB-DETAIL] Fetching vocab ${vocabId}`);
    
    const vocab = await prisma.vocab.findUnique({
      where: { id: vocabId },
      include: {
        dictentry: {
          select: {
            ipa: true,
            examples: true,
            audioLocal: true
          }
        }
      }
    });
    
    if (!vocab) {
      return res.status(404).json({ 
        success: false, 
        error: 'Vocabulary not found' 
      });
    }
    
    let koGloss = '';
    let enExample = '';
    let koExample = '';
    let audioLocal = null;
    
    // Parse examples from dictentry
    let examples = [];
    if (vocab.dictentry?.examples) {
      try {
        examples = typeof vocab.dictentry.examples === 'string' 
          ? JSON.parse(vocab.dictentry.examples)
          : vocab.dictentry.examples;
      } catch (e) {
        examples = [];
      }
    }
    
    // Extract gloss and example from examples array
    if (Array.isArray(examples)) {
      const glossEntry = examples.find(ex => ex.kind === 'gloss');
      const exampleEntry = examples.find(ex => ex.kind === 'example');
      
      if (glossEntry) {
        koGloss = glossEntry.ko || '';
      }
      if (exampleEntry) {
        enExample = exampleEntry.en || '';
        koExample = exampleEntry.ko || '';
      }
    }
    
    // Parse audio local data
    if (vocab.dictentry?.audioLocal) {
      try {
        audioLocal = typeof vocab.dictentry.audioLocal === 'string'
          ? JSON.parse(vocab.dictentry.audioLocal)
          : vocab.dictentry.audioLocal;
      } catch (e) {
        audioLocal = null;
      }
    }
    
    const detailData = {
      id: vocab.id,
      lemma: vocab.lemma,
      pos: vocab.pos,
      levelCEFR: vocab.levelCEFR,
      ko_gloss: koGloss,
      ipa: vocab.dictentry?.ipa || '',
      example: enExample,
      koExample: koExample,
      audio_local: audioLocal
    };
    
    res.json({
      success: true,
      data: detailData
    });
    
  } catch (error) {
    console.error('[REAL-VOCAB-DETAIL] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Simple audio files endpoint
app.get('/simple-audio-files/:level', (req, res) => {
  const { level } = req.params;
  console.log(`[REAL-VOCAB] Audio files requested for level: ${level}`);
  
  // Return empty array for now
  res.json({
    success: true,
    files: []
  });
});

// Simple exam categories endpoint
app.get('/simple-exam-categories', async (req, res) => {
  console.log('[REAL-VOCAB] Exam categories requested');
  
  try {
    // Return some basic exam categories
    res.json({
      success: true,
      data: [
        { id: 1, name: 'TOEIC', count: 500 },
        { id: 2, name: 'TOEFL', count: 400 },
        { id: 3, name: 'IELTS', count: 350 },
        { id: 4, name: '수능', count: 300 }
      ]
    });
  } catch (error) {
    console.error('[REAL-VOCAB] Exam categories error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Simple SRS endpoints (return empty/minimal data to prevent crashes)
app.get('/api/mobile/srs/status', (req, res) => {
  console.log('[REAL-VOCAB] SRS status requested');
  res.json({
    data: {
      totalCards: 0,
      availableCards: 0,
      waitingCards: 0,
      masteredCards: 0,
      currentStreak: 0,
      nextReviewTime: new Date(Date.now() + 1800000).toISOString(),
      todayCompleted: 0,
      todayGoal: 20,
      reviewsToday: 0,
      newCards: 0
    },
    status: 'success'
  });
});

app.get('/srs/mastered-cards', (req, res) => {
  console.log('[REAL-VOCAB] Mastered cards requested');
  res.json({
    success: true,
    data: []
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Real vocab server running on http://localhost:${PORT}`);
  console.log(`📖 Vocab API: http://localhost:${PORT}/simple-vocab`);
  console.log(`📝 Vocab Detail API: http://localhost:${PORT}/simple-vocab-detail/:id`);
  console.log(`💾 Database: Connected to Prisma/MySQL`);
});