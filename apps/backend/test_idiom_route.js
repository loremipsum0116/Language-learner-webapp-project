// server/test_idiom_route.js
// 숙어 라우트 직접 테스트

const express = require('express');
const { prisma } = require('./lib/prismaClient');

async function testIdiomRoute() {
    try {
        console.log('🧪 Testing idiom route logic...');
        
        // 실제 라우트와 동일한 로직 테스트
        const category = '숙어'; // 프론트엔드에서 보내는 값
        
        let whereClause = {};
        if (category) {
            whereClause.category = {
                contains: category
            };
        }
        
        console.log('🔍 Where clause:', JSON.stringify(whereClause, null, 2));
        
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
            },
            take: 3 // 처음 3개만 테스트
        });
        
        console.log(`📊 Found ${idioms.length} idioms`);
        
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
        
        console.log('📝 Sample formatted output:');
        console.log(JSON.stringify(formattedIdioms[0], null, 2));
        
        console.log('✅ Route logic working correctly!');
        
    } catch (error) {
        console.error('❌ Route test failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testIdiomRoute();