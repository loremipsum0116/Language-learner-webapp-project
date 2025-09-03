// server/test_idiom_api.js
// 숙어 API 테스트

const { prisma } = require('./lib/prismaClient');

async function testIdiomApi() {
    try {
        console.log('🧪 Testing idiom database queries...');
        
        // 전체 개수 확인
        const totalCount = await prisma.idiom.count();
        console.log(`📊 Total idioms in database: ${totalCount}`);
        
        // 샘플 데이터 조회 (new fields 포함)
        const sampleIdioms = await prisma.idiom.findMany({
            take: 3,
            select: {
                id: true,
                idiom: true,
                korean_meaning: true,
                category: true,
                example_sentence: true,
                ko_example_sentence: true
            }
        });
        
        console.log('📝 Sample idioms with new fields:');
        sampleIdioms.forEach((idiom, idx) => {
            console.log(`   ${idx + 1}. ${idiom.idiom}`);
            console.log(`      Korean: ${idiom.korean_meaning}`);
            console.log(`      Category: ${idiom.category}`);
            console.log(`      Example: ${idiom.example_sentence || 'No example'}`);
            console.log(`      Ko Example: ${idiom.ko_example_sentence || 'No ko example'}`);
            console.log('');
        });
        
        // 카테고리별 개수
        const idiomCount = await prisma.idiom.count({
            where: { category: { contains: '숙어' } }
        });
        
        const phraseCount = await prisma.idiom.count({
            where: { category: { contains: '구동사' } }
        });
        
        console.log(`📊 Category breakdown:`);
        console.log(`   숙어 (idioms): ${idiomCount}`);
        console.log(`   구동사 (phrasal verbs): ${phraseCount}`);
        
        console.log('✅ Database queries working correctly!');
        
    } catch (error) {
        console.error('❌ Database query failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testIdiomApi();