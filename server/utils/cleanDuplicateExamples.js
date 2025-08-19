// server/utils/cleanDuplicateExamples.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * dictentry의 examples 배열에서 중복된 항목들을 제거하는 스크립트
 */
async function cleanDuplicateExamples() {
    try {
        console.log('🧹 Starting to clean duplicate examples...');
        
        // 모든 dictentry 조회
        const dictentries = await prisma.dictentry.findMany({
            where: {
                examples: {
                    not: null
                }
            }
        });
        
        console.log(`📊 Found ${dictentries.length} dictentries with examples`);
        
        let cleanedCount = 0;
        let skippedCount = 0;
        
        for (const entry of dictentries) {
            const rawExamples = Array.isArray(entry.examples) ? entry.examples : [];
            
            if (rawExamples.length <= 1) {
                skippedCount++;
                continue;
            }
            
            // 중복 제거: 동일한 pos와 definitions를 가진 examples 제거
            const uniqueExamples = rawExamples.filter((example, index, arr) => {
                return index === arr.findIndex(e => 
                    e.pos === example.pos && 
                    JSON.stringify(e.definitions) === JSON.stringify(example.definitions)
                );
            });
            
            // 중복이 제거된 경우에만 업데이트
            if (uniqueExamples.length !== rawExamples.length) {
                await prisma.dictentry.update({
                    where: { id: entry.id },
                    data: { examples: uniqueExamples }
                });
                
                console.log(`✨ Cleaned vocabId ${entry.vocabId}: ${rawExamples.length} → ${uniqueExamples.length} examples`);
                cleanedCount++;
            } else {
                skippedCount++;
            }
        }
        
        console.log(`✅ Cleaning completed!`);
        console.log(`   - Cleaned: ${cleanedCount} entries`);
        console.log(`   - Skipped: ${skippedCount} entries`);
        
    } catch (error) {
        console.error('❌ Error cleaning duplicate examples:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// 직접 실행된 경우
if (require.main === module) {
    cleanDuplicateExamples();
}

module.exports = cleanDuplicateExamples;