// clean_reset.js
// 전역 SRS 관리를 위해 데이터를 정리하고 재시작하는 스크립트

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanReset() {
    console.log('Starting clean reset for global SRS management...');
    
    try {
        // 1. SRS 카드와 폴더 아이템을 모두 삭제 (오답노트는 유지)
        console.log('Clearing SRS cards and folder items...');
        
        await prisma.srsfolderitem.deleteMany({});
        console.log('Deleted all SRS folder items');
        
        await prisma.srscard.deleteMany({});
        console.log('Deleted all SRS cards');
        
        // 2. 오답노트에서 folderId 제거를 위해 임시로 업데이트 (수동 SQL 필요)
        console.log('Clean reset completed! You can now safely apply schema changes.');
        
    } catch (error) {
        console.error('Clean reset failed:', error);
        throw error;
    }
}

async function main() {
    try {
        await cleanReset();
        console.log('Clean reset completed successfully!');
        console.log('Now run: npx prisma db push --accept-data-loss');
    } catch (error) {
        console.error('Clean reset failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    main();
}

module.exports = { cleanReset };