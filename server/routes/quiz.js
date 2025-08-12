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

        // 새로운 SRS 로직 사용
        const { markAnswer } = require('../services/srsService');
        
        const result = await markAnswer(userId, {
            folderId: folderId,
            cardId: cardId,
            correct: isCorrect,
            vocabId: null // vocabId는 markAnswer 내부에서 조회
        });
        
        console.log('[QUIZ ANSWER] markAnswer result:', result);
        
        // 대기 상태이거나 복습 불가능한 경우 처리
        if (result.status === 'waiting') {
            return ok(res, {
                message: '대기 시간입니다. 복습해도 상태가 변경되지 않습니다.',
                waitingUntil: result.waitingUntil,
                canReview: false
            });
        }
        
        if (result.status === 'not_available') {
            return ok(res, {
                message: '현재 복습할 수 없는 상태입니다.',
                canReview: false
            });
        }
        
        // 성공적인 응답
        return ok(res, {
            correct: result.status === 'correct',
            stage: result.newStage,
            waitingUntil: result.waitingUntil,
            nextReviewAt: result.nextReviewAt,
            streakInfo: result.streakInfo,
            canReview: true
        });

        /*
        // 기존 트랜잭션 코드 - 새 로직으로 대체됨
        const result = await prisma.$transaction(async (tx) => {
            // 카드 존재/소유 검증
            const card = await tx.sRSCard.findFirst({
                where: { id: cardId, userId },
                select: { 
                    id: true, 
                    stage: true, 
                    correctTotal: true, 
                    wrongTotal: true, 
                    itemId: true,
                    isFromWrongAnswer: true,
                    isOverdue: true,
                    waitingUntil: true,
                    overdueDeadline: true
                },
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
                    // 이 부분은 새 로직에서 제거됨
                    // markAnswer 함수에서 처리
                });
                if (!existing) throw Object.assign(new Error('폴더 아이템 없음'), { status: 404 });
            }
            
            // 기존 복잡한 로직은 markAnswer 함수로 이동됨
            return { processed: true };
        });
        */

        // 오답노트 처리는 markAnswer 함수 내부에서 처리됨
        
        console.log('[QUIZ ANSWER] Final result:', result);
        
        // 성공적인 응답 반환
        return ok(res, {
            correct: result.status === 'correct',
            stage: result.newStage,
            waitingUntil: result.waitingUntil,
            nextReviewAt: result.nextReviewAt,
            streakInfo: result.streakInfo,
            canReview: true
        });
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
