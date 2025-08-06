const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const learnRoutes = require('./routes/learn');
const vocabRoutes = require('./routes/vocab');
const quizRoutes = require('./routes/quiz');
const auth = require('./middleware/auth'); // 인증 미들웨어

// 알람 워커 및 초기화
require('./queues/alarmQueue');
require('./bootstrapAlarmInit');

const app = express();

// 미들웨어
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(cookieParser());
app.use(express.json());

/* ✅ 1. 로그인/회원가입: 인증 없이 접근 가능 */
app.use(authRoutes);

/* ✅ 2. 인증 미들웨어: 여기부터는 req.user 보장됨 */
app.use(auth);

/* ✅ 3. 인증 필요한 라우트들 */
app.use('/vocab', vocabRoutes);
app.use(learnRoutes);
app.use(quizRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log('API listening on port', PORT));
