// server/routes/quiz.js
const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');
const { startOfKstDay, addKstDays } = require('../services/srsJobs');

// app.use('/quiz', auth, quizRoutes) 에서 auth 적용됨

router.post('/answer', async (req, res, next) => {
    try {
        const userId = req.user.id;
        let { folderId, cardId, correct } = req.body;

        // 형 변환/검증
        folderId = Number(folderId);
        cardId = Number(cardId);
        const isCorrect =
            correct === true || correct === 'true' || correct === 1 || correct === '1';

        if (!folderId || !cardId) {
            return res.status(400).json({ error: 'folderId, cardId 필요' });
        }

        // 폴더 소유 검증(루트/자식 모두 허용)
        const folder = await prisma.srsFolder.findFirst({
            where: { id: folderId, userId },
            select: { id: true, userId: true, date: true },
        });
        if (!folder) return res.status(404).json({ error: '폴더 없음' });

        const now = new Date();
        const next = isCorrect
            ? addKstDays(startOfKstDay(now), 3).toDate() // 정답 = +3일 00:00(KST)
            : addKstDays(startOfKstDay(now), 1).toDate(); // 오답 = +1일 00:00(KST)

        // 트랜잭션
        const result = await prisma.$transaction(async (tx) => {
            // 카드 존재/소유 검증
            const card = await tx.sRSCard.findFirst({
                where: { id: cardId, userId },
                select: { id: true, stage: true, correctTotal: true, wrongTotal: true },
            });
            if (!card) throw Object.assign(new Error('SRS 카드 없음'), { status: 404 });

            // 폴더 아이템 존재/소유 검증 (복합 유니크로 바로 업데이트)
            const existing = await tx.srsFolderItem.findUnique({
                where: { folderId_cardId: { folderId, cardId } },
                select: { id: true, learned: true, wrongCount: true },
            });
            if (!existing) {
                throw Object.assign(new Error('폴더 아이템 없음'), { status: 404 });
            }

            // 폴더 아이템 업데이트
            await tx.srsFolderItem.update({
                where: { folderId_cardId: { folderId, cardId } },
                data: isCorrect
                    ? { learned: true, lastReviewedAt: now }
                    : { learned: false, wrongCount: { increment: 1 }, lastReviewedAt: now },
            });

            // 카드 업데이트 (stage/통계/다음 복습일)
            await tx.sRSCard.update({
                where: { id: cardId },
                data: {
                    stage: isCorrect ? { increment: 1 } : { set: 0 },
                    nextReviewAt: next,
                    ...(isCorrect ? { correctTotal: { increment: 1 } } : { wrongTotal: { increment: 1 } }),
                },
            });

            // 오답노트 upsert
            if (!isCorrect) {
                await tx.odatNote.upsert({
                    where: { userId_cardId: { userId, cardId } },
                    update: { updatedAt: now },
                    create: { userId, cardId, createdAt: now, updatedAt: now },
                });
            }

            return {
                folderId,
                cardId,
                correct: isCorrect,
                nextReviewAt: next,
            };
        });

        return res.json({ ok: true, data: result });
    } catch (e) {
        if (e?.status) return res.status(e.status).json({ error: e.message });
        next(e);
    }
});

module.exports = router;
