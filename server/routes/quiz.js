// server/routes/quiz.js
const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
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

            // 카드 정보에서 현재 stage와 nextReviewAt 가져오기
            const currentStage = card.stage || 0;
            const currentNextReviewAt = await tx.sRSCard.findUnique({
                where: { id: cardId },
                select: { nextReviewAt: true }
            });
            
            let newStage, nextReviewAt;
            let shouldUpdateReviewDate = false;

            // 복습일 체크: 현재 시각이 예정된 복습일 이후인지 확인
            // const todayKstStart = startOfKstDay(now);
            // const cardReviewDate = currentNextReviewAt.nextReviewAt ?
            //     startOfKstDay(currentNextReviewAt.nextReviewAt) : null;

            // 복습일 체크 로직 간소화
            let isDueForReview = false;
            
            if (!currentNextReviewAt.nextReviewAt) {
                // 복습일이 없는 새 카드는 항상 학습 가능하고 stage 진행 가능
                isDueForReview = true;
                console.log(`[QUIZ] New card (no review date) - always due for review`);
            } else {
                // 기존 카드: 복습일이 오늘이거나 이전인지 체크 (간단한 방법)
                const reviewDate = new Date(currentNextReviewAt.nextReviewAt);
                const now = new Date();
                
                // 날짜만 비교 (시간 제거)
                const reviewDateOnly = new Date(reviewDate.getFullYear(), reviewDate.getMonth(), reviewDate.getDate());
                const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                
                isDueForReview = reviewDateOnly <= todayOnly;
                
                console.log(`[QUIZ] Review date: ${reviewDateOnly.toISOString().split('T')[0]}, Today: ${todayOnly.toISOString().split('T')[0]}, Due: ${isDueForReview}`);
                console.log(`[QUIZ] Original review date: ${reviewDate.toISOString()}, Current time: ${now.toISOString()}`);
            }

            // console.log(`[QUIZ] Review date check: cardDate=${cardReviewDate?.format ? cardReviewDate.format('YYYY-MM-DD') : cardReviewDate}, today=${todayKstStart?.format ? todayKstStart.format('YYYY-MM-DD') : todayKstStart}, isDue=${isDueForReview}`);

            if (isCorrect) {
                // 정답 처리
                if (isDueForReview) {
                    // 복습일이 되었거나 지났으면 stage 진행 및 다음 복습일 설정
                    newStage = currentStage + 1;
                    shouldUpdateReviewDate = true;
                    
                    const { computeNextReviewDate } = require('../services/srsSchedule');
                    const todayStart = new Date();
                    todayStart.setHours(0, 0, 0, 0);
                    nextReviewAt = computeNextReviewDate(todayStart, newStage);
                    console.log(`[QUIZ CORRECT] Stage advanced: ${currentStage} -> ${newStage}, next review: ${nextReviewAt.toISOString().split('T')[0]}`);
                } else {
                    // 복습일 이전이면 stage는 그대로, 복습일도 그대로
                    newStage = currentStage;
                    nextReviewAt = currentNextReviewAt.nextReviewAt;
                    shouldUpdateReviewDate = false;
                    console.log(`[QUIZ CORRECT] Review not due yet, keeping stage ${currentStage} and review date ${nextReviewAt?.toISOString().split('T')[0]}`);
                }
            } else {
                // 오답 처리
                if (isDueForReview) {
                    // 복습일이 되었거나 지났으면 stage 0으로 리셋, 다음날 복습
                    newStage = 0;
                    shouldUpdateReviewDate = true;
                    // 다음날 00:00으로 설정
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    tomorrow.setHours(0, 0, 0, 0);
                    nextReviewAt = tomorrow;
                    console.log(`[QUIZ WRONG] Stage reset to 0, next review: ${tomorrow.toISOString().split('T')[0]}`);
                } else {
                    // 복습일 이전이면 stage는 그대로, 복습일도 그대로 (오답 통계만 증가)
                    newStage = currentStage;
                    nextReviewAt = currentNextReviewAt.nextReviewAt;
                    shouldUpdateReviewDate = false;
                    console.log(`[QUIZ WRONG] Review not due yet, keeping stage ${currentStage} and review date ${nextReviewAt?.toISOString().split('T')[0]}`);
                }
            }

            // 카드 업데이트 (stage/통계/다음 복습일)
            const updateData = {};
            
            // 통계 업데이트 (복습일일 때만 적용)
            if (isCorrect) {
                updateData.correctTotal = { increment: 1 };
            } else if (isDueForReview) {
                // 복습일일 때만 오답 횟수 증가
                updateData.wrongTotal = { increment: 1 };
                
                // 같은 단어의 다른 모든 SRS 카드의 wrongTotal도 증가
                await tx.sRSCard.updateMany({
                    where: {
                        userId: userId,
                        itemType: 'vocab',
                        itemId: card.itemId,
                        id: { not: cardId } // 현재 카드는 제외 (아래에서 업데이트)
                    },
                    data: {
                        wrongTotal: { increment: 1 }
                    }
                });
                console.log(`[QUIZ] ✅ WRONG TOTAL INCREMENTED - vocab ${card.itemId} (review was due)`);
            } else {
                // 복습일이 아닐 때는 오답 횟수 증가 안함
                console.log(`[QUIZ] ❌ NO WRONG TOTAL INCREMENT - vocab ${card.itemId} (review not due yet)`);
            }
            
            // 복습일이 되었거나 오답인 경우에만 stage와 nextReviewAt 업데이트
            if (shouldUpdateReviewDate) {
                updateData.stage = newStage;
                updateData.nextReviewAt = nextReviewAt;
                console.log(`[QUIZ] Updating card: stage=${newStage}, nextReviewAt=${nextReviewAt?.toISOString().split('T')[0]}`);
            } else {
                console.log(`[QUIZ] Updating only stats, keeping existing stage and review date`);
            }
            
            await tx.sRSCard.update({
                where: { id: cardId },
                data: updateData,
            });

            // 오답노트 처리
            const vocabId = card.itemId; // SRSCard의 itemId가 vocabId

            // 오답노트 처리는 트랜잭션 완료 후 처리
            return {
                folderId,
                cardId,
                correct: isCorrect,
                newStage: newStage,
                nextReviewAt: nextReviewAt,
                vocabId: vocabId, // 트랜잭션 완료 후 처리를 위해 추가
                isDueForReview: isDueForReview, // 오답노트 처리 여부를 위해 추가
            };
        });

        // 트랜잭션 완료 후 오답노트 처리
        console.log(`[QUIZ ANSWER] Processing result:`, { vocabId: result.vocabId, correct: result.correct, userId });
        if (result.vocabId) {
            try {
                if (!isCorrect && result.isDueForReview) {
                    // 오답 시 WrongAnswer 모델에 추가 (복습일인 경우만)
                    console.log(`[QUIZ ANSWER] Adding wrong answer: userId=${userId}, vocabId=${result.vocabId}`);
                    const { addWrongAnswer } = require('../services/wrongAnswerService');
                    const wrongResult = await addWrongAnswer(userId, result.vocabId);
                    console.log(`[QUIZ ANSWER] Wrong answer added successfully:`, wrongResult);
                    
                    // 추가 검증: 실제로 저장되었는지 확인
                    const verification = await prisma.wrongAnswer.findFirst({
                        where: { userId, vocabId: result.vocabId, isCompleted: false },
                        select: { id: true, wrongAt: true, attempts: true }
                    });
                    console.log(`[QUIZ ANSWER] Verification check:`, verification);
                } else if (!isCorrect && !result.isDueForReview) {
                    // 복습일이 아닌 날의 오답은 오답노트에 추가하지 않음
                    console.log(`[QUIZ ANSWER] Wrong answer but not due for review - no odat-note addition for vocab ${result.vocabId}`);
                } else if (result.isDueForReview) {
                    // 정답 시 오답노트에서 해당 단어 완료 처리 (복습일인 경우만)
                    console.log(`[QUIZ ANSWER] Completing wrong answer: userId=${userId}, vocabId=${result.vocabId}`);
                    const { completeWrongAnswer } = require('../services/wrongAnswerService');
                    const completed = await completeWrongAnswer(userId, result.vocabId);
                    if (completed) {
                        console.log(`[QUIZ ANSWER] Wrong answer completed for vocabId=${result.vocabId}`);
                    }
                }
            } catch (wrongAnswerError) {
                console.error(`[QUIZ ANSWER] Failed to process wrong answer:`, wrongAnswerError);
                console.error(`[QUIZ ANSWER] Error stack:`, wrongAnswerError.stack);
                // 오답노트 처리 실패해도 답변 제출은 성공으로 처리
            }
        }

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
