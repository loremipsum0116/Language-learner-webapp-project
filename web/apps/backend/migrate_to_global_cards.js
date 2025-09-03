// migrate_to_global_cards.js
// 폴더별 독립 SRS 카드들을 전역 카드로 통합하는 마이그레이션 스크립트

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateToGlobalCards() {
    console.log('Starting migration to global SRS cards...');
    
    try {
        await prisma.$transaction(async (tx) => {
            // 1. 현재 모든 SRS 카드 조회
            const allCards = await tx.srscard.findMany({
                orderBy: [
                    { userId: 'asc' },
                    { itemType: 'asc' },
                    { itemId: 'asc' },
                    { id: 'asc' } // 가장 오래된 카드를 우선으로 (ID 기준)
                ]
            });
            
            console.log(`Found ${allCards.length} SRS cards to migrate`);
            
            // 2. 사용자별, 아이템별로 그룹화
            const cardGroups = new Map();
            
            for (const card of allCards) {
                const key = `${card.userId}_${card.itemType}_${card.itemId}`;
                if (!cardGroups.has(key)) {
                    cardGroups.set(key, []);
                }
                cardGroups.get(key).push(card);
            }
            
            console.log(`Found ${cardGroups.size} unique card groups to consolidate`);
            
            // 3. 각 그룹에서 대표 카드 선택 및 통합
            let consolidatedCount = 0;
            let deletedCount = 0;
            
            for (const [key, cards] of cardGroups) {
                if (cards.length === 1) {
                    // 이미 유일한 카드면 folderId만 null로 설정
                    await tx.srscard.update({
                        where: { id: cards[0].id },
                        data: { folderId: null }
                    });
                    continue;
                }
                
                // 여러 카드가 있는 경우 통합
                console.log(`Consolidating ${cards.length} cards for ${key}`);
                
                // 대표 카드 선택 (가장 진행된 카드 또는 가장 오래된 카드)
                const masterCard = cards.reduce((best, current) => {
                    // 마스터된 카드가 있으면 우선
                    if (current.isMastered && !best.isMastered) return current;
                    if (best.isMastered && !current.isMastered) return best;
                    
                    // Stage가 높은 카드 우선
                    if (current.stage > best.stage) return current;
                    if (best.stage > current.stage) return best;
                    
                    // 정답 횟수가 많은 카드 우선
                    if (current.correctTotal > best.correctTotal) return current;
                    if (best.correctTotal > current.correctTotal) return best;
                    
                    // 가장 오래된 카드 우선
                    return best;
                });
                
                // 다른 카드들의 통계를 대표 카드에 합산
                const totalCorrect = cards.reduce((sum, card) => sum + card.correctTotal, 0);
                const totalWrong = cards.reduce((sum, card) => sum + card.wrongTotal, 0);
                const maxStage = Math.max(...cards.map(card => card.stage));
                const hasWrongAnswer = cards.some(card => card.isFromWrongAnswer);
                const hasMastered = cards.some(card => card.isMastered);
                const maxMasterCycles = Math.max(...cards.map(card => card.masterCycles));
                
                // 대표 카드 업데이트
                await tx.srscard.update({
                    where: { id: masterCard.id },
                    data: {
                        folderId: null, // 전역 카드로 설정
                        stage: maxStage,
                        correctTotal: totalCorrect,
                        wrongTotal: totalWrong,
                        isFromWrongAnswer: hasWrongAnswer,
                        isMastered: hasMastered,
                        masterCycles: maxMasterCycles
                    }
                });
                
                // 다른 카드들의 srsfolderitem 연결을 대표 카드로 이전
                const otherCards = cards.filter(card => card.id !== masterCard.id);
                
                for (const card of otherCards) {
                    // srsfolderitem들을 대표 카드로 이전
                    await tx.srsfolderitem.updateMany({
                        where: { cardId: card.id },
                        data: { cardId: masterCard.id }
                    });
                    
                    // 중복 srsfolderitem 제거
                    const duplicates = await tx.srsfolderitem.groupBy({
                        by: ['folderId', 'cardId'],
                        where: { cardId: masterCard.id },
                        having: {
                            cardId: { _count: { gt: 1 } }
                        }
                    });
                    
                    for (const dup of duplicates) {
                        const items = await tx.srsfolderitem.findMany({
                            where: { folderId: dup.folderId, cardId: dup.cardId },
                            orderBy: { id: 'desc' }
                        });
                        
                        // 첫 번째를 제외하고 나머지 삭제
                        if (items.length > 1) {
                            await tx.srsfolderitem.deleteMany({
                                where: {
                                    id: { in: items.slice(1).map(item => item.id) }
                                }
                            });
                        }
                    }
                    
                    // 기존 카드 삭제
                    await tx.srscard.delete({ where: { id: card.id } });
                    deletedCount++;
                }
                
                consolidatedCount++;
            }
            
            console.log(`Migration completed: ${consolidatedCount} card groups consolidated, ${deletedCount} duplicate cards removed`);
        });
        
    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    }
}

async function main() {
    try {
        await migrateToGlobalCards();
        console.log('Migration to global SRS cards completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    main();
}

module.exports = { migrateToGlobalCards };