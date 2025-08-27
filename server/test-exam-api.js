// server/test-exam-api.js
// 시험별 API 엔드포인트 테스트

const { prisma } = require('./lib/prismaClient');

async function testExamApi() {
    try {
        console.log('🔍 Testing exam API endpoints...\n');
        
        // 1. Categories 엔드포인트 테스트
        console.log('📊 Testing /exam-vocab/categories equivalent:');
        const categoriesRaw = await prisma.$queryRaw`
            SELECT 
                ec.*,
                COALESCE(COUNT(vec.vocabId), 0) as actualWordCount
            FROM exam_categories ec
            LEFT JOIN vocab_exam_categories vec ON ec.id = vec.examCategoryId
            GROUP BY ec.id
            ORDER BY ec.id
        `;

        const categories = categoriesRaw.map(cat => ({
            ...cat,
            id: Number(cat.id),
            totalWords: Number(cat.totalWords),
            actualWordCount: Number(cat.actualWordCount)
        }));

        console.log('Categories result:');
        categories.forEach(cat => {
            console.log(`   ${cat.name}: ${cat.totalWords} total, ${cat.actualWordCount} actual`);
        });
        
        // 2. TOEFL 단어 목록 테스트
        console.log('\n📚 Testing /exam-vocab/TOEFL equivalent:');
        
        const toeflCategory = await prisma.$queryRaw`
            SELECT * FROM exam_categories WHERE name = 'TOEFL'
        `;

        if (!toeflCategory || toeflCategory.length === 0) {
            console.log('❌ TOEFL category not found');
            return;
        }

        const categoryId = toeflCategory[0].id;
        console.log(`   TOEFL category ID: ${categoryId}`);

        const vocabsRaw = await prisma.$queryRaw`
            SELECT 
                v.*,
                de.ipa,
                de.audioUrl,
                de.examples,
                vec.priority,
                vec.addedAt as examAddedAt
            FROM vocab v
            INNER JOIN vocab_exam_categories vec ON v.id = vec.vocabId
            LEFT JOIN dictentry de ON v.id = de.vocabId
            WHERE vec.examCategoryId = ${categoryId}
            ORDER BY vec.priority DESC, v.lemma ASC 
            LIMIT 10
        `;

        console.log(`   Found ${vocabsRaw.length} sample words:`);
        vocabsRaw.forEach(vocab => {
            const examples = Array.isArray(vocab.examples) ? vocab.examples : [];
            let primaryGloss = null;
            if (examples.length > 0) {
                // CEFR 데이터 구조에 맞게 ko_gloss 추출
                const glossExample = examples.find(ex => ex.kind === 'gloss');
                if (glossExample) {
                    primaryGloss = glossExample.ko;
                }
            }
            
            console.log(`     - ${vocab.lemma} (${vocab.pos}, ${vocab.levelCEFR}): ${primaryGloss || 'No gloss'}`);
        });

        // 3. 총 카운트 확인
        const totalCountResult = await prisma.$queryRaw`
            SELECT COUNT(*) as total
            FROM vocab v
            INNER JOIN vocab_exam_categories vec ON v.id = vec.vocabId
            WHERE vec.examCategoryId = ${categoryId}
        `;

        console.log(`   Total TOEFL words in DB: ${totalCountResult[0].total}`);
        
        // 4. 응답 구조 시뮬레이션
        const apiResponse = {
            examCategory: {
                ...toeflCategory[0],
                id: Number(toeflCategory[0].id),
                totalWords: Number(toeflCategory[0].totalWords)
            },
            vocabs: vocabsRaw.map(vocab => {
                const examples = Array.isArray(vocab.examples) ? vocab.examples : [];
                let primaryGloss = null;
                if (examples.length > 0) {
                    const glossExample = examples.find(ex => ex.kind === 'gloss');
                    if (glossExample) {
                        primaryGloss = glossExample.ko;
                    }
                }
                
                return {
                    ...vocab,
                    id: Number(vocab.id),
                    priority: Number(vocab.priority),
                    ko_gloss: primaryGloss,
                    examples: examples
                };
            }),
            pagination: {
                currentPage: 1,
                totalPages: Math.ceil(Number(totalCountResult[0].total) / 100),
                totalCount: Number(totalCountResult[0].total),
                limit: 100,
                hasNext: Number(totalCountResult[0].total) > 100,
                hasPrev: false
            }
        };
        
        console.log('\n📋 API Response structure:');
        console.log(`   examCategory.name: ${apiResponse.examCategory.name}`);
        console.log(`   examCategory.totalWords: ${apiResponse.examCategory.totalWords}`);
        console.log(`   vocabs.length: ${apiResponse.vocabs.length}`);
        console.log(`   pagination.totalCount: ${apiResponse.pagination.totalCount}`);
        
    } catch (error) {
        console.error('❌ Error testing exam API:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testExamApi();