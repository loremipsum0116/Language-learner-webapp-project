//server/routes/learn.js
const express = require('express');
const { createFlashBatches } = require('../services/srsService');
const { finishSession } = require('../services/sessionService');
const { ensureTodayFolder, addItemsToFolder, bumpDailyStat } = require('../services/srsService');
const auth = require('../middleware/auth');
const router = express.Router();


/*
 * @route   POST /learn/flash/start
 * @desc    오늘 학습할 단어들로 SessionBatch를 생성합니다.
 * @access  Private
 */
router.post('/flash/start', async (req, res) => {
    try {
        await createFlashBatches(req.user.id);
        // 성공 시, 본문(body) 없이 204 No Content 상태 코드를 반환합니다.
        // 이는 "요청은 성공했지만 클라이언트에게 보낼 데이터는 없다"는 의미입니다.
        res.sendStatus(204);
    } catch (e) {
        console.error('POST /learn/flash/start failed:', e);
        res.status(500).json({ error: 'Failed to start learning session.' });
    }
});
router.post('/learn/flash/finish', auth, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { sessionId, createFolder, cardIds, vocabIds } = req.body || {};

        // ① vocabIds가 온 경우 → SRSCard upsert 후 cardIds로 변환
        let resolvedCardIds = Array.isArray(cardIds) ? cardIds.map(Number) : [];
        if ((!resolvedCardIds || resolvedCardIds.length === 0) && Array.isArray(vocabIds) && vocabIds.length > 0) {
            const uniqVocabIds = [...new Set(vocabIds.map(Number).filter(Boolean))];
            // 유저의 해당 단어 SRSCard 조회
            const existing = await prisma.sRSCard.findMany({
                where: { userId, itemType: 'vocab', itemId: { in: uniqVocabIds } },
                select: { id: true, itemId: true }
            });
            const existMap = new Map(existing.map(e => [e.itemId, e.id]));
            const toCreate = uniqVocabIds.filter(vId => !existMap.has(vId))
                .map(vId => ({ userId, itemType: 'vocab', itemId: vId, stage: 0, nextReviewAt: new Date() }));
            if (toCreate.length) {
                await prisma.sRSCard.createMany({ data: toCreate });
            }
            // 다시 조회(또는 createMany({skipDuplicates:true}) 후 합쳐서 조회)
            const allCards = await prisma.sRSCard.findMany({
                where: { userId, itemType: 'vocab', itemId: { in: uniqVocabIds } },
                select: { id: true, itemId: true }
            });
            resolvedCardIds = allCards.map(x => x.id);
        }

        if (createFolder) {
            const f = await ensureTodayFolder(userId, sessionId ?? null);

            if (Array.isArray(resolvedCardIds) && resolvedCardIds.length) {
                await addItemsToFolder(userId, f.id, resolvedCardIds);
            }
        }

        // 통계(자동학습 개수)

        if (Array.isArray(vocabIds) && vocabIds.length) {
            await bumpDailyStat(userId, { autoLearnedInc: vocabIds.length });
        }

        return res.status(204).end();
    } catch (e) { next(e); }
});
router.use(auth);
/*
 * @route   POST /learn/session/finish
 * @desc    모든 학습 배치를 완료 처리하고, 오답률이 높은 단어로 폴더를 생성합니다.
 * @access  Private
 */
router.post('/session/finish', finishSession);

module.exports = router;
