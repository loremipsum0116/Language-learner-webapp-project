const { prisma } = require('./server/lib/prismaClient');

async function directFix() {
    try {
        console.log('🔧 Starting direct fix for 47h → 24h timer...');
        
        // 현재 시간 (24시간 후로 설정)
        const now = new Date();
        const fixedDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        
        console.log(`Current time: ${now.toISOString()}`);
        console.log(`Fixed deadline: ${fixedDeadline.toISOString()}`);
        
        // 모든 overdue 카드를 강제로 24시간으로 설정
        const result = await prisma.sRSCard.updateMany({
            where: { isOverdue: true },
            data: { 
                overdueDeadline: fixedDeadline,
                overdueStartAt: now
            }
        });
        
        console.log(`✅ SUCCESS: Updated ${result.count} overdue cards to exactly 24 hours`);
        
        // 수정된 카드들 확인
        const updatedCards = await prisma.sRSCard.findMany({
            where: { isOverdue: true },
            select: { 
                id: true, 
                overdueDeadline: true, 
                overdueStartAt: true 
            }
        });
        
        console.log(`\n📊 Verification: Found ${updatedCards.length} overdue cards after fix`);
        updatedCards.slice(0, 3).forEach((card, index) => {
            const hoursLeft = Math.round((card.overdueDeadline.getTime() - now.getTime()) / (60 * 60 * 1000));
            console.log(`  Card ${index + 1}: ${hoursLeft} hours left`);
        });
        
        console.log('\n🎉 Direct fix completed successfully!');
        console.log('Please refresh your browser to see the updated timers.');
        
    } catch (error) {
        console.error('❌ Direct fix failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

directFix();