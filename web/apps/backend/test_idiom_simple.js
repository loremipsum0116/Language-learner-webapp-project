// 간단한 숙어 API 테스트 서버
const express = require('express');
const cors = require('cors');
const { prisma } = require('./lib/prismaClient');

const app = express();
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:3001'], credentials: true }));
app.use(express.json());

// 간단한 테스트 엔드포인트
app.get('/api/idiom/test', async (req, res) => {
    try {
        console.log('🔍 TEST endpoint called');
        const result = await prisma.$queryRaw`SELECT COUNT(*) as count FROM idioms WHERE category LIKE '%숙어%'`;
        const count = Number(result[0].count);
        
        const idioms = await prisma.$queryRaw`
            SELECT id, idiom, korean_meaning, category 
            FROM idioms 
            WHERE category LIKE '%숙어%' 
            ORDER BY idiom ASC 
            LIMIT 5
        `;
        
        console.log(`✅ Found ${count} idioms in database`);
        console.log('📋 Sample idioms:', idioms.map(i => i.idiom));
        
        return res.json({
            status: 'success',
            count,
            samples: idioms.map(idiom => ({
                id: idiom.id,
                idiom: idiom.idiom,
                korean_meaning: idiom.korean_meaning,
                category: idiom.category
            }))
        });
    } catch (error) {
        console.error('❌ Test error:', error);
        return res.status(500).json({ error: error.message });
    }
});

app.listen(4001, () => {
    console.log('✅ Test idiom server running on port 4001');
    console.log('🔗 Test URL: http://localhost:4001/api/idiom/test');
});

process.on('SIGINT', async () => {
    console.log('\n🔌 Shutting down...');
    await prisma.$disconnect();
    process.exit(0);
});