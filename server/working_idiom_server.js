// 완전 작동하는 숙어 서버
const express = require('express');
const cors = require('cors');
const { prisma } = require('./lib/prismaClient');

const app = express();
const PORT = 4000;

console.log('🚀 Starting working idiom server...');

// CORS 설정
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true
}));
app.use(express.json());

// 카테고리 API
app.get('/api/idiom/categories', async (req, res) => {
    try {
        console.log('📥 Categories request');
        
        const [idiomResult, phraseResult] = await Promise.all([
            prisma.$queryRaw`SELECT COUNT(*) as count FROM idioms WHERE category LIKE '%숙어%'`,
            prisma.$queryRaw`SELECT COUNT(*) as count FROM idioms WHERE category LIKE '%구동사%'`
        ]);
        
        const categoryList = [
            { name: '숙어', count: Number(idiomResult[0].count) },
            { name: '구동사', count: Number(phraseResult[0].count) }
        ];
        
        console.log('✅ Categories response:', categoryList);
        res.json({ data: categoryList });
    } catch (error) {
        console.error('❌ Categories error:', error);
        res.status(500).json({ error: 'Failed to load categories' });
    }
});

// 목록 API (전체 데이터, LIMIT 없음)
app.get('/api/idiom/list', async (req, res) => {
    try {
        const { category } = req.query;
        console.log(`📥 List request, category: ${category || 'all'}`);
        
        let query = `
            SELECT id, idiom, korean_meaning, usage_context_korean, 
                   category, koChirpScript, audioWord, audioGloss, 
                   audioExample, example_sentence, ko_example_sentence 
            FROM idioms
        `;
        
        let params = [];
        if (category) {
            query += ` WHERE category LIKE ?`;
            params.push(`%${category}%`);
        }
        
        query += ` ORDER BY idiom ASC`;
        
        const idioms = await prisma.$queryRawUnsafe(query, ...params);
        
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
        
        console.log(`✅ List response: ${formattedIdioms.length} items`);
        res.json({ data: formattedIdioms, total: formattedIdioms.length });
    } catch (error) {
        console.error('❌ List error:', error);
        res.status(500).json({ error: 'Failed to load idioms' });
    }
});

// 상세 정보 API
app.get('/api/idiom/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`📥 Detail request for id: ${id}`);
        
        const query = `
            SELECT id, idiom, korean_meaning, usage_context_korean, 
                   category, koChirpScript, audioWord, audioGloss, 
                   audioExample, example_sentence, ko_example_sentence 
            FROM idioms WHERE id = ?
        `;
        
        const idioms = await prisma.$queryRawUnsafe(query, parseInt(id));
        
        if (!idioms || idioms.length === 0) {
            console.log(`❌ Idiom not found: ${id}`);
            return res.status(404).json({ error: 'Idiom not found' });
        }
        
        const idiom = idioms[0];
        const formattedIdiom = {
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
        };
        
        console.log(`✅ Detail response for: ${idiom.idiom}`);
        res.json({ data: formattedIdiom });
    } catch (error) {
        console.error('❌ Detail error:', error);
        res.status(500).json({ error: 'Failed to load idiom details' });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Working idiom server running on port ${PORT}`);
    console.log(`📍 API endpoints available:`);
    console.log(`   - Categories: http://localhost:${PORT}/api/idiom/categories`);
    console.log(`   - All idioms: http://localhost:${PORT}/api/idiom/list`);
    console.log(`   - Idioms only: http://localhost:${PORT}/api/idiom/list?category=숙어`);
    console.log(`   - Phrasal verbs: http://localhost:${PORT}/api/idiom/list?category=구동사`);
    console.log(`   - Detail: http://localhost:${PORT}/api/idiom/:id`);
    console.log('🎉 Ready to handle requests!');
});

process.on('SIGINT', async () => {
    console.log('\n🔌 Shutting down gracefully...');
    await prisma.$disconnect();
    process.exit(0);
});