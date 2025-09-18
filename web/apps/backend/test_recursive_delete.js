const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testRecursiveDelete() {
    const userId = 1;
    const rootFolderId = 75; // TEST_ROOT 폴더 ID

    console.log('🧪 [TEST] Starting recursive deletion test...');

    // 재귀적으로 모든 하위폴더 ID 수집 함수
    const getAllDescendantFolderIds = async (folderId, tx) => {
        const children = await tx.srsfolder.findMany({
            where: { parentId: folderId, userId },
            select: { id: true }
        });

        let allIds = [folderId];
        for (const child of children) {
            const descendantIds = await getAllDescendantFolderIds(child.id, tx);
            allIds = allIds.concat(descendantIds);
        }
        return allIds;
    };

    try {
        const result = await prisma.$transaction(async (tx) => {
            // 삭제 전 폴더 구조 확인
            const beforeFolders = await tx.srsfolder.findMany({
                where: { userId },
                select: { id: true, name: true, parentId: true }
            });
            console.log('📁 [TEST] Folders before deletion:', beforeFolders);

            // 재귀적으로 삭제할 모든 폴더 ID 수집
            const allFolderIds = await getAllDescendantFolderIds(rootFolderId, tx);
            console.log('🎯 [TEST] Folders to delete:', allFolderIds);

            // 하위폴더부터 역순으로 삭제
            const sortedFolderIds = allFolderIds.reverse();
            let deletedCount = 0;

            for (const folderId of sortedFolderIds) {
                await tx.srsfolder.delete({ where: { id: folderId } });
                deletedCount++;
                console.log(`✓ [TEST] Deleted folder ${folderId}`);
            }

            // 삭제 후 상태 확인
            const afterFolders = await tx.srsfolder.findMany({
                where: { userId },
                select: { id: true, name: true, parentId: true }
            });
            console.log('📁 [TEST] Folders after deletion:', afterFolders);

            return { deletedCount, beforeCount: beforeFolders.length, afterCount: afterFolders.length };
        });

        console.log('✅ [TEST] Recursive deletion test completed successfully:', result);
    } catch (error) {
        console.error('❌ [TEST] Recursive deletion test failed:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

testRecursiveDelete();