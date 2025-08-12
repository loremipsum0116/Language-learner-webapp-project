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
 * 새로운 WrongAnswer 모델 기반 오답노트 목록
 * 프론트에서 테이블/리스트로 보여줄 때 사용
 */
router.get('/list', async (req, res) => {
  try {
    // 새로운 WrongAnswer 모델에서 미완료 오답들을 조회
    const wrongAnswers = await prisma.wrongAnswer.findMany({
      where: {
        userId: req.user.id,
        isCompleted: false
      },
      orderBy: [
        { attempts: 'desc' }, // 시도 횟수 많은 것 우선
        { wrongAt: 'desc' }   // 최근에 틀린 것 우선
      ],
      include: {
        vocab: {
          include: {
            dictMeta: true
          }
        }
      },
      take: 200,
    });

    const data = wrongAnswers.map((wa) => {
      const v = wa.vocab;
      // gloss 찾기(있으면)
      let gloss = null;
      const ex = Array.isArray(v?.dictMeta?.examples) ? v.dictMeta.examples : [];
      const g = ex.find((e) => e && e.kind === 'gloss');
      if (g && typeof g.ko === 'string') gloss = g.ko;

      return {
        wrongAnswerId: wa.id,
        vocabId: wa.vocabId,
        lemma: v?.lemma ?? '',
        ipa: v?.dictMeta?.ipa ?? null,
        ipaKo: v?.dictMeta?.ipaKo ?? null,
        ko_gloss: gloss,
        attempts: wa.attempts,
        wrongAt: wa.wrongAt,
        reviewWindowStart: wa.reviewWindowStart,
        reviewWindowEnd: wa.reviewWindowEnd,
        canReview: new Date() >= wa.reviewWindowStart && new Date() <= wa.reviewWindowEnd
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
 * 새로운 WrongAnswer 모델 기반 오답 퀴즈 큐
 */
router.get('/queue', async (req, res) => {
  try {
    // 복습 가능한 오답들만 조회
    const { generateWrongAnswerQuiz } = require('../services/wrongAnswerService');
    const wrongAnswerQuiz = await generateWrongAnswerQuiz(req.user.id, 100);
    
    if (wrongAnswerQuiz.length === 0) {
      return res.json({ data: [] });
    }

    // vocabIds 추출
    const vocabIds = wrongAnswerQuiz.map(wa => wa.vocabId);
    const queue = await generateMcqQuizItems(prisma, req.user.id, vocabIds);
    
    // wrongAnswer 정보를 퀴즈에 추가
    const enrichedQueue = queue.map(q => {
      const wrongInfo = wrongAnswerQuiz.find(wa => wa.vocabId === q.vocabId);
      return {
        ...q,
        wrongAnswerId: wrongInfo?.wrongAnswerId,
        attempts: wrongInfo?.attempts,
        wrongAt: wrongInfo?.wrongAt,
        reviewWindowEnd: wrongInfo?.reviewWindowEnd
      };
    });
    
    return res.json({ data: enrichedQueue });
  } catch (e) {
    console.error('GET /odat-note/queue failed:', e);
    return res.status(500).json({ error: 'Failed to create quiz for incorrect notes' });
  }
});

module.exports = router;
