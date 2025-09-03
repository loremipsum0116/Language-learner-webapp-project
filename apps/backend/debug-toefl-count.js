// server/debug-toefl-count.js
// TOEFL 단어 수 차이 분석

const { prisma } = require('./lib/prismaClient');
const fs = require('fs');

async function debugToeflCount() {
    try {
        console.log('🔍 Debugging TOEFL word count discrepancy...\n');
        
        // 1. JSON 파일에서 TOEFL 단어 수 확인
        const cefrVocabs = JSON.parse(fs.readFileSync('./cefr_vocabs.json', 'utf8'));
        const toeflWordsInJson = cefrVocabs.filter(vocab => 
            vocab.categories && vocab.categories.includes('TOEFL')
        );
        console.log(`📄 JSON file: ${toeflWordsInJson.length} words contain TOEFL`);
        
        // 2. 데이터베이스에서 TOEFL 카테고리 확인
        const toeflCategory = await prisma.examcategory.findUnique({
            where: { name: 'TOEFL' },
            include: {
                vocabexamcategory: {
                    include: {
                        vocab: true
                    }
                }
            }
        });
        
        if (!toeflCategory) {
            console.log('❌ TOEFL category not found in database');
            return;
        }
        
        console.log(`📊 Database: ${toeflCategory.vocabexamcategory.length} words linked to TOEFL category`);
        console.log(`📊 Category totalWords field: ${toeflCategory.totalWords}`);
        
        // 3. 중복된 단어 확인 (lemma + pos 같은 것들)
        const vocabsByLemma = {};
        toeflCategory.vocabexamcategory.forEach(vec => {
            const key = `${vec.vocab.lemma}_${vec.vocab.pos}`;
            if (!vocabsByLemma[key]) {
                vocabsByLemma[key] = [];
            }
            vocabsByLemma[key].push(vec.vocab);
        });
        
        const duplicates = Object.entries(vocabsByLemma).filter(([key, vocabs]) => vocabs.length > 1);
        console.log(`🔍 Duplicate lemma+pos combinations: ${duplicates.length}`);
        
        if (duplicates.length > 0) {
            console.log('   Examples:');
            duplicates.slice(0, 5).forEach(([key, vocabs]) => {
                console.log(`   - ${key}: ${vocabs.length} entries (IDs: ${vocabs.map(v => v.id).join(', ')})`);
            });
        }
        
        // 4. JSON에서 중복 확인
        const jsonLemmas = {};
        toeflWordsInJson.forEach(vocab => {
            const key = `${vocab.lemma}_${vocab.pos || 'unknown'}`;
            if (!jsonLemmas[key]) {
                jsonLemmas[key] = [];
            }
            jsonLemmas[key].push(vocab);
        });
        
        const jsonDuplicates = Object.entries(jsonLemmas).filter(([key, vocabs]) => vocabs.length > 1);
        console.log(`🔍 JSON duplicate lemma+pos combinations: ${jsonDuplicates.length}`);
        
        // 5. 실제 vocab 테이블의 총 단어 수 확인
        const totalVocabs = await prisma.vocab.count();
        console.log(`📊 Total vocab entries in database: ${totalVocabs}`);
        
        // 6. source별 분류
        const vocabsBySource = await prisma.vocab.groupBy({
            by: ['source'],
            _count: {
                id: true
            }
        });
        
        console.log('\n📊 Vocabs by source:');
        vocabsBySource.forEach(group => {
            console.log(`   ${group.source || 'null'}: ${group._count.id} words`);
        });
        
        // 7. 페이지에서 표시되는 카운트와 비교하기 위해 실제 쿼리 실행
        const toeflVocabsQuery = await prisma.vocab.findMany({
            where: {
                vocabexamcategory: {
                    some: {
                        examCategory: {
                            name: 'TOEFL'
                        }
                    }
                }
            },
            select: {
                id: true,
                lemma: true,
                pos: true
            }
        });
        
        console.log(`🔍 Direct query result: ${toeflVocabsQuery.length} TOEFL words`);
        
        // 8. 페이지에서 3713개가 나오는 이유 분석을 위해 중복 제거해서 카운트
        const uniqueToeflWords = new Set();
        toeflVocabsQuery.forEach(vocab => {
            uniqueToeflWords.add(vocab.lemma);
        });
        
        console.log(`🔍 Unique lemmas in TOEFL: ${uniqueToeflWords.size}`);
        
    } catch (error) {
        console.error('❌ Error debugging TOEFL count:', error);
    } finally {
        await prisma.$disconnect();
    }
}

debugToeflCount();