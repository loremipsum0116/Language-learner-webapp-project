// server/routes/quiz.js
const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
const { prisma } = require('../lib/prismaClient');
const { startOfKstDay, addKstDays } = require('../services/srsJobs');
const { ok, fail } = require('../lib/resp'); // ok, fail 헬퍼 임포트
const {
    generateMcqQuizItems,
    generateQuizByLanguageAndType,
    detectLanguage
} = require('../services/quizService'); // 퀴즈 생성 서비스 임포트
const { addWrongAnswer } = require('../services/wrongAnswerService'); // 오답노트 서비스
// ... (기존 require문들)

// app.use('/quiz', auth, quizRoutes) 에서 auth 적용됨


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
        return fail(res, 500, 'Failed to create quiz by vocab IDs');
    }
});

/*
 * @route   POST /quiz/japanese
 * @desc    일본어 전용 퀴즈를 생성합니다. (일본어 SRS 시스템)
 * @access  Private
 */
router.post('/japanese', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { vocabIds, quizType = 'jp_word_to_ko_meaning' } = req.body;

        if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
            return fail(res, 400, 'vocabIds must be a non-empty array');
        }

        // 지원되는 일본어 퀴즈 타입 확인
        const supportedTypes = [
            'jp_word_to_ko_meaning',
            'ko_meaning_to_jp_word',
            'jp_word_to_romaji',
            'jp_fill_in_blank',
            'jp_mixed'
        ];

        if (!supportedTypes.includes(quizType)) {
            return fail(res, 400, `Unsupported quiz type. Supported types: ${supportedTypes.join(', ')}`);
        }

        console.log(`[JAPANESE QUIZ] Generating ${quizType} quiz for vocabIds:`, vocabIds);

        const quizItems = await generateQuizByLanguageAndType(
            prisma,
            userId,
            vocabIds,
            quizType,
            'ja'
        );

        console.log(`[JAPANESE QUIZ] Generated ${quizItems.length} quiz items`);

        return ok(res, {
            quizItems,
            quizType,
            language: 'ja',
            totalItems: quizItems.length
        });

    } catch (e) {
        console.error('POST /quiz/japanese failed:', e);
        return fail(res, 500, 'Failed to create Japanese quiz');
    }
});

/*
 * @route   POST /quiz/by-language
 * @desc    언어별 퀴즈를 생성합니다. (언어 자동 감지 또는 명시)
 * @access  Private
 */
router.post('/by-language', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { vocabIds, language, quizType } = req.body;

        if (!Array.isArray(vocabIds) || vocabIds.length === 0) {
            return fail(res, 400, 'vocabIds must be a non-empty array');
        }

        let detectedLanguage = language;

        // 언어가 명시되지 않은 경우 첫 번째 단어로 언어 감지
        if (!detectedLanguage && vocabIds.length > 0) {
            const sampleVocab = await prisma.vocab.findFirst({
                where: { id: vocabIds[0] },
                select: { categories: true, kana: true, romaji: true }
            });

            if (sampleVocab) {
                detectedLanguage = detectLanguage(sampleVocab);
                console.log(`[QUIZ BY LANGUAGE] Detected language: ${detectedLanguage} for vocab ${vocabIds[0]}`);
            }
        }

        // 기본값 설정
        detectedLanguage = detectedLanguage || 'en';

        // 퀴즈 타입 기본값 설정
        let finalQuizType = quizType;
        if (!finalQuizType) {
            finalQuizType = detectedLanguage === 'ja' ? 'jp_word_to_ko_meaning' : 'mcq';
        }

        console.log(`[QUIZ BY LANGUAGE] Creating ${finalQuizType} quiz for language: ${detectedLanguage}`);

        const quizItems = await generateQuizByLanguageAndType(
            prisma,
            userId,
            vocabIds,
            finalQuizType,
            detectedLanguage
        );

        return ok(res, {
            quizItems,
            language: detectedLanguage,
            quizType: finalQuizType,
            totalItems: quizItems.length
        });

    } catch (e) {
        console.error('POST /quiz/by-language failed:', e);
        return fail(res, 500, 'Failed to create language-specific quiz');
    }
});

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
            folder = await prisma.srsfolder.findFirst({
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
        
        // 동결 상태 처리 (최우선)
        if (result.status === 'frozen') {
            return ok(res, {
                message: result.message || '카드가 동결 상태입니다.',
                isFrozen: result.isFrozen,
                frozenUntil: result.frozenUntil,
                canReview: false
            });
        }
        
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
        const response = ok(res, {
            correct: result.status === 'correct',
            stage: result.newStage,
            waitingUntil: result.waitingUntil,
            nextReviewAt: result.nextReviewAt,
            streakInfo: result.streakInfo,
            canReview: true
        });
        
        // 퀴즈 답변 처리 후 즉시 크론잡 실행하여 상태 업데이트
        try {
            const { manageOverdueCards } = require('../services/srsJobs');
            setImmediate(() => {
                manageOverdueCards().catch(error => {
                    console.error('[QUIZ ANSWER] Auto cron execution failed:', error);
                });
            });
        } catch (e) {
            console.error('[QUIZ ANSWER] Failed to trigger auto cron:', e);
        }
        
        return response;

        /*
        // 기존 트랜잭션 코드 - 새 로직으로 대체됨
        const result = await prisma.$transaction(async (tx) => {
            // 카드 존재/소유 검증
            const card = await tx.srscard.findFirst({
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
                const folder = await tx.srsfolder.findFirst({
                    where: { id: folderId, userId },
                    select: { id: true, userId: true, date: true },
                });
                if (!folder) throw Object.assign(new Error('폴더 없음'), { status: 404 });

                const existing = await tx.srsfolderitem.findUnique({
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
