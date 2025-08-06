const express = require('express');
const { createFlashBatches } = require('../services/srsService');
const { finishSession } = require('../services/sessionService');

const router = express.Router();

/* 자동학습(Flash) 시작 */
router.post('/flash/start', async (req, res) => {
    await createFlashBatches(req.user.id);
    res.sendStatus(204);
});

/* 모든 배치 학습 완료 */
router.post('/session/finish', finishSession);

module.exports = router;
