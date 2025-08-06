// server/routes/vocab.js

const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');

router.post('/:id/bookmark', async (req, res) => {
    const vocabId = parseInt(req.params.id);
    const userId = req.user.id;

    if (isNaN(vocabId)) {
        return res.status(400).json({ error: 'Invalid vocab ID' });
    }

    const existing = await prisma.sRSCard.findFirst({
        where: { userId, itemId: vocabId }
    });

    if (existing) {
        return res.status(200).json({ ok: true, id: existing.id, already: true });
    }

    const newCard = await prisma.sRSCard.create({
        data: {
            userId,
            itemId: vocabId,
            itemType: 'vocab',   // ✅ 이 줄 필수
            stage: 0,
            lastResult: null,
            correctCount: 0,
            incorrectCount: 0,
            nextReviewAt: new Date()
        }
    });

    return res.status(200).json({ ok: true, id: newCard.id });
});

module.exports = router;
