// 최종 숙어 API 테스트
const { prisma } = require('./lib/prismaClient');

async function testIdiomAPI() {
    try {
        console.log('🔍 Testing complete idiom API...');
        
        // 1. 전체 숙어 개수 확인
        const totalCount = await prisma.idiom.count();
        console.log(`📊 Total idioms in database: ${totalCount}`);
        
        // 2. 카테고리별 개수
        const idiomCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM idioms WHERE category LIKE '%숙어%'`;
        const phraseCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM idioms WHERE category LIKE '%구동사%'`;
        console.log(`📊 Idiom count: ${Number(idiomCount[0].count)}`);
        console.log(`📊 Phrasal verb count: ${Number(phraseCount[0].count)}`);
        
        // 3. 전체 목록 쿼리 (LIMIT 없이)
        const query = `
            SELECT id, idiom, korean_meaning, usage_context_korean, 
                   category, koChirpScript, audioWord, audioGloss, 
                   audioExample, example_sentence, ko_example_sentence 
            FROM idioms
            ORDER BY idiom ASC
        `;
        
        console.log('🔍 Executing full list query...');
        const allIdioms = await prisma.$queryRawUnsafe(query);
        console.log(`✅ Retrieved ${allIdioms.length} idioms from database`);
        
        // 4. 숙어만 필터링
        const idiomQuery = `
            SELECT id, idiom, korean_meaning, usage_context_korean, 
                   category, koChirpScript, audioWord, audioGloss, 
                   audioExample, example_sentence, ko_example_sentence 
            FROM idioms
            WHERE category LIKE '%숙어%'
            ORDER BY idiom ASC
        `;
        
        console.log('🔍 Executing idiom-only query...');
        const idiomsOnly = await prisma.$queryRawUnsafe(idiomQuery);
        console.log(`✅ Retrieved ${idiomsOnly.length} idioms (filtered)`);
        
        // 5. 구동사만 필터링
        const phraseQuery = `
            SELECT id, idiom, korean_meaning, usage_context_korean, 
                   category, koChirpScript, audioWord, audioGloss, 
                   audioExample, example_sentence, ko_example_sentence 
            FROM idioms
            WHERE category LIKE '%구동사%'
            ORDER BY idiom ASC
        `;
        
        console.log('🔍 Executing phrasal verb-only query...');
        const phrasesOnly = await prisma.$queryRawUnsafe(phraseQuery);
        console.log(`✅ Retrieved ${phrasesOnly.length} phrasal verbs (filtered)`);
        
        // 6. 예시 데이터 확인
        if (allIdioms.length > 0) {
            const sample = allIdioms[0];
            console.log('\n📋 Sample data:');
            console.log(`   Idiom: ${sample.idiom}`);
            console.log(`   Korean: ${sample.korean_meaning}`);
            console.log(`   Example: ${sample.example_sentence}`);
            console.log(`   Ko Example: ${sample.ko_example_sentence}`);
            console.log(`   Category: ${sample.category}`);
        }
        
        console.log('\n🎉 All tests completed successfully!');
        console.log(`📊 Summary: ${allIdioms.length} total, ${idiomsOnly.length} idioms, ${phrasesOnly.length} phrasal verbs`);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testIdiomAPI();