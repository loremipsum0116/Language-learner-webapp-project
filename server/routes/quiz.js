const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');
const { generateMcqQuizItems } = require('../services/quizService');  // ✔︎ 통일된 시그니처

/* ────────── Leitner 간격 (일) ────────── */
function intervalByStage(stage) {
    switch (stage) {
        case 0: return 1;
        case 1: return 3;
        case 2: return 7;
        default: return 14;
    }
}

/* ────────── POST /quiz/by-vocab ────────── */
router.post('/by-vocab', async (req, res) => {
    try {
        const { vocabIds } = req.body || {};
        if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
            return res.status(400).json({ error: 'vocabIds must be a non-empty array' });
        }

        const items = await generateMcqQuizItems(req.user.id, vocabIds);
        return res.json({ data: items });
    } catch (e) {
        console.error('POST /quiz/by-vocab 오류:', e.stack);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/* ────────── POST /quiz/answer ────────── */
router.post('/answer', async (req, res) => {
    try {
        const { cardId, correct } = req.body;

        if (!cardId || typeof correct !== 'boolean') {
            return res.status(400).json({ error: 'cardId and correct(boolean) are required' });
        }

        const card = await prisma.sRSCard.findUnique({ where: { id: cardId } });
        if (!card) return res.status(404).json({ error: 'Card not found' });
        if (card.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

        let newStage = correct ? Math.min(card.stage + 1, 3) : 0;

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

        const batch = await prisma.sessionBatch.findFirst({
            where: {
                userId: req.user.id,
                cards: {
                    array_contains: [{ srsCardId: cardId }]
                }
            }
        });

        if (batch) {
            const updatedCards = batch.cards.map(cardInBatch =>
                cardInBatch.srsCardId === cardId
                    ? { ...cardInBatch, incorrect: correct ? 0 : 1 }
                    : cardInBatch
            );

            await prisma.sessionBatch.update({
                where: { id: batch.id },
                data: { cards: updatedCards }
            });
        }

        return res.json({ ok: true, nextStage: newStage });
    } catch (err) {
        console.error('POST /quiz/answer 오류:', err.stack);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
