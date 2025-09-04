// server/seed-cefr-vocabs.js
// cefr_vocabs.json의 모든 단어를 시딩하고 카테고리별로 분류

const { prisma } = require('./lib/prismaClient');
const fs = require('fs');
const path = require('path');

// CEFR 레벨을 한국어 카테고리명으로 매핑
const cefrToKorean = {
    '입문': 'A1',
    '기초': 'A2', 
    '중급': 'B1',
    '중상급': 'B2',
    '고급': 'C1',
    '최고급': 'C2'
};

// 시험별 카테고리 매핑
const examCategories = {
    'TOEFL': 'TOEFL',
    'TOEIC': 'TOEIC', 
    '수능': '수능',
    'IELTS-A': 'IELTS-A',
    'IELTS-B': 'IELTS-A',
    'IELTS-C': 'IELTS-A'
};

async function loadCefrVocabs() {
    try {
        const filePath = path.join(__dirname, 'cefr_vocabs.json');
        const fileContent = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(fileContent);
    } catch (error) {
        console.error('❌ Error loading cefr_vocabs.json:', error);
        throw error;
    }
}

function parseCategoriesString(categoriesStr) {
    if (!categoriesStr) return { cefrLevel: null, examCategories: [] };
    
    const categories = categoriesStr.split(',').map(cat => cat.trim());
    let cefrLevel = null;
    const examCats = [];
    
    categories.forEach(category => {
        // CEFR 레벨 체크
        if (cefrToKorean[category]) {
            cefrLevel = cefrToKorean[category];
        }
        // 시험 카테고리 체크  
        else if (examCategories[category]) {
            if (!examCats.includes(examCategories[category])) {
                examCats.push(examCategories[category]);
            }
        }
    });
    
    return { cefrLevel, examCategories: examCats };
}

async function ensureExamCategoriesExist() {
    const requiredCategories = [
        { name: 'TOEFL', description: 'Test of English as a Foreign Language' },
        { name: 'TOEIC', description: 'Test of English for International Communication' },
        { name: '수능', description: '대학수학능력시험 영어 영역' },
        { name: 'IELTS-A', description: 'International English Language Testing System - Academic' }
    ];
    
    for (const category of requiredCategories) {
        await prisma.examcategory.upsert({
            where: { name: category.name },
            update: {},
            create: category
        });
    }
    console.log('✅ Exam categories ensured');
}

async function seedVocabFromCefrJson(vocabData) {
    try {
        const { cefrLevel, examCategories: examCats } = parseCategoriesString(vocabData.categories);
        
        // Vocab 찾기 또는 생성
        let vocab = await prisma.vocab.findFirst({
            where: {
                languageId: 1, // English language ID
                lemma: vocabData.lemma,
                pos: vocabData.pos || 'unknown'
            }
        });

        if (vocab) {
            // 기존 vocab 업데이트
            vocab = await prisma.vocab.update({
                where: { id: vocab.id },
                data: {
                    levelCEFR: cefrLevel || 'A1',
                    source: 'cefr_vocabs'
                }
            });
        } else {
            // 새 vocab 생성
            vocab = await prisma.vocab.create({
                data: {
                    languageId: 1, // English language ID from basic seeding
                    lemma: vocabData.lemma,
                    pos: vocabData.pos || 'unknown',
                    levelCEFR: cefrLevel || 'A1',
                    source: 'cefr_vocabs'
                }
            });
        }

        // DictEntry 생성/업데이트 
        const examples = [
            {
                kind: 'gloss',
                ko: vocabData.koGloss || '',
                source: 'cefr_vocabs'
            },
            {
                kind: 'example',
                ko: vocabData.koExample || '',
                chirpScript: vocabData.koChirpScript || '',
                source: 'cefr_vocabs'
            }
        ];

        await prisma.dictentry.upsert({
            where: { vocabId: vocab.id },
            update: {
                ipa: vocabData.pronunciation || null,
                audioLocal: vocabData.audio ? JSON.stringify(vocabData.audio) : null,
                examples: examples
            },
            create: {
                vocabId: vocab.id,
                ipa: vocabData.pronunciation || null,
                audioLocal: vocabData.audio ? JSON.stringify(vocabData.audio) : null,
                examples: examples,
                attribution: 'CEFR Vocabs Dataset',
                license: 'Custom'
            }
        });

        // 시험 카테고리 연결
        for (const examCat of examCats) {
            const examCategory = await prisma.examcategory.findUnique({
                where: { name: examCat }
            });
            
            if (examCategory) {
                await prisma.vocabexamcategory.upsert({
                    where: {
                        vocabId_examCategoryId: {
                            vocabId: vocab.id,
                            examCategoryId: examCategory.id
                        }
                    },
                    update: {},
                    create: {
                        vocabId: vocab.id,
                        examCategoryId: examCategory.id,
                        priority: 1
                    }
                });
            }
        }

        return { vocab, examCategories: examCats };
        
    } catch (error) {
        console.error(`❌ Failed to seed vocab: ${vocabData.lemma}`, error);
        throw error;
    }
}

async function updateExamCategoryCounts() {
    console.log('📊 Updating exam category word counts...');
    
    const categories = await prisma.examcategory.findMany({
        include: {
            vocabexamcategory: true
        }
    });
    
    for (const category of categories) {
        const wordCount = category.vocabexamcategory.length;
        await prisma.examcategory.update({
            where: { id: category.id },
            data: { totalWords: wordCount }
        });
        console.log(`   ${category.name}: ${wordCount} words`);
    }
}

async function main() {
    try {
        console.log('🌱 Starting CEFR vocabs seeding from cefr_vocabs.json...');
        
        // 시험 카테고리 생성 확인
        await ensureExamCategoriesExist();
        
        // cefr_vocabs.json 로드
        const vocabsData = await loadCefrVocabs();
        console.log(`📚 Loaded ${vocabsData.length} vocabulary items`);
        
        let successCount = 0;
        let errorCount = 0;
        const categoryStats = {};
        
        // 각 단어 시딩
        for (let i = 0; i < vocabsData.length; i++) {
            const vocabData = vocabsData[i];
            
            try {
                const result = await seedVocabFromCefrJson(vocabData);
                successCount++;
                
                // 통계 업데이트
                const cefrLevel = result.vocab.levelCEFR;
                if (!categoryStats[cefrLevel]) categoryStats[cefrLevel] = 0;
                categoryStats[cefrLevel]++;
                
                if ((i + 1) % 300 === 0) {
                    console.log(`   Processed: ${i + 1}/${vocabsData.length} (${successCount} success, ${errorCount} errors)`);
                }
                
            } catch (error) {
                errorCount++;
                console.error(`❌ Error processing: ${vocabData.lemma}`, error.message);
            }
        }
        
        // 시험 카테고리별 단어 수 업데이트
        await updateExamCategoryCounts();
        
        console.log('\n📈 Seeding Summary:');
        console.log(`   Total processed: ${vocabsData.length}`);
        console.log(`   Successful: ${successCount}`);  
        console.log(`   Errors: ${errorCount}`);
        
        console.log('\n📊 CEFR Level Distribution:');
        Object.entries(categoryStats).forEach(([level, count]) => {
            console.log(`   ${level}: ${count} words`);
        });
        
        console.log('\n🎉 CEFR vocabs seeding completed!');
        
    } catch (error) {
        console.error('❌ Fatal error during seeding:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// 직접 실행된 경우
if (require.main === module) {
    main();
}

module.exports = { main, seedVocabFromCefrJson };