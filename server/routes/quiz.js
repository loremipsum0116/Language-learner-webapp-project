/**
 * server/routes/quiz.js
 *
 * 1) 객관식·스펠링 등 모든 퀴즈 정답 제출 엔드포인트
 * 2) SRSCard pass/fail 처리 (간단 Leitner 0‣1‣2‣3 단계)
 * 3) SessionBatch.cards[].incorrect ← 0‣1 플래그 반영
 */

const express = require('express');
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

/* ────────── POST /quiz/answer ────────── */
router.post('/quiz/answer', async (req, res) => {
    try {
        const { cardId, correct } = req.body;          // correct: boolean
        if (!cardId || typeof correct !== 'boolean')
            return res.status(400).json({ error: 'cardId / correct 필수' });

        /* 1) 카드 존재 & 소유자 확인 */
        const card = await prisma.sRSCard.findUnique({ where: { id: cardId } });
        if (!card) return res.status(404).json({ error: 'card not found' });
        if (card.userId !== req.user.id)
            return res.status(403).json({ error: 'not your card' });

        /* 2) PASS / FAIL 처리 */
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

        /* 3) SessionBatch 내 incorrect 플래그 업데이트 (있을 때만) */
        await prisma.sessionBatch.updateMany({
            where: {
                userId: req.user.id,
                cards: { some: { srsCardId: cardId } }
            },
            data: {
                cards: {
                    updateMany: {
                        where: { srsCardId: cardId },
                        data: { incorrect: correct ? 0 : 1 }
                    }
                }
            }
        });

        return res.json({ ok: true, nextStage: newStage });
    } catch (err) {
        console.error('quiz/answer error:', err);
        return res.status(500).json({ error: 'server error' });
    }
});

module.exports = router;
