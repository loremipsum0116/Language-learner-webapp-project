// 간단한 숙어 서버 테스트
const express = require('express');
const cors = require('cors');
const { prisma } = require('./lib/prismaClient');

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// 카테고리 API
app.get('/api/idiom/categories', async (req, res) => {
    try {
        console.log('📥 Categories request received');
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
        
        console.log('📤 Returning categories:', categoryList);
        res.json({ data: categoryList });
    } catch (error) {
        console.error('❌ Categories error:', error);
        res.status(500).json({ error: 'Failed to load categories' });
    }
});

// 목록 API (전체 데이터)
app.get('/api/idiom/list', async (req, res) => {
    try {
        console.log('📥 List request received, params:', req.query);
        const { category } = req.query;
        
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
        
        console.log('🔍 Executing query with params:', params);
        const idioms = await prisma.$queryRawUnsafe(query, ...params);
        
        console.log(`✅ Found ${idioms.length} idioms`);
        
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
        console.log('📥 Detail request for id:', id);
        
        const query = `
            SELECT id, idiom, korean_meaning, usage_context_korean, 
                   category, koChirpScript, audioWord, audioGloss, 
                   audioExample, example_sentence, ko_example_sentence 
            FROM idioms WHERE id = ?
        `;
        
        const idioms = await prisma.$queryRawUnsafe(query, parseInt(id));
        
        if (!idioms || idioms.length === 0) {
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
        
        console.log('📤 Returning detail for:', idiom.idiom);
        res.json({ data: formattedIdiom });
    } catch (error) {
        console.error('❌ Detail error:', error);
        res.status(500).json({ error: 'Failed to load idiom details' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Simple idiom server running on port ${PORT}`);
});

// 안전한 종료
process.on('SIGINT', async () => {
    console.log('\n🔌 Shutting down...');
    await prisma.$disconnect();
    process.exit(0);
});