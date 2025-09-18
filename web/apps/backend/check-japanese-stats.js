const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkJapaneseReadingStats() {
    try {
        console.log('🔍 Checking Japanese reading statistics...\n');

        // Get Japanese reading wrong answers with detailed info
        const japaneseRecords = await prisma.wronganswer.findMany({
            where: { itemType: 'japanese-reading' },
            orderBy: { wrongAt: 'desc' }
        });

        console.log(`📊 Found ${japaneseRecords.length} Japanese reading records\n`);

        japaneseRecords.forEach((record, index) => {
            console.log(`[${index + 1}] Record ID: ${record.id}`);
            console.log(`   User: ${record.userId}`);
            console.log(`   ItemId: ${record.itemId}`);
            console.log(`   Attempts: ${record.attempts}`);
            console.log(`   Completed: ${record.isCompleted}`);
            console.log(`   QuestionId: ${record.wrongData?.questionId}`);
            console.log(`   Level: ${record.wrongData?.level}`);
            console.log(`   IsCorrect: ${record.wrongData?.isCorrect}`);
            console.log(`   CorrectCount: ${record.wrongData?.correctCount}`);
            console.log(`   IncorrectCount: ${record.wrongData?.incorrectCount}`);
            console.log(`   TotalAttempts: ${record.wrongData?.totalAttempts}`);
            console.log(`   LastResult: ${record.wrongData?.lastResult}`);
            console.log(`   Created: ${record.wrongAt}`);
            console.log('');
        });

        // Compare with English reading records
        console.log('\n📖 Comparing with English reading records...\n');

        const englishRecords = await prisma.wronganswer.findMany({
            where: { itemType: 'reading' },
            take: 3,
            orderBy: { wrongAt: 'desc' }
        });

        englishRecords.forEach((record, index) => {
            console.log(`[English ${index + 1}] Record ID: ${record.id}`);
            console.log(`   User: ${record.userId}`);
            console.log(`   ItemId: ${record.itemId}`);
            console.log(`   Attempts: ${record.attempts}`);
            console.log(`   Completed: ${record.isCompleted}`);
            console.log(`   QuestionId: ${record.wrongData?.questionId}`);
            console.log(`   Level: ${record.wrongData?.level}`);
            console.log(`   IsCorrect: ${record.wrongData?.isCorrect}`);
            console.log(`   CorrectCount: ${record.wrongData?.correctCount}`);
            console.log(`   IncorrectCount: ${record.wrongData?.incorrectCount}`);
            console.log(`   TotalAttempts: ${record.wrongData?.totalAttempts}`);
            console.log(`   LastResult: ${record.wrongData?.lastResult}`);
            console.log(`   Created: ${record.wrongAt}`);
            console.log('');
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkJapaneseReadingStats();