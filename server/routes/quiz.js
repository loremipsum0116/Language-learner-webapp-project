/**
 * server/routes/quiz.js
 *
 * [수정 사항]
 * 1. POST /by-vocab 라우트 추가: 특정 단어 ID들로 퀴즈를 생성하는 API
 * 2. 퀴즈 정답 처리 로직 유지
 */
const { ok, fail } = require('../lib/resp');
const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');
const { generateMcqQuizItems } = require('../services/quizService');
const Srs = require('../services/srsService');
const auth = require('../middleware/auth'); // ← 추가



// ✅ [수정] 이 라우트가 404 에러를 해결합니다.
router.post('/by-vocab', async (req, res) => {
    try {
        const { vocabIds } = req.body || {};
        if (!Array.isArray(vocabIds)) {
            return fail(res, 400, 'vocabIds must be an array');
        }
        // 헬퍼 함수를 호출하여 퀴즈 생성
        const items = await generateMcqQuizItems(prisma, req.user.id, vocabIds);
        return ok(res, items);
    } catch (e) {
        console.error('POST /quiz/by-vocab Error:', e);
        return fail(res, 500, 'Internal Server Error');
    }
});

router.use(auth);
// POST /quiz/answer
router.post('/quiz/answer', auth, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { cardId, correct } = req.body || {};

        if (!cardId || typeof correct !== 'boolean') {
            return res.status(400).json({ ok: false, error: 'cardId, correct가 필요합니다.' });
        }
        const r = await Srs.markAnswer(req.user.id, { cardId: Number(cardId), correct });
        res.json({ ok: true, data: r });
    } catch (e) { next(e); }
});

module.exports = router;
