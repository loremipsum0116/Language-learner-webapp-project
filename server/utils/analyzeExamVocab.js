// server/utils/analyzeExamVocab.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzeExamVocabResponse() {
    try {
        console.log('=== EXAM VOCAB API RESPONSE ANALYSIS ===');
        
        // TOEIC 단어 몇 개 조회해서 구조 확인
        const vocabsRaw = await prisma.$queryRaw`
            SELECT 
                v.*,
                de.ipa,
                de.audioUrl,
                de.examples,
                vec.priority,
                vec.addedAt as examAddedAt
            FROM vocab v
            INNER JOIN vocab_exam_categories vec ON v.id = vec.vocabId
            LEFT JOIN dictentry de ON v.id = de.vocabId
            WHERE vec.examCategoryId = 1
            ORDER BY vec.priority DESC, v.lemma ASC 
            LIMIT 5
        `;
        
        console.log(`\n📊 Found ${vocabsRaw.length} TOEIC vocabs:`);
        
        vocabsRaw.forEach((vocab, index) => {
            console.log(`\n${index + 1}. ${vocab.lemma} (ID: ${vocab.id})`);
            console.log(`   Has examples: ${!!vocab.examples}`);
            console.log(`   Examples count: ${vocab.examples ? vocab.examples.length : 0}`);
            if (vocab.examples && vocab.examples.length > 0) {
                console.log(`   First ko_def: ${vocab.examples[0]?.definitions?.[0]?.ko_def || 'NONE'}`);
            }
            console.log(`   Has ko_gloss field: ${vocab.hasOwnProperty('ko_gloss') ? 'YES' : 'NO'}`);
        });
        
        console.log('\n=== SIMULATING examVocab.js PROCESSING ===');
        
        // examVocab.js의 현재 로직 시뮬레이션
        const processedVocabs = vocabsRaw.map(vocab => ({
            ...vocab,
            id: Number(vocab.id),
            priority: Number(vocab.priority)
        }));
        
        console.log('\nProcessed vocabs (현재 examVocab.js 방식):');
        processedVocabs.forEach((vocab, index) => {
            console.log(`${index + 1}. ${vocab.lemma}: ko_gloss = ${vocab.ko_gloss || 'UNDEFINED'}`);
        });
        
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

// 직접 실행
if (require.main === module) {
    analyzeExamVocabResponse();
}

module.exports = analyzeExamVocabResponse;