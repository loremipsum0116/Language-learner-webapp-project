// server/index.js
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

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
const odatNoteRoutes = require('./routes/odat-note');
const dictRoutes = require('./routes/dict');
const examVocabRoutes = require('./routes/examVocab');
const autoFolderRoutes = require('./routes/autoFolder');

// (선택) 대시보드 오버라이드/Flat 확장 라우터
const srsFlatExt = require('./routes/srs-flat-extensions');         // 제공 파일
const srsDashOverride = require('./routes/srs-dashboard-override');  // 제공 파일

// 타임머신 라우터
const { router: timeMachineRouter } = require('./routes/timeMachine');

// 관리자 라우터
const adminRoutes = require('./routes/admin');

// --- 미들웨어 임포트 ---
const authMiddleware = require('./middleware/auth');

const app = express();

// === 정적 파일 서빙 (최우선) ===
console.log('Setting up A1 audio:', path.join(__dirname, 'A1', 'audio'));
console.log('Setting up A2 audio:', path.join(__dirname, 'A2', 'audio'));
console.log('Setting up B1 audio:', path.join(__dirname, 'B1', 'audio'));
console.log('Setting up B2 audio:', path.join(__dirname, 'B2', 'audio'));
console.log('Setting up C1 audio:', path.join(__dirname, 'C1', 'audio'));
console.log('Setting up C2 audio:', path.join(__dirname, 'C2', 'audio'));
app.use('/A1/audio', (req, res, next) => {
  console.log('[STATIC] A1 audio request:', req.path);
  next();
}, express.static(path.join(__dirname, 'A1', 'audio')));

app.use('/A2/audio', (req, res, next) => {
  console.log('[STATIC] A2 audio request:', req.path);
  next();
}, express.static(path.join(__dirname, 'A2', 'audio')));

app.use('/B1/audio', (req, res, next) => {
  console.log('[STATIC] B1 audio request:', req.path);
  next();
}, express.static(path.join(__dirname, 'B1', 'audio')));

app.use('/B2/audio', (req, res, next) => {
  console.log('[STATIC] B2 audio request:', req.path);
  next();
}, express.static(path.join(__dirname, 'B2', 'audio')));

app.use('/C1/audio', (req, res, next) => {
  console.log('[STATIC] C1 audio request:', req.path);
  next();
}, express.static(path.join(__dirname, 'C1', 'audio')));

app.use('/C2/audio', (req, res, next) => {
  console.log('[STATIC] C2 audio request:', req.path);
  next();
}, express.static(path.join(__dirname, 'C2', 'audio')));

// 비디오 파일 서빙
app.use('/api/video', express.static(path.join(__dirname, 'out')));

app.use('/public', express.static(path.join(__dirname, 'public')));

app.use(cors({ origin: process.env.CORS_ORIGIN || ['http://localhost:3000', 'http://localhost:3001'], credentials: true }));
app.use(express.json());
app.use(cookieParser());

// --- 인증 불필요 라우트 ---
app.use('/auth', authRoutes);
app.use('/time-accelerator', require('./routes/timeAccelerator').router);  // 시간 가속 API (인증 불필요)
app.use('/dict', dictRoutes);  // 사전 검색 API (인증 불필요)
app.use('/exam-vocab', examVocabRoutes);  // 시험별 단어 API (인증 불필요)
app.use('/api/reading', readingRoutes);  // Reading API (인증 불필요)
app.use('/api/listening', require('./routes/listening'));  // Listening API

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
app.use(authMiddleware);

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
app.use('/api/odat-note', odatNoteRoutes);
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
