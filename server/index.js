// server/index.js
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser'); // 1. 임포트
require('dotenv').config();

// --- 라우터 임포트 ---
const authRoutes = require('./routes/auth');
const learnRoutes = require('./routes/learn');
const vocabRoutes = require('./routes/vocab');
const quizRoutes = require('./routes/quiz');
const srsRoutes = require('./routes/srs');
const userRoutes = require('./routes/user');
const readingRoutes = require('./routes/reading'); // readingRoutes도 포함
const categoryRoutes = require('./routes/categories');
const myWordbookRoutes = require('./routes/my-wordbook');
const odatNoteRoutes = require('./routes/odat-note');

// --- 미들웨어 임포트 ---
const authMiddleware = require('./middleware/auth');

// --- 백그라운드 작업 초기화 ---
require('./queues/alarmQueue');
require('./bootstrapAlarmInit');

const app = express();

// --- 글로벌 미들웨어 (✅ 순서가 매우 중요합니다) ---
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(cookieParser()); // 2. 라우터보다 반드시 먼저 와야 합니다.

// --- 라우터 등록 ---
// 1. 인증이 필요 없는 라우트
app.use('/auth', authRoutes);

// 2. 이 지점부터 모든 API는 인증이 필요함
app.use(authMiddleware);

// 3. 인증이 필요한 라우트
app.use('/learn', learnRoutes);
app.use('/vocab', vocabRoutes);
app.use('/quiz', quizRoutes);
app.use('/srs', srsRoutes);
app.use('/reading', readingRoutes);
app.use('/categories', categoryRoutes);
app.use('/my-wordbook', myWordbookRoutes);
app.use('/odat-note', odatNoteRoutes);
app.use(userRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on port ${PORT}`));