// server/routes/vocab.js

const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');

router.get('/list', async (req, res) => {
    try {
        const { level, q } = req.query;
        const where = {};
        if (q && q.trim()) {
            where.lemma = { contains: q.trim() };
        } else {
            where.levelCEFR = level || 'A1';
        }
        const vocabs = await prisma.vocab.findMany({
            where,
            orderBy: { lemma: 'asc' },
            include: { dictMeta: { select: { examples: true, ipa: true, ipaKo: true, audioUrl: true } } }
        });
        
        // 프론트엔드가 { data: [...] } 형태로 응답을 기대하므로, 데이터를 가공합니다.
        const items = vocabs.map(v => {
            const meanings = Array.isArray(v.dictMeta?.examples) ? v.dictMeta.examples : [];
            let primaryGloss = null;
            if (meanings.length > 0 && meanings[0].definitions && meanings[0].definitions.length > 0) {
                primaryGloss = meanings[0].definitions[0].ko_def || null;
            }
            return { id: v.id, lemma: v.lemma, pos: v.pos, levelCEFR: v.levelCEFR, ko_gloss: primaryGloss, ipa: v.dictMeta?.ipa || null, ipaKo: v.dictMeta?.ipaKo || null, audio: v.dictMeta?.audioUrl || null };
        });

        return res.json({ data: items });

    } catch (e) {
        console.error('GET /vocab/list failed:', e);
        return res.status(500).json({ error: 'list query failed' });
    }
});


router.post('/:id/bookmark', async (req, res) => {
    const vocabId = parseInt(req.params.id);
    const userId = req.user.id;

    if (isNaN(vocabId)) {
        return res.status(400).json({ error: 'Invalid vocab ID' });
    }

    // itemType을 조건에 추가하여 더 정확하게 중복을 확인합니다.
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
            lastResult: null,
            correctCount: 0,
            incorrectCount: 0,
            nextReviewAt: new Date()
        }
    });

    return res.status(200).json({ ok: true, id: newCard.id });
});

module.exports = router;