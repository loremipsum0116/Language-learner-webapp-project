// seed-basic-data.js
// Setup basic language and exam category data

const { prisma } = require('./lib/prismaClient');

async function seedBasicData() {
    console.log('🌱 Setting up basic data...');

    try {
        // 1. Create Languages
        const english = await prisma.language.upsert({
            where: { code: 'en' },
            update: {},
            create: {
                name: 'English',
                code: 'en',
                nativeName: 'English',
                isActive: true
            }
        });
        console.log('✅ English language created:', english.id);

        // 2. Create Exam Categories
        const examCategories = [
            { name: 'TOEFL', description: 'Test of English as a Foreign Language' },
            { name: 'TOEIC', description: 'Test of English for International Communication' },
            { name: '수능', description: '대학수학능력시험' },
            { name: 'IELTS-A', description: 'International English Language Testing System Academic' }
        ];

        for (const category of examCategories) {
            const created = await prisma.examcategory.upsert({
                where: { name: category.name },
                update: {},
                create: category
            });
            console.log(`✅ Exam category created: ${category.name} (${created.id})`);
        }

        // 3. Create a test user (optional)
        const testUser = await prisma.user.upsert({
            where: { email: 'test@example.com' },
            update: {},
            create: {
                email: 'test@example.com',
                passwordHash: '$2b$10$test.hash.for.development.only',
                role: 'USER'
            }
        });
        console.log('✅ Test user created:', testUser.id);

        console.log('🎉 Basic data setup completed!');
        return { english, testUser };
    } catch (error) {
        console.error('❌ Error seeding basic data:', error);
        throw error;
    }
}

if (require.main === module) {
    seedBasicData()
        .then(() => {
            console.log('✅ Basic data seeding finished');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Basic data seeding failed:', error);
            process.exit(1);
        });
}

module.exports = { seedBasicData };