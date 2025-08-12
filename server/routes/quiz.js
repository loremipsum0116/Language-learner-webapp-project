// server/routes/quiz.js
const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');
const { startOfKstDay, addKstDays } = require('../services/srsJobs');
const { ok, fail } = require('../lib/resp'); // ok, fail 헬퍼 임포트
const { generateMcqQuizItems } = require('../services/quizService'); // 퀴즈 생성 서비스 임포트
const { addWrongAnswer } = require('../services/wrongAnswerService'); // 오답노트 서비스
// ... (기존 require문들)

// app.use('/quiz', auth, quizRoutes) 에서 auth 적용됨


// ▼▼▼ 여기에 이 코드 블록을 추가하세요 ▼▼▼
/*
 * @route   POST /quiz/by-vocab
 * @desc    주어진 vocabId 목록으로 즉석 퀴즈를 생성합니다. (내 단어장 -> 자동학습)
 * @access  Private
 */
router.post('/by-vocab', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { vocabIds } = req.body;

        if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
            return fail(res, 400, 'vocabIds must be a non-empty array');
        }

        const quizItems = await generateMcqQuizItems(prisma, userId, vocabIds);
        return ok(res, quizItems); // data: [...] 형태로 응답

    } catch (e) {
        console.error('POST /quiz/by-vocab failed:', e);
        // next(e)를 사용하거나 fail 헬퍼로 직접 응답할 수 있습니다.
        return fail(res, 500, 'Failed to create quiz by vocab IDs');
    }
});
// ▲▲▲ 여기까지 추가 ▲▲▲

router.post('/answer', async (req, res, next) => {
    try {
        console.log('[QUIZ ANSWER] Request received:', {
            body: req.body,
            userId: req.user?.id
        });

        const userId = req.user.id;
        let { folderId, cardId, correct } = req.body;

        // 형 변환/검증
        folderId = folderId ? Number(folderId) : null; // folderId가 없으면 null로 설정
        cardId = Number(cardId);
        const isCorrect =
            correct === true || correct === 'true' || correct === 1 || correct === '1';

        if (!cardId) {
            return res.status(400).json({ error: 'cardId 필요' });
        }

        // 폴더 소유 검증(루트/자식 모두 허용) - folderId가 있을 때만
        let folder = null;
        if (folderId) {
            folder = await prisma.srsFolder.findFirst({
                where: { id: folderId, userId },
                select: { id: true, userId: true, date: true },
            });
            if (!folder) return res.status(404).json({ error: '폴더 없음' });
        }

        const now = new Date();

        // 트랜잭션
        const result = await prisma.$transaction(async (tx) => {
            // 카드 존재/소유 검증
            const card = await tx.sRSCard.findFirst({
                where: { id: cardId, userId },
                select: { id: true, stage: true, correctTotal: true, wrongTotal: true, itemId: true },
            });
            if (!card) throw Object.assign(new Error('SRS 카드 없음'), { status: 404 });

            // 폴더 소유 및 아이템 검증
            if (folderId) {
                const folder = await tx.srsFolder.findFirst({
                    where: { id: folderId, userId },
                    select: { id: true, userId: true, date: true },
                });
                if (!folder) throw Object.assign(new Error('폴더 없음'), { status: 404 });

                const existing = await tx.srsFolderItem.findUnique({
                    where: { folderId_cardId: { folderId, cardId } },
                    select: { id: true },
                });
                if (!existing) throw Object.assign(new Error('폴더 아이템 없음'), { status: 404 });

                // 폴더 아이템 업데이트 (한 번만 실행)
                await tx.srsFolderItem.update({
                    where: { folderId_cardId: { folderId, cardId } },
                    data: isCorrect
                        ? { learned: true, lastReviewedAt: now }
                        : { learned: false, wrongCount: { increment: 1 }, lastReviewedAt: now },
                });
            }

            // 카드 정보에서 현재 stage 가져오기
            const currentStage = card.stage || 0;
            let newStage, nextReviewAt;

            if (isCorrect) {
                // 정답 처리
                newStage = currentStage + 1;
                console.log(`[QUIZ CORRECT] Current stage: ${currentStage}, New stage: ${newStage}`);

                const { computeNextReviewDate } = require('../services/srsSchedule');

                // 1. 오답이었던 단어가 정답으로 해결된 경우 - 복습일이 된 경우에만 동기화
                if (currentStage === 0 && folderId) {
                    console.log(`[SYNC REVIEW] Wrong word corrected, checking if sync is due...`);

                    // 현재 카드의 nextReviewAt을 확인하여 복습일이 되었는지 체크
                    const currentCard = await tx.sRSCard.findUnique({
                        where: { id: cardId },
                        select: { nextReviewAt: true }
                    });

                    const todayKstStart = startOfKstDay(now);
                    const cardReviewDate = currentCard.nextReviewAt ?
                        startOfKstDay(currentCard.nextReviewAt) : null;

                    // 복습일이 오늘이거나 이미 지났을 때만 동기화
                    const isDueForSync = cardReviewDate &&
                        (cardReviewDate.isSame(todayKstStart, 'day') ||
                            cardReviewDate.isBefore(todayKstStart, 'day'));

                    console.log(`[SYNC REVIEW] Card review date: ${cardReviewDate?.format('YYYY-MM-DD')}, Today: ${todayKstStart.format('YYYY-MM-DD')}, isDue: ${isDueForSync}`);

                    if (isDueForSync) {
                        console.log(`[SYNC REVIEW] Wrong word is due for review, syncing with folder ${folderId}`);

                        // 같은 폴더의 다른 stage 1+ 카드들 중 가장 빠른 nextReviewAt 찾기
                        const folderCards = await tx.sRSCard.findMany({
                            where: {
                                userId,
                                stage: { gt: 0 },
                                folderItems: {
                                    some: { folderId }
                                }
                            },
                            select: { nextReviewAt: true },
                            orderBy: { nextReviewAt: 'asc' },
                            take: 1
                        });

                        if (folderCards.length > 0 && folderCards[0].nextReviewAt) {
                            // 동일 폴더 다른 단어들과 같은 날짜로 동기화
                            nextReviewAt = folderCards[0].nextReviewAt;
                            newStage = 1; // stage 1로 설정 (기존 정답 단어들과 같은 레벨)
                            console.log(`[SYNC REVIEW] Synchronized nextReviewAt to:`, nextReviewAt);
                        } else {
                            // 동기화할 다른 단어가 없으면 일반 SRS 로직
                            nextReviewAt = computeNextReviewDate(startOfKstDay(now).toDate(), newStage);
                            console.log(`[SYNC REVIEW] No other cards to sync with, using normal SRS logic`);
                        }
                    } else {
                        // 복습일이 아직 오지 않았으면 동기화하지 않고 일반 SRS 로직 사용
                        console.log(`[SYNC REVIEW] Not due for sync yet, using normal SRS logic`);
                        nextReviewAt = computeNextReviewDate(startOfKstDay(now).toDate(), newStage);
                    }
                } else {
                    // 2. 일반 정답 처리 (stage 1+ → stage 2+)
                    nextReviewAt = computeNextReviewDate(startOfKstDay(now).toDate(), newStage);
                    console.log(`[QUIZ CORRECT] Computing next review for stage ${newStage}`);
                }
            } else {
                // 오답: stage 0으로 리셋, 다음날 복습
                newStage = 0;
                // KST 기준 다음날 00:00으로 설정
                const tomorrow = startOfKstDay(now).add(1, 'day');
                const tomorrowKst = tomorrow.format('YYYY-MM-DD');
                nextReviewAt = new Date(tomorrowKst + 'T00:00:00.000Z');
                console.log(`[QUIZ WRONG] Setting next review to tomorrow: ${tomorrowKst}`);
            }

            // 카드 업데이트 (stage/통계/다음 복습일)
            await tx.sRSCard.update({
                where: { id: cardId },
                data: {
                    stage: newStage,
                    nextReviewAt: nextReviewAt,
                    ...(isCorrect ? { correctTotal: { increment: 1 } } : { wrongTotal: { increment: 1 } }),
                },
            });

            // 오답노트 처리
            const vocabId = card.itemId; // SRSCard의 itemId가 vocabId

            if (!isCorrect) {
                // 오답 시 WrongAnswer 모델에 추가
                console.log(`[QUIZ ANSWER] Adding wrong answer: userId=${userId}, vocabId=${vocabId}`);
                if (vocabId) {
                    try {
                        const wrongAnswerResult = await addWrongAnswer(userId, vocabId);
                        console.log(`[QUIZ ANSWER] Wrong answer added:`, wrongAnswerResult);
                    } catch (wrongAnswerError) {
                        console.error(`[QUIZ ANSWER] Failed to add wrong answer:`, wrongAnswerError);
                        // 오답노트 추가 실패해도 답변 제출은 계속 진행
                    }
                }
            } else {
                // 정답 시 오답노트에서 해당 단어 완료 처리
                console.log(`[QUIZ ANSWER] Completing wrong answer: userId=${userId}, vocabId=${vocabId}`);
                if (vocabId) {
                    try {
                        const { completeWrongAnswer } = require('../services/wrongAnswerService');
                        const completed = await completeWrongAnswer(userId, vocabId);
                        if (completed) {
                            console.log(`[QUIZ ANSWER] Wrong answer completed for vocabId=${vocabId}`);
                        }
                    } catch (completeError) {
                        console.error(`[QUIZ ANSWER] Failed to complete wrong answer:`, completeError);
                        // 오답노트 완료 실패해도 답변 제출은 계속 진행
                    }
                }
            }

            return {
                folderId,
                cardId,
                correct: isCorrect,
                newStage: newStage,
                nextReviewAt: nextReviewAt,
            };
        });

        return res.json({ ok: true, data: result });
    } catch (e) {
        console.error('[QUIZ ANSWER] Error occurred:', {
            message: e.message,
            stack: e.stack,
            code: e.code,
            status: e.status
        });

        if (e?.status) return res.status(e.status).json({ error: e.message });

        // 기본 500 에러 처리
        return res.status(500).json({ error: `Internal Server Error: ${e.message}` });
    }
});

module.exports = router;
