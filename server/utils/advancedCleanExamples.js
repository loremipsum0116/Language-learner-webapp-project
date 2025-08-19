// server/utils/advancedCleanExamples.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * dictentry의 examples 배열에서 고급 중복 제거를 수행하는 스크립트
 * - 같은 pos를 가진 항목들 중에서 가장 풍부한 것만 선택
 * - ko_def가 비슷한 경우 더 긴 설명을 가진 것 선택
 */
async function advancedCleanExamples() {
    try {
        console.log('🚀 Starting advanced cleaning of duplicate examples...');
        
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
            
            // 고급 중복 제거: pos 기준으로 그룹화
            const posGroups = new Map();
            
            for (const example of rawExamples) {
                const pos = (example.pos || 'unknown').toLowerCase().trim();
                
                if (!posGroups.has(pos)) {
                    posGroups.set(pos, []);
                }
                posGroups.get(pos).push(example);
            }
            
            // 각 pos 그룹에서 가장 좋은 example 선택
            const uniqueExamples = [];
            for (const [pos, examples] of posGroups.entries()) {
                if (examples.length === 1) {
                    uniqueExamples.push(examples[0]);
                } else {
                    // 같은 pos를 가진 여러 examples 중에서 최고 선택
                    const best = examples.reduce((prev, current) => {
                        // 1. 더 많은 example sentences를 가진 것 우선
                        const prevExampleCount = prev.definitions?.[0]?.examples?.length || 0;
                        const currentExampleCount = current.definitions?.[0]?.examples?.length || 0;
                        
                        if (currentExampleCount > prevExampleCount) {
                            return current;
                        } else if (prevExampleCount > currentExampleCount) {
                            return prev;
                        }
                        
                        // 2. 같은 example 개수면 더 긴 ko_def를 가진 것 우선
                        const prevKoDef = prev.definitions?.[0]?.ko_def || '';
                        const currentKoDef = current.definitions?.[0]?.ko_def || '';
                        
                        if (currentKoDef.length > prevKoDef.length) {
                            return current;
                        } else if (prevKoDef.length > currentKoDef.length) {
                            return prev;
                        }
                        
                        // 3. 같으면 더 긴 영어 정의를 가진 것 우선
                        const prevDef = prev.definitions?.[0]?.def || '';
                        const currentDef = current.definitions?.[0]?.def || '';
                        
                        return currentDef.length > prevDef.length ? current : prev;
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
                
                console.log(`✨ Advanced cleaned vocabId ${entry.vocabId}: ${rawExamples.length} → ${uniqueExamples.length} examples`);
                cleanedCount++;
                
                // Meeting 단어인 경우 상세 정보 출력
                if (entry.vocabId === 506) {
                    console.log('📝 Meeting 단어 정리 완료:');
                    console.log(JSON.stringify(uniqueExamples, null, 2));
                }
            } else {
                skippedCount++;
            }
        }
        
        console.log(`✅ Advanced cleaning completed!`);
        console.log(`   - Cleaned: ${cleanedCount} entries`);
        console.log(`   - Skipped: ${skippedCount} entries`);
        
    } catch (error) {
        console.error('❌ Error during advanced cleaning:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// 직접 실행된 경우
if (require.main === module) {
    advancedCleanExamples();
}

module.exports = advancedCleanExamples;