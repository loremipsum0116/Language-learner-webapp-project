// server/migrate-idioms-to-vocab.js
const { prisma } = require('./lib/prismaClient');

async function migrateIdiomsToVocab() {
    console.log('🚀 Starting idiom to vocab migration...');
    
    try {
        // 1. Get all idioms from idioms table
        const idioms = await prisma.idiom.findMany();
        console.log(`📚 Found ${idioms.length} idioms to migrate`);
        
        // 2. Prepare vocab data
        const vocabData = idioms.map(idiom => {
            // Determine pos based on category
            let pos = 'idiom'; // default
            if (idiom.category) {
                if (idiom.category.includes('구동사')) {
                    pos = 'phrasal verb';
                } else if (idiom.category.includes('숙어')) {
                    pos = 'idiom';
                }
            }
            
            // Determine CEFR level from category
            let levelCEFR = 'B1'; // default
            if (idiom.category) {
                const level = idiom.category.split(',')[0]?.trim();
                switch(level) {
                    case '입문': levelCEFR = 'A1'; break;
                    case '기초': levelCEFR = 'A2'; break;
                    case '중급': levelCEFR = 'B1'; break;
                    case '중상급': levelCEFR = 'B2'; break;
                    case '고급': case '상급': levelCEFR = 'C1'; break;
                    case '최고급': levelCEFR = 'C2'; break;
                    default: levelCEFR = 'B1';
                }
            }
            
            // Parse audio data (could be JSON string or object)
            let audioData = {};
            if (typeof idiom.audio === 'string') {
                try {
                    audioData = JSON.parse(idiom.audio);
                } catch (e) {
                    console.warn(`Failed to parse audio for ${idiom.idiom}:`, e.message);
                }
            } else if (typeof idiom.audio === 'object' && idiom.audio !== null) {
                audioData = idiom.audio;
            }
            
            return {
                lemma: idiom.idiom,
                pos: pos,
                levelCEFR: levelCEFR,
                source: 'idiom_migration',
                // Store original idiom data in dictentry
                dictentry: {
                    create: {
                        examples: [
                            {
                                ko: idiom.korean_meaning || '',
                                kind: 'gloss',
                                source: 'idiom_migration'
                            },
                            ...(idiom.example_sentence ? [{
                                en: idiom.example_sentence,
                                ko: idiom.ko_example_sentence || '',
                                kind: 'example',
                                source: 'idiom_migration',
                                chirpScript: idiom.koChirpScript || ''
                            }] : []),
                            ...(idiom.usage_context_korean ? [{
                                ko: idiom.usage_context_korean,
                                kind: 'usage',
                                source: 'idiom_migration'
                            }] : [])
                        ],
                        audioLocal: JSON.stringify({
                            word: audioData.word || null,
                            gloss: audioData.gloss || null,
                            example: audioData.example || null
                        }),
                        license: 'Idiom Dataset',
                        attribution: 'Migrated from idioms table'
                    }
                }
            };
        });
        
        console.log('📝 Sample migration data:');
        console.log(JSON.stringify(vocabData[0], null, 2));
        
        // 3. Insert vocabs in batches
        const batchSize = 100;
        let processed = 0;
        
        for (let i = 0; i < vocabData.length; i += batchSize) {
            const batch = vocabData.slice(i, i + batchSize);
            
            // Create vocabs with nested dictentry creation
            for (const vocabItem of batch) {
                try {
                    await prisma.vocab.create({
                        data: vocabItem
                    });
                    processed++;
                    
                    if (processed % 50 === 0) {
                        console.log(`⏳ Progress: ${processed}/${vocabData.length} (${Math.round(processed / vocabData.length * 100)}%)`);
                    }
                } catch (error) {
                    console.error(`❌ Failed to create vocab for "${vocabItem.lemma}":`, error.message);
                    // Continue with other items
                }
            }
        }
        
        console.log(`✅ Migration completed! Processed ${processed}/${vocabData.length} idioms`);
        
        // 4. Verify migration
        const migratedCount = await prisma.vocab.count({
            where: { source: 'idiom_migration' }
        });
        console.log(`🔍 Verification: ${migratedCount} migrated vocabs found in database`);
        
        // 5. Show sample migrated data
        const sample = await prisma.vocab.findFirst({
            where: { source: 'idiom_migration' },
            include: { dictentry: true }
        });
        
        if (sample) {
            console.log('📋 Sample migrated record:');
            console.log(`   - Lemma: ${sample.lemma}`);
            console.log(`   - POS: ${sample.pos}`);
            console.log(`   - Level: ${sample.levelCEFR}`);
            console.log(`   - Examples: ${sample.dictentry?.examples?.length || 0}`);
        }
        
    } catch (error) {
        console.error('💥 Migration failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run migration
if (require.main === module) {
    migrateIdiomsToVocab()
        .then(() => {
            console.log('🎉 Migration completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { migrateIdiomsToVocab };