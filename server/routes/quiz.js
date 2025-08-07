/**
 * server/routes/quiz.js
 *
 * 1) 객관식·스펠링 등 모든 퀴즈 정답 제출 엔드포인트
 * 2) SRSCard pass/fail 처리 (간단 Leitner 0‣1‣2‣3 단계)
 * 3) SessionBatch.cards[].incorrect ← 0‣1 플래그 반영
 */

 const express  = require('express');
 const { generateMcqQuizItems } = require('../services/quizService'); // ← 추가
const router = express.Router();
const { prisma } = require('../lib/prismaClient');

/* ────────── Leitner 간격 (일) ────────── */
function intervalByStage(stage) {
    switch (stage) {
        case 0: return 1;   // 다음날
        case 1: return 3;   // 3일 뒤
        case 2: return 7;   // 7일 뒤
        default: return 14; // 2주
    }
}

/* ────────── POST /answer ────────── */


router.post('/by-vocab', async (req, res) => {
    try {
        const { vocabIds } = req.body || {};
        if (!Array.isArray(vocabIds)) {
            return res.status(400).json({ error: 'vocabIds must be an array' });
        }
        const items = await generateMcqQuizItems(prisma, req.user.id, vocabIds);
        return res.json({ data: items });
    } catch (e) {
        console.error('POST /quiz/by-vocab 오류:', e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/by-vocab', async (req, res, next) => {
  try {
    const ids = (req.query.ids || '')
      .split(',')
      .map(Number)
      .filter(Boolean);

    if (!ids.length)
      return res.status(400).json({ error: 'ids query required' });

    const items = await generateMcqQuizItems(ids);
    return res.json({ data: items });
  } catch (e) {
    next(e);          // 전역 에러 미들웨어로 전달
  }
});

router.post('/answer', async (req, res) => {
    try {
        const { cardId, correct } = req.body;
        if (!cardId || typeof correct !== 'boolean')
            return res.status(400).json({ error: 'cardId / correct 필수' });

        const card = await prisma.sRSCard.findUnique({ where: { id: cardId } });
        if (!card) return res.status(404).json({ error: 'card not found' });
        if (card.userId !== req.user.id)
            return res.status(403).json({ error: 'not your card' });

        // 1) SRSCard 상태 업데이트 (기존 로직)
        let newStage = card.stage;
        if (correct) newStage = Math.min(card.stage + 1, 3);
        else newStage = 0;

        await prisma.sRSCard.update({
            where: { id: cardId },
            data: {
                stage: newStage,
                lastResult: correct ? 'pass' : 'fail',
                nextReviewAt: new Date(Date.now() + intervalByStage(newStage) * 86400_000),
                correctCount: { increment: correct ? 1 : 0 },
                incorrectCount: { increment: correct ? 0 : 1 }
            }
        });

        // 2) SessionBatch 내 incorrect 플래그 업데이트 (✅ 수정된 로직)
        const batch = await prisma.sessionBatch.findFirst({
            where: {
                userId: req.user.id,
                cards: {
                    // JSON 배열 내에 특정 객체가 포함되어 있는지 검사합니다.
                    array_contains: [{ srsCardId: cardId }]
                }
            }
        });

        if (batch) {
            // JavaScript에서 cards 배열을 수정한 뒤,
            const updatedCards = batch.cards.map(cardInBatch => {
                if (cardInBatch.srsCardId === cardId) {
                    return { ...cardInBatch, incorrect: correct ? 0 : 1 };
                }
                return cardInBatch;
            });

            // 수정된 배열 전체를 다시 저장합니다.
            await prisma.sessionBatch.update({
                where: { id: batch.id },
                data: { cards: updatedCards }
            });
        }

        return res.json({ ok: true, nextStage: newStage });
    } catch (err) {
        console.error('quiz/answer error:', err);
        return res.status(500).json({ error: 'server error' });
    }
});

module.exports = router;