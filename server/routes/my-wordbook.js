// server/routes/my-wordbook.js
const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');
const { ok, fail } = require('../lib/resp'); // fail 헬퍼 임포트

// GET /my-wordbook (기존 코드 유지)
router.get('/', async (req, res) => {
    try {
        const { categoryId } = req.query;
        const where = { userId: req.user.id };

        if (categoryId === 'none') {
            where.categoryId = null;
        } else if (categoryId) {
            where.categoryId = parseInt(categoryId);
        }

        const items = await prisma.uservocab.findMany({
            where,
            include: { vocab: { include: { dictentry: true } } },
            orderBy: { createdAt: 'desc' }
        });

        // SRS 카드 정보를 별도로 조회
        const vocabIds = items.map(item => item.vocabId);
        const srsCards = vocabIds.length > 0 ? await prisma.srscard.findMany({
            where: {
                userId: req.user.id,
                itemType: 'vocab',
                itemId: { in: vocabIds }
            },
            select: {
                itemId: true,
                correctTotal: true,
                wrongTotal: true,
                stage: true,
                nextReviewAt: true
            }
        }) : [];

        // SRS 카드 정보 매핑
        const srsCardMap = new Map(srsCards.map(card => [card.itemId, card]));

        const processedItems = items.map(item => {
            if (!item.vocab) return item;
            const examples = item.vocab.dictentry?.examples || [];
            let gloss = null;
            if (examples[0]?.definitions?.[0]) {
                gloss = examples[0].definitions[0].ko_def || null;
            }
            
            // SRS 카드 정보 포함
            const srsCard = srsCardMap.get(item.vocabId);
            
            return { 
                ...item, 
                vocab: { ...item.vocab, ko_gloss: gloss },
                srsCard: srsCard || null
            };
        });

        return res.json({ data: processedItems });
    } catch (e) {
        console.error('GET /my-wordbook failed:', e);
        return res.status(500).json({ error: 'Failed to load wordbook' });
    }
});

// POST /my-wordbook/add (기존 코드 유지)
router.post('/add', async (req, res) => {
    try {
        const { vocabId } = req.body;
        if (!vocabId) {
            return res.status(400).json({ error: 'vocabId is required' });
        }

        const userId = req.user.id;
        const id = parseInt(vocabId);

        const existing = await prisma.uservocab.findUnique({
            where: {
                userId_vocabId: { userId, vocabId: id }
            }
        });

        if (existing) {
            return res.status(200).json({ data: existing, meta: { already: true } });
        }

        const newItem = await prisma.uservocab.create({
            data: { userId, vocabId: id }
        });

        return res.status(201).json({ data: newItem, meta: { created: true } });
    } catch (e) {
        console.error('POST /my-wordbook/add failed:', e);
        return res.status(500).json({ error: 'Failed to add word to wordbook' });
    }
});

// POST /my-wordbook/add-many (기존 코드 유지)
router.post('/add-many', async (req, res) => {
    const { vocabIds } = req.body;
    if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
        return fail(res, 400, 'vocabIds must be a non-empty array');
    }

    const userId = req.user.id;
    const idsToProcess = vocabIds.map(Number).filter(id => !isNaN(id));

    try {
        const existing = await prisma.uservocab.findMany({
            where: { userId, vocabId: { in: idsToProcess } },
            select: { vocabId: true }
        });
        const existingIds = new Set(existing.map(e => e.vocabId));

        const newData = idsToProcess
            .filter(id => !existingIds.has(id))
            .map(vocabId => ({ userId, vocabId }));

        if (newData.length > 0) {
            const result = await prisma.uservocab.createMany({ data: newData });
            return ok(res, { count: result.count });
        }

        return ok(res, { count: 0 });
    } catch (e) {
        console.error('POST /my-wordbook/add-many failed:', e);
        return fail(res, 500, 'Failed to add words');
    }
});


// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★★★★★      이 부분이 문제를 해결합니다     ★★★★★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

// POST /my-wordbook/remove-many (✅ 누락된 삭제 라우트 추가)
router.post('/remove-many', async (req, res) => {
    const { vocabIds, categoryId } = req.body;
    if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
        return fail(res, 400, 'vocabIds must be a non-empty array');
    }

    const userId = req.user.id;
    const idsToDelete = vocabIds.map(Number).filter(id => !isNaN(id));

    try {
        // 1. 먼저 해당 폴더(카테고리)의 SRS 카드들을 삭제
        if (categoryId !== undefined) {
            const folderId = categoryId === 'none' ? null : parseInt(categoryId);
            
            // 해당 폴더의 SRS 카드들 조회
            const srsCards = await prisma.srscard.findMany({
                where: {
                    userId: userId,
                    itemType: 'vocab',
                    itemId: { in: idsToDelete },
                    folderId: folderId
                },
                select: { id: true }
            });
            
            const cardIds = srsCards.map(card => card.id);
            
            if (cardIds.length > 0) {
                // SRS 폴더 아이템들 삭제
                await prisma.srsfolderitem.deleteMany({
                    where: { cardId: { in: cardIds } }
                });
                
                // SRS 카드들 삭제
                await prisma.srscard.deleteMany({
                    where: { id: { in: cardIds } }
                });
                
                console.log(`Deleted ${cardIds.length} SRS cards for vocab deletion`);
            }
            
            // 2. 해당 폴더의 오답노트 항목들 삭제
            const deletedWrongAnswers = await prisma.wronganswer.deleteMany({
                where: {
                    userId: userId,
                    vocabId: { in: idsToDelete },
                    folderId: folderId
                }
            });
            
            console.log(`Deleted ${deletedWrongAnswers.count} wrong answer entries for vocab deletion`);
        }

        // 3. 마지막으로 사용자 단어장에서 삭제
        const result = await prisma.uservocab.deleteMany({
            where: {
                userId: userId,
                vocabId: { in: idsToDelete }
            }
        });

        console.log(`Deleted ${result.count} vocab entries from user wordbook`);
        
        // 삭제된 개수를 반환합니다.
        return ok(res, { count: result.count });

    } catch (e) {
        console.error('POST /my-wordbook/remove-many failed:', e);
        return fail(res, 500, 'Failed to remove words from wordbook');
    }
});

module.exports = router;
