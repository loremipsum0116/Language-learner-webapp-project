// routes/api/v1/index.js - API v1 Router
const express = require('express');
const authMiddleware = require('../../../middleware/auth');

// Import all route modules
const authRoutes = require('../../auth');
const learnRoutes = require('../../learn');
const vocabRoutes = require('../../vocab');
const quizRoutes = require('../../quiz');
const srsRoutes = require('../../srs');
const userRoutes = require('../../user');
const readingRoutes = require('../../reading');
const categoryRoutes = require('../../categories');
const myWordbookRoutes = require('../../my-wordbook');
const myIdiomsRoutes = require('../../my-idioms');
const odatNoteRoutes = require('../../odat-note');
const dictRoutes = require('../../dict');
const examVocabRoutes = require('../../examVocab');
const autoFolderRoutes = require('../../autoFolder');
const listeningRoutes = require('../../listening');
const idiomRoutes = require('../../idiom_working');
const timeMachineRouter = require('../../timeMachine').router;
const adminRoutes = require('../../admin');
const timeAcceleratorRouter = require('../../timeAccelerator').router;

const router = express.Router();

// API Version Info
router.get('/', (req, res) => {
  res.json({
    version: '1.0.0',
    name: 'Language Learner API v1',
    description: 'Comprehensive language learning platform API',
    endpoints: {
      auth: '/api/v1/auth',
      reading: '/api/v1/reading',
      listening: '/api/v1/listening',
      vocab: '/api/v1/vocab',
      idioms: '/api/v1/idioms',
      dict: '/api/v1/dict',
      examVocab: '/api/v1/exam-vocab',
      learn: '/api/v1/learn',
      quiz: '/api/v1/quiz',
      srs: '/api/v1/srs',
      categories: '/api/v1/categories',
      myWordbook: '/api/v1/my-wordbook',
      myIdioms: '/api/v1/my-idioms',
      notes: '/api/v1/notes',
      timeMachine: '/api/v1/time-machine',
      admin: '/api/v1/admin',
      autoFolder: '/api/v1/auto-folder',
      timeAccelerator: '/api/v1/time-accelerator'
    },
    timestamp: new Date().toISOString(),
    deprecation: {
      notice: 'Legacy routes without /api/v1 prefix will be deprecated in v2.0',
      migrationGuide: '/docs/api/migration/v1-to-v2'
    }
  });
});

// === Public Routes (No Authentication Required) ===
router.use('/auth', authRoutes);
router.use('/dict', dictRoutes);
router.use('/exam-vocab', examVocabRoutes);
router.use('/reading', readingRoutes);
router.use('/listening', listeningRoutes);
router.use('/idioms', idiomRoutes);
router.use('/time-accelerator', timeAcceleratorRouter);

// Public vocab endpoints (specific to idiom/phrasal verb integration)
router.get('/vocab/vocab-by-pos', async (req, res) => {
  try {
    const { prisma } = require('../../../lib/prismaClient');
    const { pos, search } = req.query;
    
    console.log('[API v1] vocab-by-pos called with:', { pos, search });
    
    if (!pos) {
      return res.status(400).json({ 
        data: null,
        error: 'pos parameter is required',
        meta: { version: '1.0.0' }
      });
    }
    
    const where = { 
      pos: pos,
      source: 'idiom_migration'
    };
    
    if (search && search.trim()) {
      where.lemma = { contains: search.trim() };
    }
    
    const vocabs = await prisma.vocab.findMany({
      where,
      include: {
        dictentry: true
      },
      orderBy: { lemma: 'asc' }
    });
    
    // Transform to expected idiom format
    const transformedData = vocabs.map(vocab => {
      const examples = vocab.dictentry?.examples || [];
      const glossExample = examples.find(ex => ex.kind === 'gloss');
      const sentenceExample = examples.find(ex => ex.kind === 'example');
      const usageExample = examples.find(ex => ex.kind === 'usage');
      
      // Parse audio data
      let audioData = {};
      if (vocab.dictentry?.audioLocal) {
        try {
          audioData = JSON.parse(vocab.dictentry.audioLocal);
        } catch (e) {
          console.warn('Failed to parse audio for', vocab.lemma, e.message);
        }
      }
      
      return {
        id: vocab.id,
        idiom: vocab.lemma,
        pos: vocab.pos,
        korean_meaning: glossExample?.ko || '',
        example: sentenceExample?.en || '',
        koExample: sentenceExample?.ko || '',
        koChirpScript: sentenceExample?.chirpScript || '',
        usage_context_korean: usageExample?.ko || '',
        category: `${vocab.levelCEFR}, ${vocab.pos}`,
        audio: audioData
      };
    });
    
    res.json({ 
      data: transformedData,
      error: null,
      meta: {
        count: transformedData.length,
        version: '1.0.0',
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('[API v1] vocab-by-pos error:', error);
    res.status(500).json({ 
      data: null,
      error: 'Internal server error',
      meta: { version: '1.0.0' }
    });
  }
});

// === Authentication Middleware for Protected Routes ===
router.use(authMiddleware);

// === Protected Routes (Authentication Required) ===
router.use('/learn', learnRoutes);
router.use('/vocab', vocabRoutes);
router.use('/quiz', quizRoutes);
router.use('/srs', srsRoutes);
router.use('/categories', categoryRoutes);
router.use('/my-wordbook', myWordbookRoutes);
router.use('/my-idioms', myIdiomsRoutes);
router.use('/notes', odatNoteRoutes); // Renamed from 'odat-note' to 'notes' for cleaner API
router.use('/time-machine', timeMachineRouter);
router.use('/admin', adminRoutes);
router.use('/auto-folder', autoFolderRoutes);
router.use('/', userRoutes); // User routes are mounted at root level

// === API Health Check ===
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

module.exports = router;