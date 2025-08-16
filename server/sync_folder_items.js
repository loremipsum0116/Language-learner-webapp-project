// sync_folder_items.js
// 전역 SRS 카드 상태와 폴더 아이템 상태를 동기화하는 스크립트

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function syncFolderItems() {
    console.log('Starting folder items synchronization...');
    
    try {
        // 모든 SRS 카드와 관련 폴더 아이템들 조회
        const srsCards = await prisma.srscard.findMany({
            include: {
                srsfolderitem: true
            }
        });
        
        console.log(`Found ${srsCards.length} SRS cards to sync`);
        
        let syncedCount = 0;
        
        for (const card of srsCards) {
            if (card.srsfolderitem.length === 0) continue;
            
            // SRS 카드의 상태에 따라 learned 상태 결정
            let shouldBeLearned = false;
            
            // 정답을 맞춘 적이 있고, 오답 대기 상태가 아니면 학습 완료로 간주
            if (card.correctTotal > 0 && !card.isFromWrongAnswer) {
                shouldBeLearned = true;
            }
            
            // 오답 단어이거나 아직 정답을 맞춘 적이 없으면 미학습 상태
            if (card.isFromWrongAnswer || card.correctTotal === 0) {
                shouldBeLearned = false;
            }
            
            // 마스터된 단어는 학습 완료
            if (card.isMastered) {
                shouldBeLearned = true;
            }
            
            console.log(`Card ${card.id} (vocabId: ${card.itemId}): shouldBeLearned=${shouldBeLearned}, correctTotal=${card.correctTotal}, isFromWrongAnswer=${card.isFromWrongAnswer}, isMastered=${card.isMastered}`);
            
            // 모든 관련 폴더 아이템들의 learned 상태를 동기화
            const updateResult = await prisma.srsfolderitem.updateMany({
                where: { cardId: card.id },
                data: {
                    learned: shouldBeLearned,
                    wrongCount: card.wrongTotal || 0
                }
            });
            
            if (updateResult.count > 0) {
                console.log(`  → Updated ${updateResult.count} folder items`);
                syncedCount += updateResult.count;
            }
        }
        
        console.log(`\nSynchronization completed! Updated ${syncedCount} folder items total.`);
        
    } catch (error) {
        console.error('Synchronization failed:', error);
        throw error;
    }
}

async function main() {
    try {
        await syncFolderItems();
        console.log('✅ Folder items synchronization completed successfully!');
    } catch (error) {
        console.error('❌ Synchronization failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    main();
}

module.exports = { syncFolderItems };