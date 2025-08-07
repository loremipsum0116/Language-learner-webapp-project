//server/routes/learn.js
const express = require('express');
const { createFlashBatches } = require('../services/srsService');
const { finishSession } = require('../services/sessionService');

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

/*
 * @route   POST /learn/session/finish
 * @desc    모든 학습 배치를 완료 처리하고, 오답률이 높은 단어로 폴더를 생성합니다.
 * @access  Private
 */
router.post('/session/finish', finishSession);

module.exports = router;
