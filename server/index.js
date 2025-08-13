// server/index.js
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
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

// (선택) 대시보드 오버라이드/Flat 확장 라우터
const srsFlatExt = require('./routes/srs-flat-extensions');         // 제공 파일
const srsDashOverride = require('./routes/srs-dashboard-override');  // 제공 파일

// 타임머신 라우터
const { router: timeMachineRouter } = require('./routes/timeMachine');

// --- 미들웨어 임포트 ---
const authMiddleware = require('./middleware/auth');

const app = express();

// --- 글로벌 미들웨어 (순서 중요) ---
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/A1/audio', express.static(path.join(__dirname, 'A1', 'audio')));

// --- 인증 불필요 라우트 ---
app.use('/auth', authRoutes);

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
app.use('/reading', readingRoutes);
app.use('/categories', categoryRoutes);
app.use('/my-wordbook', myWordbookRoutes);
app.use('/odat-note', odatNoteRoutes);
app.use('/time-machine', timeMachineRouter);  // 타임머신 API
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
