const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupOrphanWrongAnswers() {
    try {
        console.log('=== 고아 오답노트 정리 시작 ===');

        // 삭제 전 현재 상태 확인
        const totalBefore = await prisma.wronganswer.count();
        const orphanCount = await prisma.wronganswer.count({
            where: { folderId: null }
        });

        console.log(`삭제 전 상태:`);
        console.log(`- 전체 오답노트: ${totalBefore}개`);
        console.log(`- 고아 오답노트 (folderId: null): ${orphanCount}개`);

        if (orphanCount === 0) {
            console.log('삭제할 고아 오답노트가 없습니다.');
            return;
        }

        // 고아 오답노트 삭제
        const deleted = await prisma.wronganswer.deleteMany({
            where: { folderId: null }
        });

        // 삭제 후 상태 확인
        const totalAfter = await prisma.wronganswer.count();

        console.log(`\n삭제 완료:`);
        console.log(`- 삭제된 고아 오답노트: ${deleted.count}개`);
        console.log(`- 삭제 후 전체 오답노트: ${totalAfter}개`);
        console.log(`- 정리 완료!`);

    } catch (error) {
        console.error('고아 오답노트 정리 실패:', error);
    } finally {
        await prisma.$disconnect();
    }
}

cleanupOrphanWrongAnswers();