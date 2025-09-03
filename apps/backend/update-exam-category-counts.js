// server/update-exam-category-counts.js
// JSON 파일의 원본 개수로 시험 카테고리 totalWords 업데이트

const { prisma } = require('./lib/prismaClient');
const fs = require('fs');

async function updateExamCategoryCountsFromJson() {
    try {
        console.log('🔍 Updating exam category counts from JSON...\n');
        
        // cefr_vocabs.json 로드
        const cefrVocabs = JSON.parse(fs.readFileSync('./cefr_vocabs.json', 'utf8'));
        
        // 시험별 카테고리 원본 개수 계산
        const examCounts = {
            'TOEFL': 0,
            'TOEIC': 0,
            '수능': 0,  // 수능
            'IELTS-A': 0
        };
        
        cefrVocabs.forEach(vocab => {
            if (vocab.categories) {
                const categories = vocab.categories.split(',').map(cat => cat.trim());
                
                // TOEFL 카운트
                if (categories.includes('TOEFL')) {
                    examCounts.TOEFL++;
                }
                
                // TOEIC 카운트
                if (categories.includes('TOEIC')) {
                    examCounts.TOEIC++;
                }
                
                // 수능 카운트
                if (categories.includes('수능')) {
                    examCounts['수능']++;
                }
                
                // IELTS 카운트 (IELTS-A, IELTS-B, IELTS-C 모두 포함)
                if (categories.some(cat => cat.startsWith('IELTS'))) {
                    examCounts['IELTS-A']++;
                }
            }
        });
        
        console.log('📊 JSON file counts:');
        Object.entries(examCounts).forEach(([exam, count]) => {
            console.log(`   ${exam}: ${count} words`);
        });
        
        // 데이터베이스 업데이트
        console.log('\n🔄 Updating database...');
        
        for (const [examName, count] of Object.entries(examCounts)) {
            const result = await prisma.examcategory.updateMany({
                where: { name: examName },
                data: { totalWords: count }
            });
            
            if (result.count > 0) {
                console.log(`✅ Updated ${examName}: ${count} words`);
            } else {
                console.log(`⚠️  ${examName} category not found in database`);
            }
        }
        
        // 결과 확인
        console.log('\n📊 Updated categories:');
        const updatedCategories = await prisma.examcategory.findMany({
            orderBy: { name: 'asc' }
        });
        
        updatedCategories.forEach(cat => {
            console.log(`   ${cat.name}: ${cat.totalWords} words`);
        });
        
        console.log('\n🎉 Exam category counts updated successfully!');
        
    } catch (error) {
        console.error('❌ Error updating exam category counts:', error);
    } finally {
        await prisma.$disconnect();
    }
}

updateExamCategoryCountsFromJson();