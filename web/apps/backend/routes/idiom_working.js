// server/routes/idiom_working.js
// Working idiom routes copied from test server

console.log('🔄 Loading idiom_working.js routes file');
const express = require('express');
const { prisma } = require('../lib/prismaClient');
const router = express.Router();
console.log('✅ idiom_working.js router initialized');

// GET /api/idiom/categories - 카테고리 API
router.get('/categories', async (req, res) => {
    try {
        console.log('📥 Categories route hit!');
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
        return res.json({ data: categoryList });
    } catch (error) {
        console.error('Error in /api/idiom/categories:', error);
        return res.status(500).json({ error: 'Failed to load categories' });
    }
});

// GET /api/idiom/list - 숙어 API 테스트 라우트
router.get('/list', async (req, res) => {
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
        
        query += ` ORDER BY idiom ASC`; // 모든 데이터 반환
        
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

// GET /api/idiom/:id - 특정 숙어/구동사 상세 정보
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log('📥 Received request for idiom details, id:', id);
        
        const query = `
            SELECT 
                id, idiom, korean_meaning, usage_context_korean, 
                category, koChirpScript, audioWord, audioGloss, 
                audioExample, example_sentence, ko_example_sentence 
            FROM idioms 
            WHERE id = ?
        `;
        
        const idioms = await prisma.$queryRawUnsafe(query, parseInt(id));
        
        if (!idioms || idioms.length === 0) {
            console.log('❌ Idiom not found for id:', id);
            return res.status(404).json({ error: 'Idiom not found' });
        }
        
        const idiom = idioms[0];
        console.log('✅ Found idiom:', idiom.idiom);
        
        // 프론트엔드에서 기대하는 형식으로 변환
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
        
        console.log('📤 Returning idiom details');
        return res.json({ data: formattedIdiom });
    } catch (error) {
        console.error('❌ Error in /api/idiom/:id:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            meta: error.meta,
            stack: error.stack
        });
        return res.status(500).json({ 
            error: 'Failed to load idiom details', 
            details: error.message 
        });
    }
});

console.log('✅ idiom_working.js routes defined');
module.exports = router;