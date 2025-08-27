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
      const rawMeanings = Array.isArray(dictentry?.examples) ? dictentry.examples : [];
      
      // 고급 중복 제거: pos 기준으로 그룹화하여 가장 좋은 것만 선택
      const posGroups = new Map();
      for (const meaning of rawMeanings) {
        const pos = (meaning.pos || 'unknown').toLowerCase().trim();
        if (!posGroups.has(pos)) {
          posGroups.set(pos, []);
        }
        posGroups.get(pos).push(meaning);
      }
      
      const meanings = [];
      for (const [pos, groupMeanings] of posGroups.entries()) {
        if (groupMeanings.length === 1) {
          meanings.push(groupMeanings[0]);
        } else {
          // 같은 pos를 가진 여러 meanings 중에서 최고 선택
          const best = groupMeanings.reduce((prev, current) => {
            const prevExampleCount = prev.definitions?.[0]?.examples?.length || 0;
            const currentExampleCount = current.definitions?.[0]?.examples?.length || 0;
            
            if (currentExampleCount > prevExampleCount) return current;
            if (prevExampleCount > currentExampleCount) return prev;
            
            const prevKoDef = prev.definitions?.[0]?.ko_def || '';
            const currentKoDef = current.definitions?.[0]?.ko_def || '';
            
            if (currentKoDef.length > prevKoDef.length) return current;
            if (prevKoDef.length > currentKoDef.length) return prev;
            
            const prevDef = prev.definitions?.[0]?.def || '';
            const currentDef = current.definitions?.[0]?.def || '';
            
            return currentDef.length > prevDef.length ? current : prev;
          });
          meanings.push(best);
        }
      }
      
      // CEFR 데이터 구조에서 Korean gloss 추출
      let primaryGloss = null;
      
      // CEFR 구조: examples[].ko (gloss kind)
      const glossExample = rawMeanings.find(ex => ex.kind === 'gloss');
      if (glossExample && glossExample.ko) {
        primaryGloss = glossExample.ko;
      }
      
      // 만약 gloss가 없다면 첫 번째 example의 ko 사용
      if (!primaryGloss && rawMeanings.length > 0 && rawMeanings[0].ko) {
        primaryGloss = rawMeanings[0].ko;
      }
      
      // 기존 복잡한 구조도 지원 (backward compatibility) - 실제로 meanings 배열 생성 안함
      // if (!primaryGloss && meanings.length > 0 && meanings[0].definitions?.length > 0) {
      //   primaryGloss = meanings[0].definitions[0].ko_def || null;
      // }
      
      return {
        id: v.id, lemma: v.lemma, pos: v.pos, levelCEFR: v.levelCEFR,
        ko_gloss: primaryGloss, ipa: dictentry?.ipa ?? null,
        ipaKo: dictentry?.ipaKo ?? null, audio: dictentry?.audioUrl ?? null,
        examples: rawMeanings
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
      const rawMeanings = Array.isArray(v.dictentry?.examples) ? v.dictentry.examples : [];
      
      // 고급 중복 제거: pos 기준으로 그룹화하여 가장 좋은 것만 선택
      const posGroups = new Map();
      for (const meaning of rawMeanings) {
        const pos = (meaning.pos || 'unknown').toLowerCase().trim();
        if (!posGroups.has(pos)) {
          posGroups.set(pos, []);
        }
        posGroups.get(pos).push(meaning);
      }
      
      const meanings = [];
      for (const [pos, groupMeanings] of posGroups.entries()) {
        if (groupMeanings.length === 1) {
          meanings.push(groupMeanings[0]);
        } else {
          // 같은 pos를 가진 여러 meanings 중에서 최고 선택
          const best = groupMeanings.reduce((prev, current) => {
            const prevExampleCount = prev.definitions?.[0]?.examples?.length || 0;
            const currentExampleCount = current.definitions?.[0]?.examples?.length || 0;
            
            if (currentExampleCount > prevExampleCount) return current;
            if (prevExampleCount > currentExampleCount) return prev;
            
            const prevKoDef = prev.definitions?.[0]?.ko_def || '';
            const currentKoDef = current.definitions?.[0]?.ko_def || '';
            
            if (currentKoDef.length > prevKoDef.length) return current;
            if (prevKoDef.length > currentKoDef.length) return prev;
            
            const prevDef = prev.definitions?.[0]?.def || '';
            const currentDef = current.definitions?.[0]?.def || '';
            
            return currentDef.length > prevDef.length ? current : prev;
          });
          meanings.push(best);
        }
      }
      
      // CEFR 데이터 구조에서 Korean gloss 추출
      let primaryGloss = null;
      
      // CEFR 구조: examples[].ko (gloss kind)
      const glossExample = rawMeanings.find(ex => ex.kind === 'gloss');
      if (glossExample && glossExample.ko) {
        primaryGloss = glossExample.ko;
      }
      
      // 만약 gloss가 없다면 첫 번째 example의 ko 사용
      if (!primaryGloss && rawMeanings.length > 0 && rawMeanings[0].ko) {
        primaryGloss = rawMeanings[0].ko;
      }
      
      // 기존 복잡한 구조도 지원 (backward compatibility) - 실제로 meanings 배열 생성 안함
      // if (!primaryGloss && meanings.length > 0 && meanings[0].definitions?.length > 0) {
      //   primaryGloss = meanings[0].definitions[0].ko_def || null;
      // }
      
      return {
        id: v.id,
        lemma: v.lemma,
        pos: v.pos,
        level: v.levelCEFR,
        ko_gloss: primaryGloss,
        ipa: v.dictentry?.ipa ?? null,
        ipaKo: v.dictentry?.ipaKo ?? null,
        audio: v.dictentry?.audioUrl ?? null,
        examples: rawMeanings
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
  const folderId = req.body.folderId ? parseInt(req.body.folderId, 10) : null;

  if (isNaN(vocabId)) {
    return res.status(400).json({ error: 'Invalid vocab ID' });
  }

  // 폴더별 독립적인 SRS 카드 검사
  const existing = await prisma.srscard.findFirst({
    where: { 
      userId, 
      itemId: vocabId, 
      itemType: 'vocab',
      folderId: folderId 
    }
  });

  if (existing) {
    return res.status(200).json({ ok: true, id: existing.id, already: true });
  }

  // 폴더별 독립적인 사용자 단어 추가
  const existingUserVocab = await prisma.uservocab.findFirst({
    where: { 
      userId, 
      vocabId,
      folderId: folderId 
    }
  });

  if (!existingUserVocab) {
    await prisma.uservocab.create({
      data: {
        userId,
        vocabId,
        folderId: folderId
      }
    });
  }

  const newCard = await prisma.srscard.create({
    data: {
      userId,
      itemId: vocabId,
      itemType: 'vocab',
      stage: 0,
      nextReviewAt: new Date(),
      folderId: folderId
    }
  });

  return res.status(201).json({ ok: true, id: newCard.id });
});

// GET /vocab/user/:userId/folder/:folderId - 특정 폴더의 사용자 단어 목록
router.get('/user/:userId/folder/:folderId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const folderId = parseInt(req.params.folderId, 10);

    if (isNaN(userId) || isNaN(folderId)) {
      return res.status(400).json({ error: 'Invalid user ID or folder ID' });
    }

    const userVocabs = await prisma.uservocab.findMany({
      where: {
        userId: userId,
        folderId: folderId
      },
      include: {
        vocab: {
          include: {
            dictentry: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const data = userVocabs.map(uv => {
      const v = uv.vocab;
      const dictentry = v.dictentry;
      const rawMeanings = Array.isArray(dictentry?.examples) ? dictentry.examples : [];
      // CEFR 데이터 구조에서 Korean gloss 추출
      let primaryGloss = null;
      
      // CEFR 구조: examples[].ko (gloss kind)
      const glossExample = rawMeanings.find(ex => ex.kind === 'gloss');
      if (glossExample && glossExample.ko) {
        primaryGloss = glossExample.ko;
      }
      
      // 만약 gloss가 없다면 첫 번째 example의 ko 사용
      if (!primaryGloss && rawMeanings.length > 0 && rawMeanings[0].ko) {
        primaryGloss = rawMeanings[0].ko;
      }
      
      // 기존 복잡한 구조도 지원 (backward compatibility) - 실제로 meanings 배열 생성 안함
      // if (!primaryGloss && meanings.length > 0 && meanings[0].definitions?.length > 0) {
      //   primaryGloss = meanings[0].definitions[0].ko_def || null;
      // }
      return {
        id: v.id,
        lemma: v.lemma,
        pos: v.pos,
        levelCEFR: v.levelCEFR,
        ko_gloss: primaryGloss,
        ipa: dictentry?.ipa ?? null,
        ipaKo: dictentry?.ipaKo ?? null,
        audio: dictentry?.audioUrl ?? null,
        examples: rawMeanings,
        addedAt: uv.createdAt
      };
    });

    return res.json({ data });
  } catch (e) {
    console.error('GET /vocab/user/:userId/folder/:folderId failed:', e);
    return res.status(500).json({ error: 'Failed to fetch user vocabulary for folder' });
  }
});

// GET /vocab/user/:userId - 특정 사용자의 모든 폴더별 단어 목록 (옵션: folderId가 없는 단어들 포함)
router.get('/user/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const includeLegacy = req.query.includeLegacy === 'true'; // 기존 folderId가 null인 단어들 포함 여부

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const where = { userId: userId };
    if (!includeLegacy) {
      where.folderId = { not: null };
    }

    const userVocabs = await prisma.uservocab.findMany({
      where: where,
      include: {
        vocab: {
          include: {
            dictentry: true
          }
        },
        folder: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { folderId: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    const data = userVocabs.map(uv => {
      const v = uv.vocab;
      const dictentry = v.dictentry;
      const rawMeanings = Array.isArray(dictentry?.examples) ? dictentry.examples : [];
      // CEFR 데이터 구조에서 Korean gloss 추출
      let primaryGloss = null;
      
      // CEFR 구조: examples[].ko (gloss kind)
      const glossExample = rawMeanings.find(ex => ex.kind === 'gloss');
      if (glossExample && glossExample.ko) {
        primaryGloss = glossExample.ko;
      }
      
      // 만약 gloss가 없다면 첫 번째 example의 ko 사용
      if (!primaryGloss && rawMeanings.length > 0 && rawMeanings[0].ko) {
        primaryGloss = rawMeanings[0].ko;
      }
      
      // 기존 복잡한 구조도 지원 (backward compatibility) - 실제로 meanings 배열 생성 안함
      // if (!primaryGloss && meanings.length > 0 && meanings[0].definitions?.length > 0) {
      //   primaryGloss = meanings[0].definitions[0].ko_def || null;
      // }
      return {
        id: v.id,
        lemma: v.lemma,
        pos: v.pos,
        levelCEFR: v.levelCEFR,
        ko_gloss: primaryGloss,
        ipa: dictentry?.ipa ?? null,
        ipaKo: dictentry?.ipaKo ?? null,
        audio: dictentry?.audioUrl ?? null,
        examples: rawMeanings,
        addedAt: uv.createdAt,
        folderId: uv.folderId,
        folderName: uv.folder?.name || 'Legacy'
      };
    });

    return res.json({ data });
  } catch (e) {
    console.error('GET /vocab/user/:userId failed:', e);
    return res.status(500).json({ error: 'Failed to fetch user vocabulary' });
  }
});

module.exports = router;
