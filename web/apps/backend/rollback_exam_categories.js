// server/rollback_exam_categories.js
// 시험 카테고리와 단어 매핑을 모두 제거하여 이전 상태로 되돌리기

const { prisma } = require('./lib/prismaClient');

async function rollbackExamCategories() {
    try {
        console.log('🔄 Rolling back exam categories and mappings...');
        
        // 1. 모든 vocab-exam 매핑 삭제
        console.log('🗑️  Deleting all vocab-exam category mappings...');
        const deletedMappings = await prisma.vocabexamcategory.deleteMany({});
        console.log(`✅ Deleted ${deletedMappings.count} vocab-exam mappings`);
        
        // 2. 모든 시험 카테고리 삭제
        console.log('🗑️  Deleting all exam categories...');
        const deletedCategories = await prisma.examcategory.deleteMany({});
        console.log(`✅ Deleted ${deletedCategories.count} exam categories`);
        
        // 3. 확인
        const remainingCategories = await prisma.examcategory.count();
        const remainingMappings = await prisma.vocabexamcategory.count();
        
        console.log(`\n📊 Final state:`);
        console.log(`   Remaining categories: ${remainingCategories}`);
        console.log(`   Remaining mappings: ${remainingMappings}`);
        
        if (remainingCategories === 0 && remainingMappings === 0) {
            console.log('\n🎉 Successfully rolled back to previous state!');
            console.log('📝 The vocab page will now show: "시험 카테고리가 설정되지 않았습니다. CEFR 레벨별 단어를 이용해주세요."');
        } else {
            console.log('\n⚠️  Rollback may not be complete. Some data may remain.');
        }
        
    } catch (error) {
        console.error('❌ Error during rollback:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// 직접 실행된 경우
if (require.main === module) {
    rollbackExamCategories();
}

module.exports = rollbackExamCategories;