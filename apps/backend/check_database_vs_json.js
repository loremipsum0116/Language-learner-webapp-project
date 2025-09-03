// server/check_database_vs_json.js
// 데이터베이스에 시딩된 단어 수와 JSON 파일의 단어 수 비교

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDatabaseVsJson() {
    try {
        console.log('🔍 Checking database vs JSON file...');
        
        // 데이터베이스에서 단어 수 확인
        const dbWordCount = await prisma.vocabulary.count();
        console.log(`📊 Database vocabulary count: ${dbWordCount}`);
        
        // 레벨별 데이터베이스 단어 수 확인
        const levelCounts = await prisma.vocabulary.groupBy({
            by: ['level'],
            _count: {
                id: true
            },
            orderBy: {
                level: 'asc'
            }
        });
        
        console.log('\n📈 Database words by level:');
        levelCounts.forEach(level => {
            console.log(`   ${level.level}: ${level._count.id}`);
        });
        
        // JSON 파일에서 단어 수 확인
        const cefrVocabsFile = path.join(__dirname, 'cefr_vocabs.json');
        const cefrContent = fs.readFileSync(cefrVocabsFile, 'utf8');
        const cefrVocabs = JSON.parse(cefrContent);
        
        console.log(`\n📊 JSON file vocabulary count: ${cefrVocabs.length}`);
        
        // JSON 파일의 레벨별 단어 수 확인
        const jsonLevelCounts = {};
        cefrVocabs.forEach(vocab => {
            const level = vocab.levelCEFR;
            if (!jsonLevelCounts[level]) {
                jsonLevelCounts[level] = 0;
            }
            jsonLevelCounts[level]++;
        });
        
        console.log('\n📈 JSON words by level:');
        Object.keys(jsonLevelCounts).sort().forEach(level => {
            console.log(`   ${level}: ${jsonLevelCounts[level]}`);
        });
        
        // 차이점 분석
        console.log(`\n🔍 Difference: ${dbWordCount - cefrVocabs.length} words`);
        
        if (dbWordCount > cefrVocabs.length) {
            console.log('📌 Database has more words than JSON file');
            
            // 데이터베이스에만 있는 단어들 샘플 확인
            const dbWords = await prisma.vocabulary.findMany({
                select: { lemma: true, level: true },
                take: 20
            });
            
            const jsonLemmas = new Set(cefrVocabs.map(v => v.lemma));
            const onlyInDb = dbWords.filter(word => !jsonLemmas.has(word.lemma));
            
            if (onlyInDb.length > 0) {
                console.log('\n📝 Sample words only in database:');
                onlyInDb.slice(0, 10).forEach((word, index) => {
                    console.log(`   ${index + 1}. ${word.lemma} (${word.level})`);
                });
            }
        }
        
    } catch (error) {
        console.error('❌ Error checking database vs JSON:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkDatabaseVsJson();