// server/routes/vocab.clean.js
// Clean Architecture 적용된 Vocab Router
const express = require('express');
const router = express.Router();
const { getContainer } = require('../packages/core/infrastructure/config/ContainerSetup');

// Get dependencies from DI container
const container = getContainer();

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ 
    message: 'vocab route works with clean architecture!',
    architecture: 'clean',
    timestamp: new Date().toISOString()
  });
});

// GET /vocab/list - 단어 목록 조회 (도메인 로직 분리됨)
router.get('/list', async (req, res) => {
  try {
    const { level, q: search, pos } = req.query;
    
    // Get use case from container
    const getVocabularyListUseCase = container.resolve('getVocabularyListUseCase');
    
    // Execute use case with request data
    const result = await getVocabularyListUseCase.execute({
      level,
      search,
      pos,
      includeIdioms: false, // 기본값: 숙어 제외
      limit: 100,
      offset: 0
    });

    if (result.success) {
      // Transform for legacy API compatibility
      const legacyResponse = result.data.vocabs.map(vocab => ({
        id: vocab.id,
        lemma: vocab.lemma,
        pos: vocab.pos,
        levelCEFR: vocab.level,
        freq: vocab.frequency,
        source: vocab.source,
        dictentry: vocab.dictionary ? {
          ipa: vocab.dictionary.ipa,
          ipaKo: vocab.dictionary.ipaKo,
          audioUrl: vocab.dictionary.hasAudio ? 'available' : null,
          audioLocal: vocab.dictionary.audio ? JSON.stringify(vocab.dictionary.audio) : null,
          examples: [
            ...(vocab.dictionary.definition ? [{ kind: 'gloss', ko: vocab.dictionary.definition }] : []),
            ...(vocab.dictionary.example ? [{ 
              kind: 'example', 
              en: vocab.dictionary.example,
              ko: vocab.dictionary.exampleKo || ''
            }] : [])
          ]
        } : null
      }));

      res.json(legacyResponse);
    } else {
      res.status(400).json({ error: result.error, code: result.code });
    }

  } catch (error) {
    console.error('[VOCAB] Error in /list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /vocab/test/:level/:count - 레벨별 랜덤 단어 테스트용
router.get('/test/:level/:count', async (req, res) => {
  try {
    const { level, count } = req.params;
    const numCount = parseInt(count);
    
    if (isNaN(numCount) || numCount < 1 || numCount > 50) {
      return res.status(400).json({ error: 'Count must be between 1 and 50' });
    }

    const getVocabularyListUseCase = container.resolve('getVocabularyListUseCase');
    
    // Get random vocabulary for testing
    const result = await getVocabularyListUseCase.execute({
      level,
      includeIdioms: false,
      limit: numCount * 3 // Get more than needed to have variety
    });

    if (result.success) {
      // Randomly select the requested count
      const shuffled = result.data.vocabs
        .sort(() => 0.5 - Math.random())
        .slice(0, numCount);

      const testData = shuffled.map(vocab => ({
        id: vocab.id,
        lemma: vocab.lemma,
        pos: vocab.pos,
        level: vocab.level,
        definition: vocab.dictionary?.definition || 'No definition available',
        example: vocab.dictionary?.example || 'No example available'
      }));

      res.json({ 
        level, 
        count: testData.length, 
        vocabs: testData 
      });
    } else {
      res.status(400).json({ error: result.error, code: result.code });
    }

  } catch (error) {
    console.error('[VOCAB] Error in /test:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /vocab/search - 단어 검색
router.get('/search', async (req, res) => {
  try {
    const { q: searchTerm, levels, limit = 20 } = req.query;
    
    if (!searchTerm || searchTerm.trim().length < 2) {
      return res.status(400).json({ 
        error: 'Search term must be at least 2 characters long' 
      });
    }

    const getVocabularyListUseCase = container.resolve('getVocabularyListUseCase');
    
    const result = await getVocabularyListUseCase.execute({
      search: searchTerm.trim(),
      includeIdioms: true, // 검색에서는 숙어도 포함
      limit: parseInt(limit)
    });

    if (result.success) {
      res.json({
        searchTerm,
        count: result.data.vocabs.length,
        results: result.data.vocabs.map(vocab => ({
          id: vocab.id,
          lemma: vocab.lemma,
          pos: vocab.pos,
          level: vocab.level,
          isIdiom: vocab.isIdiom,
          definition: vocab.dictionary?.definition || 'No definition available',
          relevanceScore: searchTerm.toLowerCase() === vocab.lemma.toLowerCase() ? 1.0 : 0.8
        }))
      });
    } else {
      res.status(400).json({ error: result.error, code: result.code });
    }

  } catch (error) {
    console.error('[VOCAB] Error in /search:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /vocab (Admin only - create new vocabulary)
router.post('/', async (req, res) => {
  try {
    // TODO: Add admin authorization check
    const { lemma, pos, levelCEFR, source } = req.body;
    
    if (!lemma || !pos || !levelCEFR) {
      return res.status(400).json({ 
        error: 'Missing required fields: lemma, pos, levelCEFR' 
      });
    }

    const vocabRepository = container.resolve('vocabRepository');
    
    const newVocab = await vocabRepository.create({
      lemma: lemma.trim(),
      pos,
      levelCEFR,
      source: source || 'manual'
    });

    res.status(201).json({
      message: 'Vocabulary created successfully',
      vocab: {
        id: newVocab.id,
        lemma: newVocab.lemma,
        pos: newVocab.pos,
        level: newVocab.levelCEFR
      }
    });

  } catch (error) {
    console.error('[VOCAB] Error in POST /', error);
    
    if (error.code === 'P2002') { // Prisma unique constraint violation
      res.status(409).json({ error: 'Vocabulary already exists' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

module.exports = router;