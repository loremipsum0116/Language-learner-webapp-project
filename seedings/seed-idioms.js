const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedIdioms() {
    try {
        console.log('🚀 Starting idiom seeding process...');
        
        // idiom.json 파일 읽기
        const idiomsPath = path.join(__dirname, 'idiom.json');
        const idiomsData = JSON.parse(fs.readFileSync(idiomsPath, 'utf8'));
        
        console.log(`📚 Found ${idiomsData.length} idioms to process`);
        
        // 기존 데이터 확인
        const existingCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM idioms`;
        console.log(`📊 Current idioms in database: ${existingCount[0].count}`);
        
        if (existingCount[0].count > 0) {
            console.log('⚠️  Database already contains idioms. Clearing existing data...');
            await prisma.$executeRaw`DELETE FROM idioms`;
            await prisma.$executeRaw`ALTER TABLE idioms AUTO_INCREMENT = 1`;
            console.log('🧹 Existing data cleared');
        }
        
        // 배치로 나누어 처리 (한 번에 너무 많이 하면 메모리 부족 가능성)
        const batchSize = 100;
        let processed = 0;
        let successful = 0;
        let failed = 0;
        
        for (let i = 0; i < idiomsData.length; i += batchSize) {
            const batch = idiomsData.slice(i, i + batchSize);
            const batchNumber = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(idiomsData.length / batchSize);
            
            console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)...`);
            
            for (const idiomData of batch) {
                try {
                    // 오디오 경로 처리
                    const audioWord = idiomData.audio?.word || null;
                    const audioGloss = idiomData.audio?.gloss || null;
                    const audioExample = idiomData.audio?.example || null;
                    
                    await prisma.$executeRaw`
                        INSERT INTO idioms (
                            idiom,
                            korean_meaning,
                            usage_context_korean,
                            category,
                            koChirpScript,
                            audioWord,
                            audioGloss,
                            audioExample,
                            example_sentence,
                            ko_example_sentence,
                            createdAt,
                            updatedAt
                        ) VALUES (
                            ${idiomData.idiom},
                            ${idiomData.korean_meaning || null},
                            ${idiomData.usage_context_korean || null},
                            ${idiomData.category || null},
                            ${idiomData.koChirpScript || null},
                            ${audioWord},
                            ${audioGloss},
                            ${audioExample},
                            ${idiomData.example || null},
                            ${idiomData.koExample || null},
                            NOW(),
                            NOW()
                        )
                    `;
                    
                    successful++;
                } catch (error) {
                    console.error(`❌ Failed to insert idiom "${idiomData.idiom}":`, error.message);
                    failed++;
                }
                
                processed++;
                
                // 진행률 표시
                if (processed % 50 === 0) {
                    const progress = ((processed / idiomsData.length) * 100).toFixed(1);
                    console.log(`⏳ Progress: ${processed}/${idiomsData.length} (${progress}%)`);
                }
            }
        }
        
        // 최종 결과 확인
        const finalCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM idioms`;
        
        console.log('\n🎉 Idiom seeding completed!');
        console.log(`📊 Final Statistics:`);
        console.log(`   - Total processed: ${processed}`);
        console.log(`   - Successfully inserted: ${successful}`);
        console.log(`   - Failed: ${failed}`);
        console.log(`   - Database count: ${finalCount[0].count}`);
        
        // 샘플 데이터 확인
        const sampleIdioms = await prisma.$queryRaw`
            SELECT idiom, korean_meaning, category 
            FROM idioms 
            LIMIT 5
        `;
        
        console.log('\n📝 Sample data:');
        sampleIdioms.forEach((idiom, index) => {
            console.log(`   ${index + 1}. ${idiom.idiom} - ${idiom.korean_meaning} (${idiom.category})`);
        });
        
    } catch (error) {
        console.error('💥 Fatal error during seeding:', error);
    } finally {
        await prisma.$disconnect();
        console.log('🔌 Database connection closed');
    }
}

// 스크립트 실행
if (require.main === module) {
    seedIdioms()
        .then(() => {
            console.log('✅ Seeding process completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💀 Seeding process failed:', error);
            process.exit(1);
        });
}

module.exports = seedIdioms;