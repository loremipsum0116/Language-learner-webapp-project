const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');
const { ok, fail } = require('../lib/resp'); // 응답 헬퍼 추가
const dayjs = require('dayjs');
const { generateMcqQuizItems } = require('../services/quizService');

// =================================================================
//                        HELPER FUNCTIONS
// =================================================================

// function shuffleArray(array) {
//     for (let i = array.length - 1; i > 0; i--) {
//         const j = Math.floor(Math.random() * (i + 1));
//         [array[i], array[j]] = [array[j], array[i]];
//     }
//     return array;
// }


/**
 * ✅ [최종 수정본] 안정적으로 퀴즈 데이터를 생성하는 함수
 * 이 함수는 어떤 경우에도 항상 'options' 배열을 포함한 완전한 퀴즈 객체를 반환합니다.
 */
// async function generateMcqQuizItems(prisma, userId, vocabIds) {
//     if (!vocabIds || vocabIds.length === 0) return [];
//     const ids = vocabIds.map(Number).filter(Number.isFinite);
//     if (ids.length === 0) return [];

//     const [vocabs, cards, distractorPool] = await Promise.all([
//         prisma.vocab.findMany({ where: { id: { in: ids } }, include: { dictMeta: true } }),
//         prisma.sRSCard.findMany({ where: { userId, itemType: 'vocab', itemId: { in: ids } }, select: { id: true, itemId: true } }),
//         prisma.vocab.findMany({ where: { id: { notIn: ids }, dictMeta: { isNot: null } }, include: { dictMeta: true }, take: 500 }),
//     ]);

//     const cardIdMap = new Map(cards.map(c => [c.itemId, c.id]));
//     const distractorGlosses = new Set();
//     distractorPool.forEach(v => {
//         const examples = Array.isArray(v.dictMeta?.examples) ? v.dictMeta.examples : [];
//         const glossEntry = examples.find(ex => ex.kind === 'gloss' && ex.ko) || examples.find(ex => ex.definitions?.[0]?.ko_def);
//         let gloss = glossEntry?.ko || glossEntry?.definitions?.[0]?.ko_def;
//         if (gloss) distractorGlosses.add(gloss.split(';')[0].split(',')[0].trim());
//     });

//     const pickN = (arr, n) => [...arr].sort(() => 0.5 - Math.random()).slice(0, n);

//     const quizItems = [];
//     for (const vocab of vocabs) {
//         if (!vocab.dictMeta) continue;

//         const examples = Array.isArray(vocab.dictMeta.examples) ? vocab.dictMeta.examples : [];
//         const glossEntry = examples.find(ex => ex.kind === 'gloss' && ex.ko) || examples.find(ex => ex.definitions?.[0]?.ko_def);
//         const correct = glossEntry?.ko || glossEntry?.definitions?.[0]?.ko_def;

//         if (!correct) continue;

//         const localDistractors = new Set(distractorGlosses);
//         localDistractors.delete(correct);
//         const wrongOptions = pickN(Array.from(localDistractors), 3);
//         const options = [correct, ...wrongOptions];
//         while (options.length < 4) options.push("관련 없는 뜻");

//         quizItems.push({
//             cardId: cardIdMap.get(vocab.id) || null,
//             vocabId: vocab.id,
//             question: vocab.lemma,
//             answer: correct,
//             quizType: 'mcq',
//             options: shuffleArray(options),
//             pron: { ipa: vocab.dictMeta.ipa, ipaKo: vocab.dictMeta.ipaKo },
//             levelCEFR: vocab.levelCEFR,
//             pos: vocab.pos,
//             vocab: vocab,
//         });
//     }
//     return quizItems;
// }

// =================================================================
//                           API ROUTES
// =================================================================

// GET /srs/queue - SRS 학습 퀴즈 생성
router.get('/queue', async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit || 20), 100);
        const cards = await prisma.sRSCard.findMany({
            where: { userId: req.user.id, itemType: 'vocab', active: true, nextReviewAt: { lte: new Date() } },
            orderBy: { nextReviewAt: 'asc' },
            take: limit,
            select: { itemId: true },
        });
        if (cards.length === 0) return res.json({ data: [] });
        const vocabIds = cards.map(c => c.itemId);
        const queue = await generateMcqQuizItems(prisma, req.user.id, vocabIds);
        return res.json({ data: queue });
    } catch (e) {
        console.error('GET /srs/queue Error:', e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}); // <--- FIX: Added closing brace and parenthesis here

router.get('/dashboard', async (req, res) => {
    try {
        const cards = await prisma.sRSCard.findMany({
            where: { userId: req.user.id, active: true },
            orderBy: { nextReviewAt: 'asc' },
            select: { id: true, nextReviewAt: true, updatedAt: true, lastResult: true, incorrectCount: true }
        });

        // 날짜별로 폴더 데이터 집계
        const folders = cards.reduce((acc, card) => {
            const dateStr = dayjs(card.nextReviewAt).format('YYYY-MM-DD');
            if (!acc[dateStr]) {
                acc[dateStr] = { date: dateStr, total: 0, completed: 0, incorrect: 0, cardIds: [] };
            }
            acc[dateStr].total++;
            acc[dateStr].cardIds.push(card.id);
            if (card.lastResult === 'pass' && dayjs(card.updatedAt).isSame(dayjs(), 'day')) {
                acc[dateStr].completed++;
            }
            if (card.incorrectCount > 0) {
                acc[dateStr].incorrect++;
            }
            return acc;
        }, {});

        // 객체를 배열로 변환하여 정렬
        const folderArray = Object.values(folders).sort((a, b) => a.date.localeCompare(b.date));
        return ok(res, folderArray);
    } catch (e) {
        return fail(res, 500, '대시보드 데이터를 불러오는 데 실패했습니다.');
    }
});

router.get('/quiz', async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return fail(res, 400, '날짜를 지정해야 합니다.');

        const startOfDay = dayjs(date).startOf('day').toDate();
        const endOfDay = dayjs(date).endOf('day').toDate();

        const cards = await prisma.sRSCard.findMany({
            where: {
                userId: req.user.id,
                active: true,
                nextReviewAt: { gte: startOfDay, lte: endOfDay }
            },
            select: { itemId: true }
        });

        const vocabIds = cards.map(c => c.itemId);
        const quizItems = await generateMcqQuizItems(prisma, req.user.id, vocabIds);
        return ok(res, quizItems);
    } catch (e) {
        return fail(res, 500, '퀴즈를 생성하는 데 실패했습니다.');
    }
});
router.post('/create-many', async (req, res) => {
    const { vocabIds } = req.body;
    if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
        return fail(res, 400, 'vocabIds는 빈 배열이 아니어야 합니다.');
    }
    const userId = req.user.id;

    const existing = await prisma.sRSCard.findMany({
        where: { userId, itemId: { in: vocabIds }, itemType: 'vocab' },
        select: { itemId: true }
    });
    const existingIds = new Set(existing.map(e => e.itemId));

    if (vocabIds.every(id => existingIds.has(id))) {
        return fail(res, 409, '이미 해당 폴더에 추가된 단어입니다.');
    }

    const toCreate = vocabIds
        .filter(id => !existingIds.has(id))
        .map(vocabId => ({
            userId,
            itemId: vocabId,
            itemType: 'vocab',
            stage: 0,
            nextReviewAt: new Date() // 오늘 바로 학습하도록 설정
        }));

    const result = await prisma.sRSCard.createMany({ data: toCreate });
    return ok(res, { count: result.count });
});


// GET /srs/all-cards - 사용자의 모든 SRS 카드 목록 조회
router.get('/all-cards', async (req, res) => {
    try {
        const cards = await prisma.sRSCard.findMany({
            where: { userId: req.user.id, itemType: 'vocab', active: true },
            select: { id: true, itemId: true, nextReviewAt: true, stage: true }
        });
        if (cards.length === 0) return res.json({ data: [] });

        const vocabIds = cards.map(card => card.itemId);
        const vocabs = await prisma.vocab.findMany({ where: { id: { in: vocabIds } }, include: { dictMeta: true } });
        const vocabMap = new Map(vocabs.map(v => [v.id, v]));

        const result = cards.map(card => {
            const vocab = vocabMap.get(card.itemId);
            if (!vocab) return null;
            const gloss = Array.isArray(vocab.dictMeta?.examples) ? vocab.dictMeta.examples.find(ex => ex?.kind === 'gloss')?.ko : null;
            return {
                cardId: card.id,
                vocabId: card.itemId,
                lemma: vocab.lemma,
                ko_gloss: gloss,
                nextReviewAt: card.nextReviewAt,
                stage: card.stage,
                ipa: vocab.dictMeta?.ipa,
                ipaKo: vocab.dictMeta?.ipaKo
            };
        }).filter(Boolean);

        return res.json({ data: result });
    } catch (e) {
        console.error('GET /srs/all-cards Error:', e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /srs/create-many - 여러 단어를 SRS에 추가
router.post('/create-many', async (req, res) => {
    const { vocabIds } = req.body;
    if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
        return res.status(400).json({ error: 'vocabIds must be a non-empty array' });
    }
    const userId = req.user.id;
    let createdCount = 0;
    try {
        for (const vocabId of vocabIds) {
            const existing = await prisma.sRSCard.findFirst({ where: { userId, itemId: vocabId, itemType: 'vocab' } });
            if (!existing) {
                await prisma.sRSCard.create({
                    data: { userId, itemId: vocabId, itemType: 'vocab', stage: 0, nextReviewAt: new Date() }
                });
                createdCount++;
            }
        }
        return res.json({ data: { count: createdCount } });
    } catch (e) {
        console.error('POST /srs/create-many failed:', e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /srs/replace-deck - 기존 SRS 덱을 새 단어들로 교체
router.post('/replace-deck', async (req, res) => {
    const { vocabIds } = req.body;
    if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
        return res.status(400).json({ error: 'vocabIds must be a non-empty array' });
    }
    const userId = req.user.id;
    const uniqueVocabIds = [...new Set(vocabIds.map(Number).filter(Boolean))];
    try {
        await prisma.$transaction(async (tx) => {
            await tx.sRSCard.deleteMany({ where: { userId: userId, itemType: 'vocab' } });
            const dataToCreate = uniqueVocabIds.map(id => ({ userId: userId, itemType: 'vocab', itemId: id, stage: 0, nextReviewAt: new Date() }));
            if (dataToCreate.length > 0) {
                await tx.sRSCard.createMany({ data: dataToCreate });
            }
        });
        return res.json({ data: { message: `Successfully replaced SRS deck with ${uniqueVocabIds.length} cards.` } });
    } catch (e) {
        console.error('POST /srs/replace-deck failed:', e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
