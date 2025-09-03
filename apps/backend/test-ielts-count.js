// server/test-ielts-count.js
// IELTS-A 단어 개수 테스트

const { prisma } = require('./lib/prismaClient');

async function testIeltsCount() {
    try {
        console.log('🔍 Testing IELTS-A word count...\n');
        
        // 1. 카테고리 정보 확인
        const category = await prisma.$queryRaw`
            SELECT * FROM exam_categories WHERE name = 'IELTS-A'
        `;
        
        console.log('📊 IELTS-A Category:');
        console.log(`   totalWords: ${category[0].totalWords}`);
        
        // 2. 실제 DB 단어 개수
        const dbCount = await prisma.$queryRaw`
            SELECT COUNT(*) as total
            FROM vocab v
            INNER JOIN vocab_exam_categories vec ON v.id = vec.vocabId
            WHERE vec.examCategoryId = ${category[0].id}
        `;
        
        console.log(`   DB count: ${dbCount[0].total}`);
        
        // 3. API 시뮬레이션으로 모든 단어 조회
        const allVocabs = await prisma.$queryRaw`
            SELECT v.id, v.lemma
            FROM vocab v
            INNER JOIN vocab_exam_categories vec ON v.id = vec.vocabId
            WHERE vec.examCategoryId = ${category[0].id}
            ORDER BY vec.priority DESC, v.lemma ASC
        `;
        
        console.log(`   All vocabs query result: ${allVocabs.length}`);
        
        // 4. limit=5300으로 API 호출 시뮬레이션
        const limitedVocabs = await prisma.$queryRaw`
            SELECT v.id, v.lemma
            FROM vocab v
            INNER JOIN vocab_exam_categories vec ON v.id = vec.vocabId
            WHERE vec.examCategoryId = ${category[0].id}
            ORDER BY vec.priority DESC, v.lemma ASC
            LIMIT 5300
        `;
        
        console.log(`   With LIMIT 5300: ${limitedVocabs.length}`);
        
        // 5. JSON 파일에서 IELTS 개수 확인
        const fs = require('fs');
        const cefrVocabs = JSON.parse(fs.readFileSync('./cefr_vocabs.json', 'utf8'));
        
        const ieltsWords = cefrVocabs.filter(vocab => 
            vocab.categories && vocab.categories.includes('IELTS')
        );
        
        console.log(`   JSON IELTS words: ${ieltsWords.length}`);
        
        const ieltsAWords = cefrVocabs.filter(vocab => 
            vocab.categories && vocab.categories.includes('IELTS-A')
        );
        
        console.log(`   JSON IELTS-A words: ${ieltsAWords.length}`);
        
    } catch (error) {
        console.error('❌ Error testing IELTS count:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testIeltsCount();