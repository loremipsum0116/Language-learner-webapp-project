// server/routes/odat-note.js
const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');
const { generateMcqQuizItems } = require('../services/quizService');
const auth = require('../middleware/auth');

// ✅ 이 파일의 모든 라우트는 로그인 필요
router.use(auth);

/**
 * POST /odat-note/resolve-many
 * 오답노트에서 선택한 카드들의 누적 오답을 0으로 초기화
 * body: { cardIds: number[] }
 */
router.post('/resolve-many', async (req, res) => {
  try {
    const { cardIds } = req.body || {};
    if (!Array.isArray(cardIds) || cardIds.length === 0) {
      return res.status(400).json({ error: 'cardIds must be a non-empty array' });
    }

    const result = await prisma.sRSCard.updateMany({
      where: {
        userId: req.user.id,
        id: { in: cardIds.map(Number) },
      },
      data: {
        wrongTotal: 0, // ✅ 스키마에 맞게 수정 (incorrectCount 제거)
      },
    });

    return res.json({ data: { count: result.count } });
  } catch (e) {
    console.error('POST /odat-note/resolve-many failed:', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * POST /odat-note/quiz
 * 선택한 카드들만으로 MCQ 큐 생성
 * body: { cardIds: number[] }
 */
router.post('/quiz', async (req, res) => {
  try {
    const { cardIds } = req.body || {};
    if (!Array.isArray(cardIds) || cardIds.length === 0) {
      return res.json({ data: [] });
    }

    const cards = await prisma.sRSCard.findMany({
      where: {
        userId: req.user.id,
        id: { in: cardIds.map(Number) },
      },
      select: { itemId: true },
    });

    const vocabIds = cards.map((c) => c.itemId);
    if (vocabIds.length === 0) return res.json({ data: [] });

    const quizQueue = await generateMcqQuizItems(prisma, req.user.id, vocabIds);
    return res.json({ data: quizQueue });
  } catch (e) {
    console.error('POST /odat-note/quiz failed:', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * GET /odat-note/list
 * 오답누적(wrongTotal > 0) 카드 목록을 단순 리스트로 반환
 * 프론트에서 테이블/리스트로 보여줄 때 사용
 */
router.get('/list', async (req, res) => {
  try {
    const cards = await prisma.sRSCard.findMany({
      where: {
        userId: req.user.id,
        itemType: 'vocab',
        wrongTotal: { gt: 0 }, // ✅ 스키마 반영
      },
      orderBy: [
        { wrongTotal: 'desc' }, // 오답 많은 것 우선
        { id: 'asc' },          // 안정적인 정렬
      ],
      select: {
        id: true,
        itemId: true,
        wrongTotal: true,
        correctTotal: true,
        stage: true,
        nextReviewAt: true,
      },
      take: 200,
    });

    const vocabIds = cards.map((c) => c.itemId);
    const vocabs = vocabIds.length
      ? await prisma.vocab.findMany({
          where: { id: { in: vocabIds } },
          include: { dictMeta: true },
        })
      : [];
    const vocabMap = new Map(vocabs.map((v) => [v.id, v]));

    const data = cards.map((card) => {
      const v = vocabMap.get(card.itemId);
      // gloss 찾기(있으면)
      let gloss = null;
      const ex = Array.isArray(v?.dictMeta?.examples) ? v.dictMeta.examples : [];
      const g = ex.find((e) => e && e.kind === 'gloss');
      if (g && typeof g.ko === 'string') gloss = g.ko;

      return {
        cardId: card.id,
        vocabId: card.itemId,
        lemma: v?.lemma ?? '',
        ipa: v?.dictMeta?.ipa ?? null,
        ipaKo: v?.dictMeta?.ipaKo ?? null,
        ko_gloss: gloss,
        wrongTotal: card.wrongTotal,
        correctTotal: card.correctTotal,
        stage: card.stage,
        nextReviewAt: card.nextReviewAt,
      };
    });

    return res.json({ data });
  } catch (e) {
    console.error('GET /odat-note/list failed:', e);
    return res.status(500).json({ error: 'Failed to load incorrect answer notes' });
  }
});

/**
 * GET /odat-note/queue
 * 오답누적이 있는 카드들만 추려 MCQ 큐로 변환해 반환
 */
router.get('/queue', async (req, res) => {
  try {
    const cards = await prisma.sRSCard.findMany({
      where: {
        userId: req.user.id,
        itemType: 'vocab',
        wrongTotal: { gt: 0 }, // ✅ 스키마 반영
      },
      orderBy: [{ wrongTotal: 'desc' }, { id: 'asc' }],
      take: 100,
      select: { itemId: true },
    });

    const vocabIds = cards.map((c) => c.itemId);
    if (vocabIds.length === 0) return res.json({ data: [] });

    const queue = await generateMcqQuizItems(prisma, req.user.id, vocabIds);
    return res.json({ data: queue });
  } catch (e) {
    console.error('GET /odat-note/queue failed:', e);
    return res.status(500).json({ error: 'Failed to create quiz for incorrect notes' });
  }
});

module.exports = router;
