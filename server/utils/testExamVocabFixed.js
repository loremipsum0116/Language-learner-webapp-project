// server/utils/testExamVocabFixed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testExamVocabFixed() {
    try {
        console.log('=== TESTING FIXED EXAM VOCAB LOGIC ===');
        
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
        
        // 수정된 로직 적용
        const vocabs = vocabsRaw.map(vocab => {
            const rawExamples = Array.isArray(vocab.examples) ? vocab.examples : [];
            
            // 중복 제거: 동일한 pos와 definitions를 가진 examples 제거
            const examples = rawExamples.filter((example, index, arr) => {
                return index === arr.findIndex(e => 
                    e.pos === example.pos && 
                    JSON.stringify(e.definitions) === JSON.stringify(example.definitions)
                );
            });
            
            let primaryGloss = null;
            if (examples.length > 0 && examples[0].definitions?.length > 0) {
                primaryGloss = examples[0].definitions[0].ko_def || null;
            }
            
            return {
                ...vocab,
                id: Number(vocab.id),
                priority: Number(vocab.priority),
                ko_gloss: primaryGloss,
                examples: examples
            };
        });
        
        console.log('\n✅ Fixed vocabs (with ko_gloss):');
        vocabs.forEach((vocab, index) => {
            console.log(`${index + 1}. ${vocab.lemma}: ko_gloss = "${vocab.ko_gloss || 'NULL'}"`);
        });
        
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

// 직접 실행
if (require.main === module) {
    testExamVocabFixed();
}

module.exports = testExamVocabFixed;