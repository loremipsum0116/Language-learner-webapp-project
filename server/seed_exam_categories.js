// server/seed_exam_categories.js
// 시험별 카테고리 데이터를 데이터베이스에 시딩

const { prisma } = require('./lib/prismaClient');

// 시험 카테고리 정의
const examCategories = [
    {
        name: 'TOEFL',
        description: 'Test of English as a Foreign Language - 북미 대학 진학용 영어 시험',
        totalWords: 0
    },
    {
        name: 'IELTS',
        description: 'International English Language Testing System - 국제 영어 능력 평가 시험',
        totalWords: 0
    },
    {
        name: 'TOEIC',
        description: 'Test of English for International Communication - 국제 의사소통 영어 능력 시험',
        totalWords: 0
    },
    {
        name: 'SAT',
        description: 'Scholastic Assessment Test - 미국 대학 입학 시험',
        totalWords: 0
    },
    {
        name: 'GRE',
        description: 'Graduate Record Examinations - 대학원 입학 시험',
        totalWords: 0
    },
    {
        name: 'Academic',
        description: '학술 영어 - 대학교 및 학술 연구를 위한 필수 단어',
        totalWords: 0
    },
    {
        name: 'Business',
        description: '비즈니스 영어 - 업무 및 비즈니스 상황에서 사용되는 필수 단어',
        totalWords: 0
    },
    {
        name: 'Daily',
        description: '일상 영어 - 일상생활에서 자주 사용되는 기본 단어',
        totalWords: 0
    }
];

async function seedExamCategories() {
    try {
        console.log('🌱 Starting to seed exam categories...');
        
        // 기존 카테고리 확인
        const existingCategories = await prisma.examcategory.findMany();
        console.log(`📊 Current categories in database: ${existingCategories.length}`);
        
        if (existingCategories.length > 0) {
            console.log('📋 Existing categories:');
            existingCategories.forEach(cat => {
                console.log(`   - ${cat.name}: ${cat.description} (${cat.totalWords} words)`);
            });
        }
        
        let createdCount = 0;
        let skippedCount = 0;
        
        // 각 카테고리 생성 또는 업데이트
        for (const categoryData of examCategories) {
            try {
                const existing = await prisma.examcategory.findUnique({
                    where: { name: categoryData.name }
                });
                
                if (existing) {
                    console.log(`⚠️  Category '${categoryData.name}' already exists, skipping...`);
                    skippedCount++;
                } else {
                    await prisma.examcategory.create({
                        data: categoryData
                    });
                    console.log(`✅ Created category: ${categoryData.name}`);
                    createdCount++;
                }
            } catch (error) {
                console.error(`❌ Failed to create category '${categoryData.name}':`, error.message);
            }
        }
        
        // 최종 결과 확인
        const finalCategories = await prisma.examcategory.findMany({
            orderBy: { name: 'asc' }
        });
        
        console.log(`\n📈 Seeding Summary:`);
        console.log(`   Created: ${createdCount} categories`);
        console.log(`   Skipped: ${skippedCount} categories`);
        console.log(`   Total in database: ${finalCategories.length} categories`);
        
        console.log(`\n📚 All categories in database:`);
        finalCategories.forEach(cat => {
            console.log(`   ${cat.id}. ${cat.name}: ${cat.description}`);
        });
        
        console.log('\n🎉 Exam categories seeding completed!');
        
    } catch (error) {
        console.error('❌ Error during exam categories seeding:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// 직접 실행된 경우
if (require.main === module) {
    seedExamCategories();
}

module.exports = seedExamCategories;