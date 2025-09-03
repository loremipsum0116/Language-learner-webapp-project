// server/routes/idiom.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();

const prisma = new PrismaClient();

// GET /api/idiom/list - 카테고리별 숙어/구동사 목록 조회
router.get('/list', async (req, res) => {
    try {
        const { category } = req.query; // '숙어' 또는 '구동사'
        
        let whereClause = {};
        if (category) {
            whereClause.category = {
                contains: category
            };
        }
        
        const idioms = await prisma.idiom.findMany({
            where: whereClause,
            orderBy: { idiom: 'asc' },
            select: {
                id: true,
                idiom: true,
                korean_meaning: true,
                usage_context_korean: true,
                category: true,
                koChirpScript: true,
                audioWord: true,
                audioGloss: true,
                audioExample: true,
                example_sentence: true,
                ko_example_sentence: true
            }
        });
        
        // 프론트엔드에서 기대하는 형식으로 변환
        const formattedIdioms = idioms.map(idiom => ({
            ...idiom,
            audio: {
                word: idiom.audioWord,
                gloss: idiom.audioGloss,
                example: idiom.audioExample
            },
            example: idiom.example_sentence,
            koExample: idiom.ko_example_sentence
        }));
        
        return res.json({ 
            data: formattedIdioms,
            total: formattedIdioms.length 
        });
    } catch (error) {
        console.error('Error in /idiom/list:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            meta: error.meta
        });
        return res.status(500).json({ error: 'Failed to load idioms' });
    }
});

// GET /api/idiom/:id - 특정 숙어/구동사 상세 정보
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const idiom = await prisma.idiom.findUnique({
            where: { id: parseInt(id) },
            select: {
                id: true,
                idiom: true,
                korean_meaning: true,
                usage_context_korean: true,
                category: true,
                koChirpScript: true,
                audioWord: true,
                audioGloss: true,
                audioExample: true,
                example_sentence: true,
                ko_example_sentence: true
            }
        });
        
        if (!idiom) {
            return res.status(404).json({ error: 'Idiom not found' });
        }
        
        // 프론트엔드에서 기대하는 형식으로 변환
        const formattedIdiom = {
            ...idiom,
            audio: {
                word: idiom.audioWord,
                gloss: idiom.audioGloss,
                example: idiom.audioExample
            },
            example: idiom.example_sentence,
            koExample: idiom.ko_example_sentence
        };
        
        return res.json({ data: formattedIdiom });
    } catch (error) {
        console.error('Error in /idiom/:id:', error);
        return res.status(500).json({ error: 'Failed to load idiom details' });
    }
});

// GET /api/idiom/categories - 사용 가능한 카테고리 목록
router.get('/categories', async (req, res) => {
    try {
        // 숙어와 구동사 개수를 직접 쿼리
        const [idiomCount, phraseCount] = await Promise.all([
            prisma.idiom.count({
                where: { category: { contains: '숙어' } }
            }),
            prisma.idiom.count({
                where: { category: { contains: '구동사' } }
            })
        ]);
        
        const categoryList = [
            { name: '숙어', count: idiomCount },
            { name: '구동사', count: phraseCount }
        ];
        
        return res.json({ data: categoryList });
    } catch (error) {
        console.error('Error in /idiom/categories:', error);
        return res.status(500).json({ error: 'Failed to load categories' });
    }
});

module.exports = router;