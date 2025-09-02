// server/index.js
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// --- 압축 및 최적화 미들웨어 임포트 ---
const {
  advancedCompression,
  apiResponseOptimization,
  contentTypeOptimization,
  responseSizeMonitoring,
  apiCacheOptimization,
  brotliCompression
} = require('./middleware/compression');

const {
  preCompressedStatic,
  audioOptimization,
  imageOptimization,
  jsonFileOptimization,
  staticFileLogging
} = require('./middleware/staticCompression');

// --- 라우터 임포트 ---
const authRoutes = require('./routes/auth');
const learnRoutes = require('./routes/learn');
const vocabRoutes = require('./routes/vocab');
const quizRoutes = require('./routes/quiz');
const srsRoutes = require('./routes/srs');                // ✅ 한번만
const userRoutes = require('./routes/user');
const readingRoutes = require('./routes/reading');
const categoryRoutes = require('./routes/categories');
const myWordbookRoutes = require('./routes/my-wordbook');
const myIdiomsRoutes = require('./routes/my-idioms');
const odatNoteRoutes = require('./routes/odat-note');
const dictRoutes = require('./routes/dict');
const examVocabRoutes = require('./routes/examVocab');
const autoFolderRoutes = require('./routes/autoFolder');
// const idiomRoutes = require('./routes/idiom'); // Removed - using idiom_working.js instead

// (선택) 대시보드 오버라이드/Flat 확장 라우터
const srsFlatExt = require('./routes/srs-flat-extensions');         // 제공 파일
const srsDashOverride = require('./routes/srs-dashboard-override');  // 제공 파일

// 타임머신 라우터
const { router: timeMachineRouter } = require('./routes/timeMachine');

// 관리자 라우터
const adminRoutes = require('./routes/admin');

// --- 미들웨어 임포트 ---
const authMiddleware = require('./middleware/auth');
const { 
  detectApiVersion, 
  validateApiVersion, 
  deprecationWarning, 
  formatApiResponse,
  generateApiDocs 
} = require('./middleware/apiVersion');

// --- API 버전 라우터 임포트 ---
const apiV1Router = require('./routes/api/v1');
const mobileRouter = require('./routes/api/mobile');

const app = express();

console.log('[STARTUP] Express app created, setting up routes...');

// === API 문서화 (임시로 다른 경로 사용) ===
app.get('/api-docs', (req, res) => {
  console.log('[API DOCS] /api-docs route hit - immediate response');
  const { generateApiDocs } = require('./middleware/apiVersion');
  generateApiDocs([1])(req, res);
});

app.get('/docs/api-info', (req, res) => {
  console.log('[API DOCS] /docs/api-info route hit - immediate response'); 
  const { generateApiDocs } = require('./middleware/apiVersion');
  generateApiDocs([1])(req, res);
});

// === 정적 파일 서빙 (최우선) ===
// Test route for debugging
app.get('/test-static', (req, res) => {
  console.log('[TEST] Static test route hit');
  res.json({ message: 'Static routing works', timestamp: new Date().toISOString() });
});

// vocabs_example.py로 생성된 레벨별 오디오 라우팅 (인증 불필요)
app.use('/starter', (req, res, next) => {
  console.log('[STATIC] starter audio request:', req.path);
  next();
}, staticFileLogging, audioOptimization, preCompressedStatic(path.join(__dirname, 'starter')));

app.use('/elementary', (req, res, next) => {
  console.log('[STATIC] elementary audio request:', req.path);
  next();
}, staticFileLogging, audioOptimization, preCompressedStatic(path.join(__dirname, 'elementary')));

app.use('/intermediate', (req, res, next) => {
  console.log('[STATIC] intermediate audio request:', req.path);
  next();
}, staticFileLogging, audioOptimization, preCompressedStatic(path.join(__dirname, 'intermediate')));

app.use('/upper', (req, res, next) => {
  console.log('[STATIC] upper audio request:', req.path);
  next();
}, staticFileLogging, audioOptimization, preCompressedStatic(path.join(__dirname, 'upper')));

app.use('/advanced', (req, res, next) => {
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
app.use('/A1/audio', (req, res, next) => {
  console.log('[STATIC] A1 audio request:', req.path);
  next();
}, staticFileLogging, audioOptimization, preCompressedStatic(path.join(__dirname, 'A1', 'audio')));

app.use('/A2/audio', (req, res, next) => {
  console.log('[STATIC] A2 audio request:', req.path);
  next();
}, staticFileLogging, audioOptimization, preCompressedStatic(path.join(__dirname, 'A2', 'audio')));

app.use('/B1/audio', (req, res, next) => {
  console.log('[STATIC] B1 audio request:', req.path);
  next();
}, staticFileLogging, audioOptimization, preCompressedStatic(path.join(__dirname, 'B1', 'audio')));

app.use('/B2/audio', (req, res, next) => {
  console.log('[STATIC] B2 audio request:', req.path);
  next();
}, staticFileLogging, audioOptimization, preCompressedStatic(path.join(__dirname, 'B2', 'audio')));

app.use('/C1/audio', (req, res, next) => {
  console.log('[STATIC] C1 audio request:', req.path);
  next();
}, staticFileLogging, audioOptimization, preCompressedStatic(path.join(__dirname, 'C1', 'audio')));

app.use('/C2/audio', (req, res, next) => {
  console.log('[STATIC] C2 audio request:', req.path);
  next();
}, staticFileLogging, audioOptimization, preCompressedStatic(path.join(__dirname, 'C2', 'audio')));

// 숙어/구동사 오디오 서빙 (인증 불필요)
app.use('/idiom', (req, res, next) => {
  console.log('[STATIC] idiom audio request:', req.path);
  // CORS 헤더 직접 설정
  const allowedOrigins = ['http://localhost:3000', 'http://localhost:3001'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
}, express.static(path.join(__dirname, 'idiom')));

app.use('/phrasal_verb', (req, res, next) => {
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
app.use(cors({ origin: process.env.CORS_ORIGIN || ['http://localhost:3000', 'http://localhost:3001'], credentials: true }));

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
app.use('/api/listening', require('./routes/listening'));  // Listening API
app.use('/api/idiom', require('./routes/idiom_working')); // Idiom API (인증 불필요) - Working version from test server
// Vocab-by-pos endpoint for idiom/phrasal verb integration (unauthenticated)
app.get('/api/vocab/vocab-by-pos', async (req, res) => {
  try {
    const { prisma } = require('./lib/prismaClient');
    const { pos, search } = req.query;
    
    console.log('[API] vocab-by-pos called with:', { pos, search });
    
    if (!pos) {
      return res.status(400).json({ ok: false, error: 'pos parameter is required' });
    }
    
    const where = { 
      pos: pos,
      source: 'idiom_migration'
    };
    
    if (search && search.trim()) {
      where.lemma = { contains: search.trim() };
    }
    
    console.log('[API] Query where:', JSON.stringify(where));
    
    const vocabs = await prisma.vocab.findMany({
      where,
      include: {
        dictentry: true
      },
      orderBy: { lemma: 'asc' }
    });
    
    console.log('[API] Found vocabs:', vocabs.length);
    
    // Transform to expected idiom format
    const transformedData = vocabs.map(vocab => {
      const examples = vocab.dictentry?.examples || [];
      const glossExample = examples.find(ex => ex.kind === 'gloss');
      const sentenceExample = examples.find(ex => ex.kind === 'example');
      const usageExample = examples.find(ex => ex.kind === 'usage');
      
      // Parse audio data
      let audioData = {};
      if (vocab.dictentry?.audioLocal) {
        try {
          audioData = JSON.parse(vocab.dictentry.audioLocal);
        } catch (e) {
          console.warn('Failed to parse audio for', vocab.lemma, e.message);
        }
      }
      
      return {
        id: vocab.id,
        idiom: vocab.lemma,
        pos: vocab.pos,
        korean_meaning: glossExample?.ko || '',
        example: sentenceExample?.en || '',
        koExample: sentenceExample?.ko || '',
        koChirpScript: sentenceExample?.chirpScript || '',
        usage_context_korean: usageExample?.ko || '',
        category: `${vocab.levelCEFR}, ${vocab.pos}`,
        audio: audioData
      };
    });
    
    res.json({ 
      ok: true, 
      data: transformedData,
      count: transformedData.length 
    });
    
  } catch (error) {
    console.error('[API] vocab-by-pos error:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

app.use('/api/vocab', vocabRoutes); // Vocab API for unified idiom/phrasal verb access (인증 불필요)

// === 모바일 전용 API (인증 불필요 엔드포인트 포함) ===
app.use('/api/mobile', mobileRouter);

// 오디오 파일 목록 API (인증 불필요)
app.get('/audio-files/:level', (req, res) => {
  try {
    const level = req.params.level; // A1, A2 등
    const audioDir = path.join(__dirname, level, 'audio');
    
    if (!fs.existsSync(audioDir)) {
      return res.status(404).json({ error: `Audio directory for ${level} not found` });
    }
    
    const files = fs.readdirSync(audioDir)
      .filter(file => file.endsWith('.mp3'))
      .sort();
    
    res.json({ files });
  } catch (error) {
    console.error('Error reading audio files:', error);
    res.status(500).json({ error: 'Failed to read audio files' });
  }
});

// --- 이 지점부터 인증 필요 ---
app.use((req, res, next) => {
  // Skip auth for API documentation endpoints
  if (req.path === '/api' || req.path === '/docs/api') {
    return next();
  }
  // Skip auth for mobile API (handled internally)
  if (req.path.startsWith('/api/mobile')) {
    return next();
  }
  return authMiddleware(req, res, next);
});

// --- SRS 보강 라우터(기존 srs.js 유지하면서 확장/오버라이드) ---
// app.use(srsFlatExt);            // POST /srs/folders/create 제공
// app.use(srsDashOverride);       // GET /srs/dashboard 안전 오버라이드

// --- 인증 필요한 라우트 ---
app.use('/learn', learnRoutes);
app.use('/vocab', vocabRoutes);
app.use('/quiz', quizRoutes);
app.use('/srs', srsRoutes);     // ✅ 단 한 번만 등록
app.use('/categories', categoryRoutes);
app.use('/my-wordbook', myWordbookRoutes);
app.use('/my-idioms', myIdiomsRoutes);
app.use('/api/odat-note', odatNoteRoutes);
// Idiom API moved to unauthenticated section above
// app.use('/dict', dictRoutes);  // 이미 인증 불필요 섹션에서 등록됨
app.use('/time-machine', timeMachineRouter);  // 타임머신 API
app.use('/admin', adminRoutes);  // 관리자 API
app.use('/auto-folder', autoFolderRoutes);  // 자동 폴더 생성 API
app.use(userRoutes);

// --- 크론 ---
require('./cron');

// --- 에러 핸들러 ---
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
