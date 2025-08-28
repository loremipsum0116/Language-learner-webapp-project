// server/idiom_server.js
// 완전한 숙어 전용 서버

console.log('🚀 Starting idiom server...');
const express = require('express');
const cors = require('cors');
const { prisma } = require('./lib/prismaClient');

const app = express();
const PORT = 4000;

// CORS 설정
app.use(cors({ 
    origin: process.env.CORS_ORIGIN || ['http://localhost:3000', 'http://localhost:3001'], 
    credentials: true 
}));
app.use(express.json());

// 숙어 라우트 사용
const idiomRoutes = require('./routes/idiom_working');
app.use('/api/idiom', idiomRoutes);

console.log('✅ Routes configured');

app.listen(PORT, () => {
    console.log(`🚀 Idiom server running on port ${PORT}`);
    console.log(`📍 API endpoints:`);
    console.log(`   - Categories: http://localhost:${PORT}/api/idiom/categories`);
    console.log(`   - List: http://localhost:${PORT}/api/idiom/list`);
    console.log(`   - Detail: http://localhost:${PORT}/api/idiom/:id`);
});

process.on('SIGINT', async () => {
    console.log('\n🔌 Disconnecting from database...');
    await prisma.$disconnect();
    process.exit(0);
});