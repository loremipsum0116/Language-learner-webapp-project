// 단어장 디버깅 스크립트
const { prisma } = require('./lib/prismaClient');

async function debugWordbook() {
    try {
        console.log('🔍 사용자 단어장 상태 확인...');
        
        // 전체 SRS 카드 현황
        const totalCards = await prisma.srscard.count();
        console.log(`📊 전체 SRS 카드 수: ${totalCards}`);
        
        // 타입별 카드 수
        const vocabCards = await prisma.srscard.count({
            where: { itemType: 'vocab' }
        });
        const idiomCards = await prisma.srscard.count({
            where: { itemType: 'idiom' }
        });
        console.log(`📊 단어 카드: ${vocabCards}개, 숙어 카드: ${idiomCards}개`);
        
        // 숙어 카드들 확인 (상위 10개)
        const recentIdiomCards = await prisma.srscard.findMany({
            where: { itemType: 'idiom' },
            orderBy: { id: 'desc' },
            take: 10,
            select: {
                id: true,
                itemId: true,
                userId: true,
                folderId: true,
                stage: true
            }
        });
        
        console.log('\n📋 최근 추가된 숙어 카드:');
        for (const card of recentIdiomCards) {
            // 해당 숙어 정보 조회
            const idiom = await prisma.idiom.findUnique({
                where: { id: card.itemId },
                select: { idiom: true, korean_meaning: true, category: true }
            });
            
            console.log(`   - ID: ${card.itemId}, 카드: ${card.id}`);
            console.log(`     숙어: "${idiom?.idiom || 'NOT FOUND'}"`);
            console.log(`     의미: "${idiom?.korean_meaning || 'NOT FOUND'}"`);
            console.log(`     카테고리: "${idiom?.category || 'NOT FOUND'}"`);
            console.log(`     폴더: ${card.folderId || 'None'}`);
            console.log(`     스테이지: ${card.stage}`);
            console.log('');
        }
        
        // 존재하지 않는 숙어 ID를 참조하는 카드들 확인
        const orphanCards = await prisma.srscard.findMany({
            where: {
                itemType: 'idiom',
                NOT: {
                    itemId: {
                        in: (await prisma.idiom.findMany({ select: { id: true } }))
                            .map(idiom => idiom.id)
                    }
                }
            },
            select: {
                id: true,
                itemId: true,
                userId: true,
                stage: true
            }
        });
        
        if (orphanCards.length > 0) {
            console.log('⚠️ 존재하지 않는 숙어를 참조하는 카드들:');
            orphanCards.forEach(card => {
                console.log(`   - 카드 ID: ${card.id}, 참조 숙어 ID: ${card.itemId}`);
            });
        } else {
            console.log('✅ 모든 숙어 카드가 올바른 숙어를 참조하고 있습니다.');
        }
        
    } catch (error) {
        console.error('❌ 디버깅 실패:', error);
    } finally {
        await prisma.$disconnect();
    }
}

debugWordbook();