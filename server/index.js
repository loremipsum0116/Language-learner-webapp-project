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
const srsRoutes = require('./routes/srs');
const userRoutes = require('./routes/user');
const readingRoutes = require('./routes/reading');
const categoryRoutes = require('./routes/categories');
const myWordbookRoutes = require('./routes/my-wordbook');
const odatNoteRoutes = require('./routes/odat-note');
const srsRouter = require('./routes/srs');
const auth = require('./middleware/auth');

// --- 미들웨어 임포트 ---
const authMiddleware = require('./middleware/auth');

const app = express();


// --- 글로벌 미들웨어 (순서 중요) ---
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true })); // env 변수 사용
app.use(express.json());
app.use(cookieParser()); // 라우터보다 먼저 와야 함

app.use('/A1/audio', express.static(path.join(__dirname, 'A1', 'audio')));
// --- 라우터 등록 ---
// 1. 인증이 필요 없는 라우트
app.use('/srs', auth, srsRouter);
app.use('/auth', authRoutes);
// 2. 이 지점부터 모든 API는 인증이 필요함
app.use(authMiddleware);

// 3. 인증이 필요한 라우트
app.use('/learn', auth, learnRoutes);
app.use('/vocab', vocabRoutes);
app.use('/quiz', quizRoutes);
app.use('/srs', srsRoutes);
app.use('/reading', readingRoutes);
app.use('/categories', categoryRoutes);
app.use('/my-wordbook', myWordbookRoutes);
app.use('/odat-note', odatNoteRoutes);
app.use(userRoutes);
app.use('/srs', auth, srsRouter);
require('./cron');

// --- 에러 핸들러 ---
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' }); // 일관된 에러 형식
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on port ${PORT}`));