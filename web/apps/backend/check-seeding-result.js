// server/check-seeding-result.js
// 시딩 결과 확인 스크립트

const { prisma } = require('./lib/prismaClient');

async function checkSeedingResults() {
    try {
        console.log('🔍 Checking seeding results...\n');
        
        // 1. 시험 카테고리별 단어 수 확인
        console.log('📚 Exam Categories:');
        const examCategories = await prisma.examcategory.findMany({
            include: {
                vocabexamcategory: {
                    include: {
                        vocab: true
                    }
                }
            }
        });
        
        examCategories.forEach(category => {
            console.log(`   ${category.name}: ${category.totalWords} words (actual: ${category.vocabexamcategory.length})`);
        });
        
        console.log('\n📊 CEFR Level Distribution:');
        const cefrStats = await prisma.vocab.groupBy({
            by: ['levelCEFR'],
            _count: {
                id: true
            },
            orderBy: {
                levelCEFR: 'asc'
            }
        });
        
        cefrStats.forEach(stat => {
            console.log(`   ${stat.levelCEFR}: ${stat._count.id} words`);
        });
        
        // 2. 샘플 데이터 확인
        console.log('\n🔍 Sample vocabs with exam categories:');
        const sampleVocabs = await prisma.vocab.findMany({
            take: 5,
            include: {
                vocabexamcategory: {
                    include: {
                        examCategory: true
                    }
                },
                dictentry: true
            }
        });
        
        sampleVocabs.forEach(vocab => {
            const examCats = vocab.vocabexamcategory.map(vec => vec.examCategory.name).join(', ');
            console.log(`   ${vocab.lemma} (${vocab.levelCEFR}): ${examCats || 'No exam categories'}`);
        });
        
        // 3. 카테고리별 실제 단어 일부 조회
        console.log('\n📋 Words by exam category:');
        for (const category of examCategories.slice(0, 2)) { // 처음 2개만
            const words = await prisma.vocab.findMany({
                where: {
                    vocabexamcategory: {
                        some: {
                            examCategoryId: category.id
                        }
                    }
                },
                take: 5,
                select: {
                    lemma: true,
                    levelCEFR: true
                }
            });
            
            console.log(`   ${category.name}: ${words.map(w => `${w.lemma}(${w.levelCEFR})`).join(', ')}...`);
        }
        
        // 4. JSON에서 categories 필드 분석
        console.log('\n🔍 Analyzing categories from JSON...');
        const fs = require('fs');
        const cefrVocabs = JSON.parse(fs.readFileSync('./cefr_vocabs.json', 'utf8'));
        
        const categoryAnalysis = {};
        cefrVocabs.slice(0, 100).forEach(vocab => { // 처음 100개만 분석
            if (vocab.categories) {
                const cats = vocab.categories.split(',').map(c => c.trim());
                cats.forEach(cat => {
                    if (!categoryAnalysis[cat]) categoryAnalysis[cat] = 0;
                    categoryAnalysis[cat]++;
                });
            }
        });
        
        console.log('   Found categories in first 100 items:');
        Object.entries(categoryAnalysis).forEach(([cat, count]) => {
            console.log(`   - "${cat}": ${count} times`);
        });
        
    } catch (error) {
        console.error('❌ Error checking results:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkSeedingResults();