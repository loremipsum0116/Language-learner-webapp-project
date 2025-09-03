// server/check-api-query.js
// API에서 사용하는 쿼리와 동일하게 실행해서 확인

const { prisma } = require('./lib/prismaClient');

async function checkApiQuery() {
    try {
        console.log('🔍 Checking API queries...\n');
        
        // 1. categories API와 동일한 쿼리
        console.log('📊 Categories API query:');
        const categoriesRaw = await prisma.$queryRaw`
            SELECT 
                ec.*,
                COALESCE(COUNT(vec.vocabId), 0) as actualWordCount
            FROM exam_categories ec
            LEFT JOIN vocab_exam_categories vec ON ec.id = vec.examCategoryId
            GROUP BY ec.id
            ORDER BY ec.id
        `;

        categoriesRaw.forEach(cat => {
            console.log(`   ${cat.name}: totalWords=${cat.totalWords}, actualWordCount=${cat.actualWordCount}`);
        });
        
        // 2. TOEFL 상세 확인
        console.log('\n🔍 TOEFL category details:');
        const toeflCategory = await prisma.$queryRaw`
            SELECT * FROM exam_categories WHERE name = 'TOEFL'
        `;
        
        if (toeflCategory.length > 0) {
            const categoryId = toeflCategory[0].id;
            console.log(`   TOEFL category ID: ${categoryId}`);
            console.log(`   TOEFL totalWords: ${toeflCategory[0].totalWords}`);
            
            // TOEFL 단어들 직접 카운트
            const toeflWordsCount = await prisma.$queryRaw`
                SELECT COUNT(*) as total
                FROM vocab v
                INNER JOIN vocab_exam_categories vec ON v.id = vec.vocabId
                WHERE vec.examCategoryId = ${categoryId}
            `;
            
            console.log(`   Direct count query result: ${toeflWordsCount[0].total}`);
            
            // 몇 개 샘플 단어들도 확인
            const sampleWords = await prisma.$queryRaw`
                SELECT v.lemma, v.pos, v.levelCEFR
                FROM vocab v
                INNER JOIN vocab_exam_categories vec ON v.id = vec.vocabId
                WHERE vec.examCategoryId = ${categoryId}
                ORDER BY v.lemma
                LIMIT 10
            `;
            
            console.log('   Sample words:');
            sampleWords.forEach(word => {
                console.log(`     - ${word.lemma} (${word.pos}, ${word.levelCEFR})`);
            });
        }
        
        // 3. 프론트엔드에서 3713이 나오는 이유를 찾기 위해 
        // 특별한 필터링이 있는지 확인
        console.log('\n🔍 Checking for any special filtering...');
        
        // 혹시 dictentry가 있는 것만 카운트하는지 확인
        const toeflWithDict = await prisma.$queryRaw`
            SELECT COUNT(*) as total
            FROM vocab v
            INNER JOIN vocab_exam_categories vec ON v.id = vec.vocabId
            INNER JOIN dictentry de ON v.id = de.vocabId
            WHERE vec.examCategoryId = ${toeflCategory[0].id}
        `;
        
        console.log(`   TOEFL words with dictionary entries: ${toeflWithDict[0].total}`);
        
        // 혹시 특정 source만 필터링하는지 확인
        const toeflBySource = await prisma.$queryRaw`
            SELECT v.source, COUNT(*) as count
            FROM vocab v
            INNER JOIN vocab_exam_categories vec ON v.id = vec.vocabId
            WHERE vec.examCategoryId = ${toeflCategory[0].id}
            GROUP BY v.source
        `;
        
        console.log('   TOEFL words by source:');
        toeflBySource.forEach(row => {
            console.log(`     ${row.source}: ${row.count}`);
        });
        
    } catch (error) {
        console.error('❌ Error checking API query:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkApiQuery();