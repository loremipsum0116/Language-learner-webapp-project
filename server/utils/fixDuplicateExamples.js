// server/utils/fixDuplicateExamples.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * dictentry의 examples 배열에서 정확히 동일한 중복 항목들을 제거하는 스크립트
 */
async function fixDuplicateExamples() {
    try {
        console.log('🔧 Starting to fix duplicate examples...');
        
        // 모든 dictentry 조회
        const dictentries = await prisma.dictentry.findMany({
            where: {
                examples: {
                    not: null
                }
            }
        });
        
        console.log(`📊 Found ${dictentries.length} dictentries with examples`);
        
        let fixedCount = 0;
        let skippedCount = 0;
        
        for (const entry of dictentries) {
            const rawExamples = Array.isArray(entry.examples) ? entry.examples : [];
            
            if (rawExamples.length <= 1) {
                skippedCount++;
                continue;
            }
            
            // 더 엄격한 중복 제거: 완전히 동일한 객체만 제거
            const uniqueExamples = [];
            const seenObjects = new Set();
            
            for (const example of rawExamples) {
                const serialized = JSON.stringify(example);
                if (!seenObjects.has(serialized)) {
                    seenObjects.add(serialized);
                    uniqueExamples.push(example);
                }
            }
            
            // 중복이 제거된 경우에만 업데이트
            if (uniqueExamples.length !== rawExamples.length) {
                await prisma.dictentry.update({
                    where: { id: entry.id },
                    data: { examples: uniqueExamples }
                });
                
                console.log(`✨ Fixed vocabId ${entry.vocabId}: ${rawExamples.length} → ${uniqueExamples.length} examples`);
                fixedCount++;
            } else {
                skippedCount++;
            }
        }
        
        console.log(`✅ Fixing completed!`);
        console.log(`   - Fixed: ${fixedCount} entries`);
        console.log(`   - Skipped: ${skippedCount} entries`);
        
    } catch (error) {
        console.error('❌ Error fixing duplicate examples:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// 직접 실행된 경우
if (require.main === module) {
    fixDuplicateExamples();
}

module.exports = fixDuplicateExamples;