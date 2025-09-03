// server/utils/smartCleanExamples.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * dictentry의 examples 배열에서 스마트하게 중복을 제거하는 스크립트
 * - 같은 pos와 ko_def를 가지지만 examples 배열이 다른 경우, 더 풍부한 것을 선택
 */
async function smartCleanExamples() {
    try {
        console.log('🧠 Starting smart cleaning of duplicate examples...');
        
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
            
            // 스마트 중복 제거: pos와 ko_def 기준으로 그룹화
            const groupMap = new Map();
            
            for (const example of rawExamples) {
                const pos = example.pos || 'unknown';
                const koDef = example.definitions?.[0]?.ko_def || 'unknown';
                const key = `${pos}|||${koDef}`;
                
                if (!groupMap.has(key)) {
                    groupMap.set(key, []);
                }
                groupMap.get(key).push(example);
            }
            
            // 각 그룹에서 가장 풍부한 example 선택
            const uniqueExamples = [];
            for (const [key, examples] of groupMap.entries()) {
                if (examples.length === 1) {
                    uniqueExamples.push(examples[0]);
                } else {
                    // 가장 많은 example을 가진 것 선택
                    const best = examples.reduce((prev, current) => {
                        const prevExampleCount = prev.definitions?.[0]?.examples?.length || 0;
                        const currentExampleCount = current.definitions?.[0]?.examples?.length || 0;
                        return currentExampleCount > prevExampleCount ? current : prev;
                    });
                    uniqueExamples.push(best);
                }
            }
            
            // 중복이 제거된 경우에만 업데이트
            if (uniqueExamples.length !== rawExamples.length) {
                await prisma.dictentry.update({
                    where: { id: entry.id },
                    data: { examples: uniqueExamples }
                });
                
                console.log(`✨ Smart cleaned vocabId ${entry.vocabId}: ${rawExamples.length} → ${uniqueExamples.length} examples`);
                cleanedCount++;
            } else {
                skippedCount++;
            }
        }
        
        console.log(`✅ Smart cleaning completed!`);
        console.log(`   - Cleaned: ${cleanedCount} entries`);
        console.log(`   - Skipped: ${skippedCount} entries`);
        
    } catch (error) {
        console.error('❌ Error during smart cleaning:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// 직접 실행된 경우
if (require.main === module) {
    smartCleanExamples();
}

module.exports = smartCleanExamples;