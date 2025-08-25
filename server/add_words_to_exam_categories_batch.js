// server/add_words_to_exam_categories_batch.js
// 기존 vocab 테이블의 단어들을 시험 카테고리에 배치 방식으로 추가

const { prisma } = require('./lib/prismaClient');

// 레벨별로 시험 카테고리에 매핑하는 규칙
const levelToExamMapping = {
    'A1': ['Daily'],
    'A2': ['Daily', 'TOEIC'],
    'B1': ['Daily', 'TOEIC', 'IELTS'],
    'B2': ['TOEIC', 'IELTS', 'TOEFL', 'Academic'],
    'C1': ['IELTS', 'TOEFL', 'Academic', 'GRE', 'SAT']
};

// 특정 단어를 특정 시험에 매핑 (우선순위 높음)
const specificWordMappings = {
    // 비즈니스 관련 단어들
    'business': ['Business', 'TOEIC'],
    'company': ['Business', 'TOEIC'],
    'management': ['Business', 'Academic'],
    'finance': ['Business', 'Academic'],
    'marketing': ['Business'],
    'office': ['Business', 'Daily'],
    'meeting': ['Business', 'Daily'],
    'project': ['Business', 'Academic'],
    
    // 학술 관련 단어들
    'research': ['Academic', 'GRE'],
    'study': ['Academic', 'Daily'],
    'analysis': ['Academic', 'GRE'],
    'theory': ['Academic', 'GRE'],
    'science': ['Academic', 'GRE'],
    'university': ['Academic', 'IELTS'],
    'education': ['Academic', 'IELTS'],
    'student': ['Academic', 'Daily']
};

async function addWordsToExamCategoriesBatch() {
    try {
        console.log('🌱 Starting to add words to exam categories (batch processing)...');
        
        // 모든 카테고리 확인
        const categories = await prisma.examcategory.findMany();
        console.log(`📊 Found ${categories.length} exam categories`);
        
        if (categories.length === 0) {
            console.log('❌ No exam categories found. Please run seed_exam_categories.js first.');
            return;
        }
        
        // 카테고리 ID 매핑 생성
        const categoryMap = {};
        categories.forEach(cat => {
            categoryMap[cat.name] = cat.id;
        });
        
        console.log('📋 Category mapping:');
        Object.entries(categoryMap).forEach(([name, id]) => {
            console.log(`   ${name}: ${id}`);
        });
        
        // 모든 단어 조회
        const allWords = await prisma.vocab.findMany({
            where: {
                levelCEFR: {
                    in: ['A1', 'A2', 'B1', 'B2', 'C1']
                }
            }
        });
        
        console.log(`📚 Found ${allWords.length} words to process`);
        
        // 레벨별 통계
        const levelStats = {};
        allWords.forEach(word => {
            levelStats[word.levelCEFR] = (levelStats[word.levelCEFR] || 0) + 1;
        });
        
        console.log('📊 Words by level:');
        Object.entries(levelStats).forEach(([level, count]) => {
            console.log(`   ${level}: ${count} words`);
        });
        
        let processedCount = 0;
        let addedCount = 0;
        let skippedCount = 0;
        
        const batchSize = 100;
        const totalBatches = Math.ceil(allWords.length / batchSize);
        
        console.log(`🔄 Processing in ${totalBatches} batches of ${batchSize} words each...`);
        
        // 배치 처리
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const batchStart = batchIndex * batchSize;
            const batchEnd = Math.min(batchStart + batchSize, allWords.length);
            const batch = allWords.slice(batchStart, batchEnd);
            
            console.log(`📦 Processing batch ${batchIndex + 1}/${totalBatches} (${batchStart + 1}-${batchEnd})...`);
            
            // 각 배치를 트랜잭션으로 처리
            try {
                await prisma.$transaction(async (tx) => {
                    for (const word of batch) {
                        processedCount++;
                        
                        // 해당 단어가 매핑될 시험 카테고리 결정
                        let targetExams = [];
                        
                        // 1. 특정 단어 매핑 우선 확인
                        const lemmaLower = word.lemma.toLowerCase();
                        if (specificWordMappings[lemmaLower]) {
                            targetExams = specificWordMappings[lemmaLower];
                        } else {
                            // 2. 레벨별 매핑 사용
                            targetExams = levelToExamMapping[word.levelCEFR] || [];
                        }
                        
                        // 각 시험 카테고리에 단어 추가
                        for (const examName of targetExams) {
                            if (!categoryMap[examName]) {
                                console.warn(`⚠️  Category '${examName}' not found, skipping...`);
                                continue;
                            }
                            
                            const categoryId = categoryMap[examName];
                            
                            // 중복 체크
                            const existing = await tx.vocabexamcategory.findUnique({
                                where: {
                                    vocabId_examCategoryId: {
                                        vocabId: word.id,
                                        examCategoryId: categoryId
                                    }
                                }
                            });
                            
                            if (!existing) {
                                // 우선순위 계산 (C1이 가장 높음, A1이 가장 낮음)
                                const levelPriority = {
                                    'C1': 5,
                                    'B2': 4,
                                    'B1': 3,
                                    'A2': 2,
                                    'A1': 1
                                };
                                
                                const priority = levelPriority[word.levelCEFR] || 0;
                                
                                await tx.vocabexamcategory.create({
                                    data: {
                                        vocabId: word.id,
                                        examCategoryId: categoryId,
                                        priority: priority
                                    }
                                });
                                
                                addedCount++;
                            } else {
                                skippedCount++;
                            }
                        }
                    }
                }, {
                    timeout: 30000 // 30초 타임아웃
                });
                
                console.log(`✅ Batch ${batchIndex + 1} completed. Progress: ${Math.round(processedCount/allWords.length*100)}%`);
                
            } catch (error) {
                console.error(`❌ Error processing batch ${batchIndex + 1}:`, error.message);
                continue; // 다음 배치 계속 진행
            }
            
            // 배치 간 잠시 대기
            if (batchIndex < totalBatches - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        // 각 카테고리의 totalWords 업데이트
        console.log('🔄 Updating category word counts...');
        for (const category of categories) {
            const count = await prisma.vocabexamcategory.count({
                where: {
                    examCategoryId: category.id
                }
            });
            
            await prisma.examcategory.update({
                where: { id: category.id },
                data: { totalWords: count }
            });
            
            console.log(`✅ Updated ${category.name}: ${count} words`);
        }
        
        // 최종 결과 출력
        const finalCategories = await prisma.examcategory.findMany({
            orderBy: { name: 'asc' }
        });
        
        console.log(`\n📈 Processing Summary:`);
        console.log(`   Total words processed: ${processedCount}`);
        console.log(`   New mappings added: ${addedCount}`);
        console.log(`   Duplicates skipped: ${skippedCount}`);
        
        console.log(`\n📚 Final category statistics:`);
        finalCategories.forEach(cat => {
            console.log(`   ${cat.name}: ${cat.totalWords} words`);
        });
        
        console.log('\n🎉 Words added to exam categories successfully!');
        
    } catch (error) {
        console.error('❌ Error during adding words to exam categories:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// 직접 실행된 경우
if (require.main === module) {
    addWordsToExamCategoriesBatch();
}

module.exports = addWordsToExamCategoriesBatch;