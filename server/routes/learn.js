//server/routes/learn.js
const express = require('express');
const { createFlashBatches } = require('../services/srsService');
const { finishSession } = require('../services/sessionService');
const { bumpDailyStat } = require('../services/srsService');
const { prisma } = require('../lib/prismaClient');
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
router.post('/flash/finish', auth, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { sessionId, createFolder, cardIds, vocabIds } = req.body || {};
        
        console.log(`[LEARN FLASH FINISH] userId: ${userId}, cardIds: ${JSON.stringify(cardIds)}, vocabIds: ${JSON.stringify(vocabIds)}`);

        // ① cardIds가 직접 온 경우 기존 미학습 카드들을 overdue로 전환
        let resolvedCardIds = Array.isArray(cardIds) ? cardIds.map(Number) : [];
        if (resolvedCardIds.length > 0) {
            // cardIds로 직접 전달된 경우, 해당 카드들 중 미학습인 것들을 overdue로 전환
            const existingCards = await prisma.srscard.findMany({
                where: { 
                    id: { in: resolvedCardIds },
                    userId 
                },
                select: { id: true, stage: true, isOverdue: true }
            });
            
            const unlearnedCardIds = existingCards
                .filter(card => card.stage === 0 && !card.isOverdue)
                .map(card => card.id);
                
            if (unlearnedCardIds.length > 0) {
                console.log(`[LEARN FLASH FINISH] Updating ${unlearnedCardIds.length} unlearned cards to overdue:`, unlearnedCardIds);
                const updateResult = await prisma.srscard.updateMany({
                    where: { 
                        id: { in: unlearnedCardIds },
                        userId 
                    },
                    data: { isOverdue: true, nextReviewAt: new Date() }
                });
                console.log(`[LEARN FLASH FINISH] Update result:`, updateResult);
            }
        }
        
        // ② vocabIds가 온 경우 → SRSCard upsert 후 cardIds로 변환
        if ((!resolvedCardIds || resolvedCardIds.length === 0) && Array.isArray(vocabIds) && vocabIds.length > 0) {
            const uniqVocabIds = [...new Set(vocabIds.map(Number).filter(Boolean))];
            // 유저의 해당 단어 SRSCard 조회
            const existing = await prisma.srscard.findMany({
                where: { userId, itemType: 'vocab', itemId: { in: uniqVocabIds } },
                select: { id: true, itemId: true, stage: true, isOverdue: true }
            });
            const existMap = new Map(existing.map(e => [e.itemId, e.id]));
            
            // 기존 미학습 카드들(stage 0이고 overdue가 아닌 것들)을 overdue로 전환
            const unlearnedCards = existing.filter(card => card.stage === 0 && !card.isOverdue);
            if (unlearnedCards.length > 0) {
                console.log(`[LEARN FLASH FINISH] Updating ${unlearnedCards.length} unlearned vocab cards to overdue:`, unlearnedCards.map(c => c.id));
                const updateResult = await prisma.srscard.updateMany({
                    where: { 
                        id: { in: unlearnedCards.map(c => c.id) },
                        userId 
                    },
                    data: { isOverdue: true, nextReviewAt: new Date() }
                });
                console.log(`[LEARN FLASH FINISH] Vocab update result:`, updateResult);
            }
            
            const toCreate = uniqVocabIds.filter(vId => !existMap.has(vId))
                .map(vId => ({ userId, itemType: 'vocab', itemId: vId, stage: 0, nextReviewAt: new Date(), isOverdue: true }));
            if (toCreate.length) {
                await prisma.srscard.createMany({ data: toCreate });
            }
            // 다시 조회(또는 createMany({skipDuplicates:true}) 후 합쳐서 조회)
            const allCards = await prisma.srscard.findMany({
                where: { userId, itemType: 'vocab', itemId: { in: uniqVocabIds } },
                select: { id: true, itemId: true }
            });
            resolvedCardIds = allCards.map(x => x.id);
        }

        // 폴더 생성 기능은 일시적으로 비활성화
        // if (createFolder) {
        //     const f = await ensureTodayFolder(userId, sessionId ?? null);
        //     if (Array.isArray(resolvedCardIds) && resolvedCardIds.length) {
        //         await addItemsToFolder(userId, f.id, resolvedCardIds);
        //     }
        // }

        // 통계(자동학습 개수)

        if (Array.isArray(vocabIds) && vocabIds.length) {
            await bumpDailyStat(userId, { autoLearnedInc: vocabIds.length });
        }

        return res.status(204).end();
    } catch (e) { 
        console.error('[LEARN FLASH FINISH ERROR]', e);
        next(e); 
    }
});
router.use(auth);
/*
 * @route   POST /learn/session/finish
 * @desc    모든 학습 배치를 완료 처리하고, 오답률이 높은 단어로 폴더를 생성합니다.
 * @access  Private
 */
router.post('/session/finish', finishSession);

module.exports = router;
