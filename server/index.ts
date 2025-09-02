// server/index.ts
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// --- 압축 및 최적화 미들웨어 임포트 ---
import {
  advancedCompression,
  apiResponseOptimization,
  contentTypeOptimization,
  responseSizeMonitoring,
  apiCacheOptimization,
  brotliCompression
} from './middleware/compression';

import {
  preCompressedStatic,
  audioOptimization,
  imageOptimization,
  jsonFileOptimization,
  staticFileLogging
} from './middleware/staticCompression';

// --- 라우터 임포트 ---
import authRoutes from './routes/auth';
import learnRoutes from './routes/learn';
import vocabRoutes from './routes/vocab';
import quizRoutes from './routes/quiz';
import srsRoutes from './routes/srs';
import userRoutes from './routes/user';
import readingRoutes from './routes/reading';
import categoryRoutes from './routes/categories';
import myWordbookRoutes from './routes/my-wordbook';
import myIdiomsRoutes from './routes/my-idioms';
import odatNoteRoutes from './routes/odat-note';
import dictRoutes from './routes/dict';
import examVocabRoutes from './routes/examVocab';
import autoFolderRoutes from './routes/autoFolder';

// (선택) 대시보드 오버라이드/Flat 확장 라우터
import srsFlatExt from './routes/srs-flat-extensions';
import srsDashOverride from './routes/srs-dashboard-override';

// 타임머신 라우터
import { router as timeMachineRouter } from './routes/timeMachine';

// 관리자 라우터
import adminRoutes from './routes/admin';

// --- 미들웨어 임포트 ---
import authMiddleware from './middleware/auth';
import { 
  detectApiVersion, 
  validateApiVersion, 
  deprecationWarning, 
  formatApiResponse,
  generateApiDocs 
} from './middleware/apiVersion';

// --- API 버전 라우터 임포트 ---
import apiV1Router from './routes/api/v1';
import mobileRouter from './routes/api/mobile';

const app: Application = express();

console.log('[STARTUP] Express app created, setting up routes...');

// Static routing test (인증 불필요)
app.get('/static-test', (req: Request, res: Response) => {
  res.json({ message: 'Static routing works', timestamp: new Date().toISOString() });
});

// vocabs_example.py로 생성된 레벨별 오디오 라우팅 (인증 불필요)
app.use('/starter', (req: Request, res: Response, next: NextFunction) => {
  console.log('[STATIC] starter audio request:', req.path);
  next();
}, staticFileLogging, audioOptimization, preCompressedStatic(path.join(__dirname, 'starter')));

app.use('/elementary', (req: Request, res: Response, next: NextFunction) => {
  console.log('[STATIC] elementary audio request:', req.path);
  next();
}, staticFileLogging, audioOptimization, preCompressedStatic(path.join(__dirname, 'elementary')));

app.use('/intermediate', (req: Request, res: Response, next: NextFunction) => {
  console.log('[STATIC] intermediate audio request:', req.path);
  next();
}, staticFileLogging, audioOptimization, preCompressedStatic(path.join(__dirname, 'intermediate')));

app.use('/upper', (req: Request, res: Response, next: NextFunction) => {
  console.log('[STATIC] upper audio request:', req.path);
  next();
}, staticFileLogging, audioOptimization, preCompressedStatic(path.join(__dirname, 'upper')));

app.use('/advanced', (req: Request, res: Response, next: NextFunction) => {
  console.log('[STATIC] advanced audio request:', req.path);
  next();
}, staticFileLogging, audioOptimization, preCompressedStatic(path.join(__dirname, 'advanced')));

// === 기존 정적 파일 서빙 (최우선) ===
console.log('Setting up A1 audio:', path.join(__dirname, 'A1', 'audio'));
console.log('Setting up A2 audio:', path.join(__dirname, 'A2', 'audio'));
console.log('Setting up B1 audio:', path.join(__dirname, 'B1', 'audio'));
console.log('Setting up B2 audio:', path.join(__dirname, 'B2', 'audio'));
console.log('Setting up C1 audio:', path.join(__dirname, 'C1', 'audio'));
console.log('Setting up C2 audio:', path.join(__dirname, 'C2', 'audio'));

app.use('/A1/audio', (req: Request, res: Response, next: NextFunction) => {
  console.log('[STATIC] A1 audio request:', req.path);
  next();
}, staticFileLogging, audioOptimization, preCompressedStatic(path.join(__dirname, 'A1', 'audio')));

app.use('/A2/audio', (req: Request, res: Response, next: NextFunction) => {
  console.log('[STATIC] A2 audio request:', req.path);
  next();
}, staticFileLogging, audioOptimization, preCompressedStatic(path.join(__dirname, 'A2', 'audio')));

app.use('/B1/audio', (req: Request, res: Response, next: NextFunction) => {
  console.log('[STATIC] B1 audio request:', req.path);
  next();
}, staticFileLogging, audioOptimization, preCompressedStatic(path.join(__dirname, 'B1', 'audio')));

app.use('/B2/audio', (req: Request, res: Response, next: NextFunction) => {
  console.log('[STATIC] B2 audio request:', req.path);
  next();
}, staticFileLogging, audioOptimization, preCompressedStatic(path.join(__dirname, 'B2', 'audio')));

app.use('/C1/audio', (req: Request, res: Response, next: NextFunction) => {
  console.log('[STATIC] C1 audio request:', req.path);
  next();
}, staticFileLogging, audioOptimization, preCompressedStatic(path.join(__dirname, 'C1', 'audio')));

app.use('/C2/audio', (req: Request, res: Response, next: NextFunction) => {
  console.log('[STATIC] C2 audio request:', req.path);
  next();
}, staticFileLogging, audioOptimization, preCompressedStatic(path.join(__dirname, 'C2', 'audio')));

app.use('/phrasal_verb', (req: Request, res: Response, next: NextFunction) => {
  console.log('[STATIC] phrasal_verb audio request:', req.path);
  next();
}, staticFileLogging, audioOptimization, preCompressedStatic(path.join(__dirname, 'phrasal_verb')));

// 비디오 파일 서빙 - 압축 최적화 적용
app.use('/api/video', staticFileLogging, preCompressedStatic(path.join(__dirname, 'out')));

// === 압축 및 최적화 미들웨어 (최우선 적용) ===
app.use(advancedCompression);
app.use(contentTypeOptimization);
app.use(responseSizeMonitoring);
app.use(brotliCompression);

// CORS 설정을 정적 파일보다 먼저 적용
app.use(cors({ 
  origin: process.env.CORS_ORIGIN || ['http://localhost:3000', 'http://localhost:3001'], 
  credentials: true 
}));

// 정적 파일 최적화 적용
app.use('/public', staticFileLogging, imageOptimization, preCompressedStatic(path.join(__dirname, 'public')));
app.use(express.json({ limit: '10mb' })); // JSON 크기 제한 증가
app.use(cookieParser());

// === API 응답 최적화 ===
app.use(apiResponseOptimization);
app.use(apiCacheOptimization);

// === API 버전 관리 미들웨어 ===
app.use(detectApiVersion);
app.use(validateApiVersion([1])); // 현재 v1만 지원
app.use(deprecationWarning);
app.use(formatApiResponse);

// === 새로운 버전 관리 API (v1) ===
app.use('/api/v1', apiV1Router);

// --- 인증 불필요 라우트 (Legacy - 하위 호환성 유지) ---
app.use('/auth', authRoutes);
app.use('/time-accelerator', require('./routes/timeAccelerator').router);  // 시간 가속 API (인증 불필요)
app.use('/dict', dictRoutes);  // 사전 검색 API (인증 불필요)
app.use('/exam-vocab', examVocabRoutes);  // 시험별 단어 API (인증 불필요)
app.use('/api/reading', readingRoutes);  // Reading API (인증 불필요)
app.use('/api/listening', require('./routes/listening'));  // Listening API (인증 불필요)
app.use('/api/idiom', require('./routes/idiom_working'));

// === 모바일 API (별도 인증 처리) ===
app.use('/api/mobile', mobileRouter);

// API 문서 엔드포인트
app.get('/docs/api', generateApiDocs([1]));

// --- 글로벌 인증 미들웨어 ---
app.use((req: Request, res: Response, next: NextFunction) => {
  // Skip auth for mobile API (handled internally)
  if (req.path.startsWith('/api/mobile')) {
    return next();
  }

  // Skip auth for specific public routes
  const publicRoutes = [
    '/auth', '/dict', '/exam-vocab', '/api/reading', '/api/listening', 
    '/api/idiom', '/time-accelerator', '/docs', '/static-test',
    '/api/v1', '/api/video'
  ];
  
  const isPublicRoute = publicRoutes.some(route => req.path.startsWith(route));
  
  if (isPublicRoute) {
    return next();
  }
  
  // Apply auth middleware for other routes
  return authMiddleware(req, res, next);
});

// --- 인증 필요 라우트 ---
app.use('/learn', learnRoutes);
app.use('/vocab', vocabRoutes);
app.use('/quiz', quizRoutes);
app.use('/srs', srsRoutes);
app.use('/categories', categoryRoutes);
app.use('/my-wordbook', myWordbookRoutes);
app.use('/my-idioms', myIdiomsRoutes);
app.use('/odat-note', odatNoteRoutes);
app.use('/time-machine', timeMachineRouter);
app.use('/admin', adminRoutes);
app.use('/auto-folder', autoFolderRoutes);
app.use('/', userRoutes); // User routes는 root level에 마운트

// SRS 대시보드 오버라이드 및 Flat 확장 (인증 필요)
app.use('/srs-flat-ext', srsFlatExt);
app.use('/srs-dashboard-override', srsDashOverride);

// --- 404 핸들러 ---
app.use('*', (req: Request, res: Response) => {
  console.log(`[404] Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    data: null,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
    meta: {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    }
  });
});

// --- 에러 핸들러 ---
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err);
  
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  res.status(500).json({
    data: null,
    error: isDevelopment ? err.message : 'Internal server error',
    meta: {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      ...(isDevelopment && { stack: err.stack })
    }
  });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`CORS Origins: ${process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3001'}`);
});

export default app;