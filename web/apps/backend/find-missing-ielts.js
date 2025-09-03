// server/find-missing-ielts.js
// IELTS 누락된 단어 찾기

const { prisma } = require('./lib/prismaClient');
const fs = require('fs');

async function findMissingIelts() {
    try {
        console.log('🔍 Finding missing IELTS words...\n');
        
        // 1. JSON에서 IELTS 단어들 추출
        const cefrVocabs = JSON.parse(fs.readFileSync('./cefr_vocabs.json', 'utf8'));
        const ieltsWordsFromJson = cefrVocabs.filter(vocab => 
            vocab.categories && (
                vocab.categories.includes('IELTS-A') ||
                vocab.categories.includes('IELTS-B') ||
                vocab.categories.includes('IELTS-C')
            )
        );
        
        console.log(`📊 JSON IELTS words: ${ieltsWordsFromJson.length}`);
        
        // 2. 데이터베이스에서 IELTS-A 카테고리 단어들 조회
        const ieltsCategory = await prisma.$queryRaw`
            SELECT * FROM exam_categories WHERE name = 'IELTS-A'
        `;
        
        const ieltsWordsFromDb = await prisma.$queryRaw`
            SELECT v.lemma, v.pos
            FROM vocab v
            INNER JOIN vocab_exam_categories vec ON v.id = vec.vocabId
            WHERE vec.examCategoryId = ${ieltsCategory[0].id}
            ORDER BY v.lemma
        `;
        
        console.log(`📊 DB IELTS words: ${ieltsWordsFromDb.length}`);
        
        // 3. JSON에만 있고 DB에 없는 단어 찾기
        const dbLemmas = new Set(ieltsWordsFromDb.map(w => w.lemma.toLowerCase()));
        const missingWords = ieltsWordsFromJson.filter(jsonWord => 
            !dbLemmas.has(jsonWord.lemma.toLowerCase())
        );
        
        console.log(`\n❌ Missing words (${missingWords.length}):`);
        missingWords.forEach((word, index) => {
            if (index < 20) { // 처음 20개만 표시
                console.log(`   ${index + 1}. ${word.lemma} (${word.pos})`);
            }
        });
        
        if (missingWords.length > 20) {
            console.log(`   ... and ${missingWords.length - 20} more`);
        }
        
        // 4. DB에만 있고 JSON에 없는 단어도 확인 (혹시 모르니)
        const jsonLemmas = new Set(ieltsWordsFromJson.map(w => w.lemma.toLowerCase()));
        const extraWords = ieltsWordsFromDb.filter(dbWord => 
            !jsonLemmas.has(dbWord.lemma.toLowerCase())
        );
        
        if (extraWords.length > 0) {
            console.log(`\n➕ Extra words in DB (${extraWords.length}):`);
            extraWords.forEach((word, index) => {
                if (index < 10) {
                    console.log(`   ${index + 1}. ${word.lemma} (${word.pos})`);
                }
            });
        }
        
        // 5. 중복 단어 확인
        const jsonLemmaCount = {};
        ieltsWordsFromJson.forEach(word => {
            const key = word.lemma.toLowerCase();
            jsonLemmaCount[key] = (jsonLemmaCount[key] || 0) + 1;
        });
        
        const duplicates = Object.entries(jsonLemmaCount).filter(([lemma, count]) => count > 1);
        if (duplicates.length > 0) {
            console.log(`\n🔄 Duplicates in JSON (${duplicates.length}):`);
            duplicates.forEach(([lemma, count]) => {
                console.log(`   ${lemma}: ${count} times`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error finding missing words:', error);
    } finally {
        await prisma.$disconnect();
    }
}

findMissingIelts();