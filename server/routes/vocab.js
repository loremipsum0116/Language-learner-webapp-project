// server/routes/vocab.js
const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');

// GET /vocab/list
router.get('/list', async (req, res) => {
  try {
    const { level, q } = req.query;
    const where = {};
    if (q && q.trim()) {
      where.lemma = { contains: q.trim(), mode: 'insensitive' };
    } else {
      where.levelCEFR = level || 'A1';
    }
    const vocabs = await prisma.vocab.findMany({
      where,
      orderBy: { lemma: 'asc' },
      include: { dictMeta: { select: { examples: true, ipa: true, ipaKo: true, audioUrl: true } } }
    });

    const items = vocabs.map(v => {
      const meanings = Array.isArray(v.dictMeta?.examples) ? v.dictMeta.examples : [];
      let primaryGloss = null;
      if (meanings.length > 0 && meanings[0].definitions?.length > 0) {
        primaryGloss = meanings[0].definitions[0].ko_def || null;
      }
      return {
        id: v.id, lemma: v.lemma, pos: v.pos, levelCEFR: v.levelCEFR,
        ko_gloss: primaryGloss, ipa: v.dictMeta?.ipa ?? null,
        ipaKo: v.dictMeta?.ipaKo ?? null, audio: v.dictMeta?.audioUrl ?? null
      };
    });

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

    const vocabs = await prisma.vocab.findMany({
      where: { lemma: { contains: q, mode: 'insensitive' } },
      take: limit,
      orderBy: { lemma: 'asc' },
      include: { dictMeta: { select: { ipa: true, ipaKo: true, audioUrl: true } } }
    });

    const data = vocabs.map(v => ({
      id: v.id,
      lemma: v.lemma,
      pos: v.pos,
      level: v.levelCEFR,
      ipa: v.dictMeta?.ipa ?? null,
      ipaKo: v.dictMeta?.ipaKo ?? null,
      audio: v.dictMeta?.audioUrl ?? null
    }));

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
    const vocab = await prisma.vocab.findUnique({
      where: { id: vocabId },
      include: { dictMeta: true }
    });
    if (!vocab) {
      return res.status(404).json({ error: '단어를 찾을 수 없습니다.' });
    }
    return res.json({ data: vocab });
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

  const existing = await prisma.sRSCard.findFirst({
    where: { userId, itemId: vocabId, itemType: 'vocab' }
  });

  if (existing) {
    return res.status(200).json({ ok: true, id: existing.id, already: true });
  }

  const newCard = await prisma.sRSCard.create({
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
