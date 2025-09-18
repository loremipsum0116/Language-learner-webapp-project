const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkWrongAnswers() {
    try {
        console.log('🔍 Checking wronganswer table...\n');

        // Count total wrong answers
        const totalCount = await prisma.wronganswer.count();
        console.log(`📊 Total entries in wronganswer table: ${totalCount}`);

        // Count by itemType
        const readingCount = await prisma.wronganswer.count({
            where: { itemType: 'reading' }
        });
        const japaneseReadingCount = await prisma.wronganswer.count({
            where: { itemType: 'japanese-reading' }
        });

        console.log(`📖 English reading entries: ${readingCount}`);
        console.log(`🇯🇵 Japanese reading entries: ${japaneseReadingCount}`);

        // Get recent Japanese reading entries
        console.log('\n📝 Recent Japanese reading entries:');
        const recentJapanese = await prisma.wronganswer.findMany({
            where: { itemType: 'japanese-reading' },
            take: 5,
            orderBy: { wrongAt: 'desc' }
        });

        if (recentJapanese.length === 0) {
            console.log('❌ No Japanese reading entries found!');
        } else {
            recentJapanese.forEach((entry, index) => {
                console.log(`\n[${index + 1}] ID: ${entry.id}`);
                console.log(`   User: ${entry.userId}`);
                console.log(`   ItemId: ${entry.itemId}`);
                console.log(`   QuestionId: ${entry.wrongData?.questionId}`);
                console.log(`   Attempts: ${entry.attempts}`);
                console.log(`   Created: ${entry.wrongAt}`);
                console.log(`   Last Result: ${entry.wrongData?.lastResult}`);
            });
        }

        // Get recent English reading entries for comparison
        console.log('\n📝 Recent English reading entries:');
        const recentEnglish = await prisma.wronganswer.findMany({
            where: { itemType: 'reading' },
            take: 5,
            orderBy: { wrongAt: 'desc' }
        });

        if (recentEnglish.length === 0) {
            console.log('❌ No English reading entries found!');
        } else {
            recentEnglish.forEach((entry, index) => {
                console.log(`\n[${index + 1}] ID: ${entry.id}`);
                console.log(`   User: ${entry.userId}`);
                console.log(`   ItemId: ${entry.itemId}`);
                console.log(`   QuestionId: ${entry.wrongData?.questionId}`);
                console.log(`   Attempts: ${entry.attempts}`);
                console.log(`   Created: ${entry.wrongAt}`);
                console.log(`   Last Result: ${entry.wrongData?.lastResult}`);
            });
        }

        // Check reading table for japanese entries
        console.log('\n📚 Checking reading table for Japanese entries:');
        const japaneseInReading = await prisma.reading.count({
            where: {
                glosses: {
                    path: '$.language',
                    equals: 'japanese'
                }
            }
        });
        console.log(`Japanese entries in reading table: ${japaneseInReading}`);

        // Check reading table for english entries
        const englishInReading = await prisma.reading.count({
            where: {
                OR: [
                    {
                        glosses: {
                            path: '$.language',
                            equals: 'english'
                        }
                    },
                    {
                        glosses: {
                            path: '$.language',
                            equals: null
                        }
                    }
                ]
            }
        });
        console.log(`English entries in reading table: ${englishInReading}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkWrongAnswers();