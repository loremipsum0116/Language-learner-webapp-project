// server/routes/vocab.js
const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'vocab route works!' });
});

// GET /vocab/list
router.get('/list', async (req, res) => {
  try {
    const { level, q } = req.query;
    const where = {};
    if (q && q.trim()) {
      where.lemma = { contains: q.trim() };
    } else {
      where.levelCEFR = level || 'A1';
    }
    
    console.log('DEBUG /list: Query where:', JSON.stringify(where));
    
    // First get vocabs without include to avoid potential issues
    const vocabs = await prisma.vocab.findMany({
      where,
      orderBy: { lemma: 'asc' }
    });
    
    console.log('DEBUG /list: Found vocabs:', vocabs.length);
    
    // Get dictentries separately for all vocabs
    const vocabIds = vocabs.map(v => v.id);
    const dictentries = await prisma.dictentry.findMany({
      where: { vocabId: { in: vocabIds } },
      select: { vocabId: true, examples: true, ipa: true, ipaKo: true, audioUrl: true }
    });
    
    console.log('DEBUG /list: Found dictentries:', dictentries.length);
    
    // Create a map for quick lookup
    const dictMap = new Map();
    dictentries.forEach(d => dictMap.set(d.vocabId, d));

    const items = vocabs.map(v => {
      const dictentry = dictMap.get(v.id);
      const meanings = Array.isArray(dictentry?.examples) ? dictentry.examples : [];
      let primaryGloss = null;
      if (meanings.length > 0 && meanings[0].definitions?.length > 0) {
        primaryGloss = meanings[0].definitions[0].ko_def || null;
      }
      return {
        id: v.id, lemma: v.lemma, pos: v.pos, levelCEFR: v.levelCEFR,
        ko_gloss: primaryGloss, ipa: dictentry?.ipa ?? null,
        ipaKo: dictentry?.ipaKo ?? null, audio: dictentry?.audioUrl ?? null,
        examples: meanings
      };
    });

    console.log('DEBUG /list: First item with dictentry:', JSON.stringify(items[0], null, 2));
    if (items[0]) {
      console.log('DEBUG /list: ipa:', items[0].ipa);
      console.log('DEBUG /list: ipaKo:', items[0].ipaKo);
    }
    return res.json({ data: items });
  } catch (e) {
    console.error('GET /vocab/list failed:', e);
    return res.status(500).json({ error: 'list query failed' });
  }
});

// ✅ MUST COME BEFORE "/:id"
// GET /vocab/search?q=...&limit=20
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10) || 20, 1), 50);

    if (!q) return res.json({ data: [] });

    // First test without include
    let vocabs = await prisma.vocab.findMany({
      where: { lemma: { contains: q } },
      take: limit,
      orderBy: { lemma: 'asc' }
    });
    
    console.log('DEBUG: Found vocabs without include:', vocabs.length);
    
    // Get dictentry separately to debug the relationship
    if (vocabs.length > 0) {
      const dictentries = await prisma.dictentry.findMany({
        where: { vocabId: vocabs[0].id }
      });
      console.log('DEBUG: Found dictentries for first vocab:', dictentries.length);
      console.log('DEBUG: First dictentry:', JSON.stringify(dictentries[0], null, 2));
    }

    const data = vocabs.map(v => {
      const meanings = Array.isArray(v.dictentry?.examples) ? v.dictentry.examples : [];
      let primaryGloss = null;
      if (meanings.length > 0 && meanings[0].definitions?.length > 0) {
        primaryGloss = meanings[0].definitions[0].ko_def || null;
      }
      return {
        id: v.id,
        lemma: v.lemma,
        pos: v.pos,
        level: v.levelCEFR,
        ko_gloss: primaryGloss,
        ipa: v.dictentry?.ipa ?? null,
        ipaKo: v.dictentry?.ipaKo ?? null,
        audio: v.dictentry?.audioUrl ?? null,
        examples: meanings
      };
    });

    return res.json({ data });
  } catch (e) {
    console.error('GET /vocab/search failed:', e);
    return res.status(500).json({ error: 'search failed' });
  }
});

// GET /vocab/:id  ← "/search" 아래에 둬야 함
router.get('/:id', async (req, res) => {
  const vocabId = Number(req.params.id);
  if (!vocabId || !Number.isFinite(vocabId)) {
    return res.status(400).json({ error: 'Invalid vocab ID' });
  }
  try {
    console.log(`DEBUG /:id: Looking for vocab ${vocabId}`);
    
    // Get vocab without include first
    const vocab = await prisma.vocab.findUnique({
      where: { id: vocabId }
    });
    
    if (!vocab) {
      return res.status(404).json({ error: '단어를 찾을 수 없습니다.' });
    }
    
    console.log(`DEBUG /:id: Found vocab:`, vocab.lemma);
    
    // Get dictentry separately
    const dictentry = await prisma.dictentry.findFirst({
      where: { vocabId: vocabId }
    });
    
    console.log(`DEBUG /:id: Found dictentry:`, !!dictentry);
    if (dictentry) {
      console.log(`DEBUG /:id: Dictentry examples length:`, Array.isArray(dictentry.examples) ? dictentry.examples.length : 'not array');
      console.log(`DEBUG /:id: dictentry.ipa:`, dictentry.ipa);
      console.log(`DEBUG /:id: dictentry.ipaKo:`, dictentry.ipaKo);
      console.log(`DEBUG /:id: dictentry.audioUrl:`, dictentry.audioUrl);
    }
    
    // Combine the results
    const result = {
      ...vocab,
      dictentry: dictentry || null
    };
    
    return res.json({ data: result });
  } catch (e) {
    console.error(`GET /vocab/${vocabId} failed:`, e);
    return res.status(500).json({ error: '상세 정보를 불러오는 데 실패했습니다.' });
  }
});

// POST /vocab/:id/bookmark
router.post('/:id/bookmark', async (req, res) => {
  const vocabId = parseInt(req.params.id, 10);
  const userId = req.user.id;

  if (isNaN(vocabId)) {
    return res.status(400).json({ error: 'Invalid vocab ID' });
  }

  const existing = await prisma.srscard.findFirst({
    where: { userId, itemId: vocabId, itemType: 'vocab' }
  });

  if (existing) {
    return res.status(200).json({ ok: true, id: existing.id, already: true });
  }

  const newCard = await prisma.srscard.create({
    data: {
      userId,
      itemId: vocabId,
      itemType: 'vocab',
      stage: 0,
      nextReviewAt: new Date()
    }
  });

  return res.status(201).json({ ok: true, id: newCard.id });
});

module.exports = router;
