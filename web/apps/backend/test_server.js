// server/test_server.js
// 완전한 숙어 서버

const express = require('express');
const cors = require('cors');
const { prisma } = require('./lib/prismaClient');

const app = express();
const PORT = 4000; // 메인 포트 사용

// CORS 설정
app.use(cors({ origin: process.env.CORS_ORIGIN || ['http://localhost:3000', 'http://localhost:3001'], credentials: true }));
app.use(express.json());

// 작업 중인 숙어 라우트 사용
const idiomRoutes = require('./routes/idiom_working');
app.use('/api/idiom', idiomRoutes);

// 레거시 라우트 (기존 코드와의 호환성을 위해 유지)
app.get('/api/idiom/list', async (req, res) => {
    try {
        console.log('📥 Received request for /api/idiom/list');
        console.log('Query params:', req.query);
        
        const { category } = req.query; // '숙어' 또는 '구동사'
        
        let query = `
            SELECT 
                id, idiom, korean_meaning, usage_context_korean, 
                category, koChirpScript, audioWord, audioGloss, 
                audioExample, example_sentence, ko_example_sentence 
            FROM idioms
        `;
        
        let params = [];
        if (category) {
            query += ` WHERE category LIKE ?`;
            params.push(`%${category}%`);
        }
        
        query += ` ORDER BY idiom ASC LIMIT 10`; // 테스트를 위해 10개만
        
        console.log('🔍 Executing query:', query);
        console.log('📋 With params:', params);
        
        const idioms = await prisma.$queryRawUnsafe(query, ...params);
        
        console.log(`✅ Found ${idioms.length} idioms`);
        
        // 프론트엔드에서 기대하는 형식으로 변환
        const formattedIdioms = idioms.map(idiom => ({
            id: idiom.id,
            idiom: idiom.idiom,
            korean_meaning: idiom.korean_meaning,
            usage_context_korean: idiom.usage_context_korean,
            category: idiom.category,
            koChirpScript: idiom.koChirpScript,
            audioWord: idiom.audioWord,
            audioGloss: idiom.audioGloss,
            audioExample: idiom.audioExample,
            example_sentence: idiom.example_sentence,
            ko_example_sentence: idiom.ko_example_sentence,
            audio: {
                word: idiom.audioWord,
                gloss: idiom.audioGloss,
                example: idiom.audioExample
            },
            example: idiom.example_sentence,
            koExample: idiom.ko_example_sentence
        }));
        
        console.log('📤 Returning formatted data');
        
        return res.json({ 
            data: formattedIdioms,
            total: formattedIdioms.length 
        });
    } catch (error) {
        console.error('❌ Error in /api/idiom/list:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            meta: error.meta,
            stack: error.stack
        });
        return res.status(500).json({ 
            error: 'Failed to load idioms', 
            details: error.message 
        });
    }
});

// 카테고리 API
app.get('/api/idiom/categories', async (req, res) => {
    try {
        const [idiomResult, phraseResult] = await Promise.all([
            prisma.$queryRaw`SELECT COUNT(*) as count FROM idioms WHERE category LIKE '%숙어%'`,
            prisma.$queryRaw`SELECT COUNT(*) as count FROM idioms WHERE category LIKE '%구동사%'`
        ]);
        
        const idiomCount = Number(idiomResult[0].count);
        const phraseCount = Number(phraseResult[0].count);
        
        const categoryList = [
            { name: '숙어', count: idiomCount },
            { name: '구동사', count: phraseCount }
        ];
        
        return res.json({ data: categoryList });
    } catch (error) {
        console.error('Error in /api/idiom/categories:', error);
        return res.status(500).json({ error: 'Failed to load categories' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Test server running on port ${PORT}`);
    console.log(`📍 Test API at: http://localhost:${PORT}/api/idiom/list`);
});

process.on('SIGINT', async () => {
    console.log('\n🔌 Disconnecting from database...');
    await prisma.$disconnect();
    process.exit(0);
});