// server/fix_idiom_api.js
// 숙어 API 문제 해결 스크립트

const express = require('express');
const { prisma } = require('./lib/prismaClient');

async function fixIdiomApi() {
    try {
        console.log('🔧 Fixing idiom API issues...');
        
        // 1. Prisma Client 상태 확인
        console.log('1️⃣ Testing Prisma connection...');
        const count = await prisma.idiom.count();
        console.log(`   Database connected, ${count} idioms found`);
        
        // 2. 새로운 필드가 있는지 확인
        console.log('2️⃣ Checking new fields...');
        const sampleWithFields = await prisma.idiom.findFirst({
            select: {
                id: true,
                idiom: true,
                example_sentence: true,
                ko_example_sentence: true
            }
        });
        
        if (sampleWithFields.example_sentence && sampleWithFields.ko_example_sentence) {
            console.log('   ✅ New fields are accessible');
            console.log(`   Sample: ${sampleWithFields.example_sentence}`);
        } else {
            console.log('   ❌ New fields not accessible');
            console.log('   Sample data:', sampleWithFields);
        }
        
        // 3. 실제 API 로직 테스트
        console.log('3️⃣ Testing actual API logic...');
        
        const testCategory = '숙어';
        const whereClause = testCategory ? { category: { contains: testCategory } } : {};
        
        const results = await prisma.idiom.findMany({
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
            take: 5
        });
        
        console.log(`   Found ${results.length} results for category "${testCategory}"`);
        
        // 4. 응답 형식화
        const formattedResults = results.map(idiom => ({
            ...idiom,
            audio: {
                word: idiom.audioWord,
                gloss: idiom.audioGloss,
                example: idiom.audioExample
            },
            example: idiom.example_sentence,
            koExample: idiom.ko_example_sentence
        }));
        
        console.log('4️⃣ Formatted response sample:');
        if (formattedResults.length > 0) {
            const sample = formattedResults[0];
            console.log(`   Idiom: ${sample.idiom}`);
            console.log(`   Korean: ${sample.korean_meaning}`);
            console.log(`   Example: ${sample.example}`);
            console.log(`   Ko Example: ${sample.koExample}`);
            console.log('   ✅ API logic working correctly');
        }
        
        // 5. 모든 카테고리 테스트
        console.log('5️⃣ Testing all categories...');
        const allCategories = ['숙어', '구동사', ''];
        
        for (const cat of allCategories) {
            const testWhere = cat ? { category: { contains: cat } } : {};
            const testCount = await prisma.idiom.count({ where: testWhere });
            console.log(`   Category "${cat || 'all'}": ${testCount} items`);
        }
        
        console.log('\n🎉 API diagnostic completed successfully!');
        
    } catch (error) {
        console.error('❌ API diagnostic failed:', error);
        
        // 더 자세한 오류 정보
        if (error.code) {
            console.error(`   Error code: ${error.code}`);
        }
        if (error.meta) {
            console.error(`   Error meta:`, error.meta);
        }
        
    } finally {
        await prisma.$disconnect();
    }
}

// 실행
if (require.main === module) {
    fixIdiomApi();
}

module.exports = fixIdiomApi;