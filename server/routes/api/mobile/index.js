// routes/api/mobile/index.js
const express = require('express');
const router = express.Router();

// Mobile API 미들웨어
const mobileMiddleware = require('../../../middleware/mobile');
const authMiddleware = require('../../../middleware/auth');

// Mobile API 하위 라우터 임포트
const mobileAuthRouter = require('./auth');
const mobileLearningRouter = require('./learning');
const mobileSrsRouter = require('./srs');
const mobileSyncRouter = require('./sync');
const mobileDeviceRouter = require('./device');

// Mobile API 응답 포맷 미들웨어
router.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function(data) {
    const response = {
      success: true,
      data: data,
      timestamp: new Date().toISOString(),
      apiVersion: 'mobile-v1',
      deviceInfo: req.deviceInfo || null
    };

    // 에러 응답 처리
    if (data && (data.error || data.ok === false)) {
      response.success = false;
      response.error = data.error || 'Unknown error';
      delete response.data;
    }

    return originalJson.call(this, response);
  };
  next();
});

// Mobile 특화 미들웨어 적용
router.use(mobileMiddleware.detectDevice);
router.use(mobileMiddleware.validateMobileHeaders);
router.use(mobileMiddleware.compressionOptimization);

// 공개 모바일 엔드포인트 (인증 불필요)
router.use('/auth', mobileAuthRouter);

// 헬스체크 엔드포인트
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: 'mobile-v1',
    uptime: process.uptime()
  });
});

// 앱 정보 엔드포인트
router.get('/app-info', (req, res) => {
  res.json({
    name: 'Language Learner Mobile API',
    version: '1.0.0',
    features: [
      'offline-sync',
      'audio-streaming',
      'push-notifications',
      'batch-operations',
      'compression'
    ],
    endpoints: {
      auth: '/api/mobile/auth',
      learning: '/api/mobile/learning',
      srs: '/api/mobile/srs',
      sync: '/api/mobile/sync',
      device: '/api/mobile/device'
    }
  });
});

// 이후 모든 엔드포인트는 인증 필요
router.use(authMiddleware);

// 인증된 모바일 엔드포인트
router.use('/learning', mobileLearningRouter);
router.use('/srs', mobileSrsRouter);
router.use('/sync', mobileSyncRouter);
router.use('/device', mobileDeviceRouter);

// 에러 핸들러
router.use((err, req, res, next) => {
  console.error('[MOBILE API ERROR]', err);
  
  const errorResponse = {
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    timestamp: new Date().toISOString(),
    apiVersion: 'mobile-v1'
  };

  if (req.deviceInfo) {
    errorResponse.deviceInfo = req.deviceInfo;
  }

  res.status(err.status || 500).json(errorResponse);
});

module.exports = router;