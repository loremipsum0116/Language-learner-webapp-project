// server/utils/analyzeData.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzeCurrentData() {
    try {
        console.log('=== CURRENT DATA STATE ANALYSIS ===');
        
        // A1 단어 중 일부 샘플 확인
        const sampleVocabs = await prisma.$queryRaw`
            SELECT v.id, v.lemma, v.levelCEFR, d.examples
            FROM vocab v 
            LEFT JOIN dictentry d ON v.id = d.vocabId 
            WHERE v.levelCEFR = 'A1' 
            ORDER BY v.id
            LIMIT 10
        `;
        
        console.log(`\n📊 Analyzing ${sampleVocabs.length} sample vocabs:`);
        
        let hasExamples = 0;
        let noExamples = 0;
        let hasKoDef = 0;
        let noKoDef = 0;
        
        sampleVocabs.forEach((vocab, index) => {
            const examples = vocab.examples || [];
            const hasValidExamples = examples.length > 0;
            const firstKoDef = examples.length > 0 && examples[0]?.definitions?.[0]?.ko_def;
            
            console.log(`\n${index + 1}. ${vocab.lemma} (ID: ${vocab.id})`);
            console.log(`   Examples count: ${examples.length}`);
            console.log(`   Ko_def: ${firstKoDef || 'NONE'}`);
            if (examples.length > 1) {
                console.log(`   ⚠️  Multiple examples detected!`);
                examples.forEach((ex, i) => {
                    console.log(`     Example ${i + 1}: ${ex?.definitions?.[0]?.ko_def || 'NO_DEF'}`);
                });
            }
            
            if (hasValidExamples) hasExamples++; else noExamples++;
            if (firstKoDef) hasKoDef++; else noKoDef++;
        });
        
        console.log(`\n📈 Summary:`);
        console.log(`   - Has examples: ${hasExamples}`);
        console.log(`   - No examples: ${noExamples}`);
        console.log(`   - Has ko_def: ${hasKoDef}`);
        console.log(`   - No ko_def: ${noKoDef}`);
        
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

// 직접 실행
if (require.main === module) {
    analyzeCurrentData();
}

module.exports = analyzeCurrentData;