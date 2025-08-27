// server/update-category-names.js
// 카테고리 이름 변경: SUNEUNG -> 수능, IELTS -> IELTS-A

const { prisma } = require('./lib/prismaClient');

async function updateCategoryNames() {
    try {
        console.log('🔄 Updating category names...\n');
        
        // 1. SUNEUNG -> 수능
        const suneungResult = await prisma.examcategory.updateMany({
            where: { name: 'SUNEUNG' },
            data: { name: '수능' }
        });
        
        if (suneungResult.count > 0) {
            console.log('✅ Updated SUNEUNG to 수능');
        } else {
            console.log('⚠️  SUNEUNG category not found');
        }
        
        // 2. IELTS -> IELTS-A
        const ieltsResult = await prisma.examcategory.updateMany({
            where: { name: 'IELTS' },
            data: { name: 'IELTS-A' }
        });
        
        if (ieltsResult.count > 0) {
            console.log('✅ Updated IELTS to IELTS-A');
        } else {
            console.log('⚠️  IELTS category not found');
        }
        
        // 3. 결과 확인
        console.log('\n📊 Updated categories:');
        const categories = await prisma.examcategory.findMany({
            orderBy: { id: 'asc' }
        });
        
        categories.forEach(cat => {
            console.log(`   ${cat.id}. ${cat.name}: ${cat.description} (${cat.totalWords} words)`);
        });
        
        console.log('\n🎉 Category names updated successfully!');
        
    } catch (error) {
        console.error('❌ Error updating category names:', error);
    } finally {
        await prisma.$disconnect();
    }
}

updateCategoryNames();