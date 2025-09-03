// server/debug-total-count.js
// totalCount 문제 디버깅

const { prisma } = require('./lib/prismaClient');

async function debugTotalCount() {
    try {
        console.log('🔍 Debugging totalCount issue...\n');
        
        // 1. 카테고리 정보 확인
        const category = await prisma.$queryRaw`
            SELECT * FROM exam_categories WHERE name = 'TOEFL'
        `;
        
        console.log('📊 TOEFL Category:');
        console.log(`   ID: ${category[0].id}`);
        console.log(`   totalWords: ${category[0].totalWords}`);
        console.log(`   Type of totalWords: ${typeof category[0].totalWords}`);
        
        // 2. BigInt 변환 테스트
        const bigIntValue = BigInt(category[0].totalWords);
        const numberValue = Number(category[0].totalWords);
        
        console.log(`\n🔢 Conversion test:`);
        console.log(`   BigInt: ${bigIntValue}`);
        console.log(`   Number: ${numberValue}`);
        
        // 3. 실제 DB 카운트
        const dbCount = await prisma.$queryRaw`
            SELECT COUNT(*) as total
            FROM vocab v
            INNER JOIN vocab_exam_categories vec ON v.id = vec.vocabId
            WHERE vec.examCategoryId = ${category[0].id}
        `;
        
        console.log(`\n📊 Database count: ${dbCount[0].total}`);
        
        // 4. 시뮬레이션 결과
        const simulatedResult = [{ total: BigInt(category[0].totalWords) }];
        const finalCount = Number(simulatedResult[0].total);
        
        console.log(`\n🧪 Simulation:`);
        console.log(`   Simulated result: ${simulatedResult[0].total}`);
        console.log(`   Final count: ${finalCount}`);
        
    } catch (error) {
        console.error('❌ Debug error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

debugTotalCount();