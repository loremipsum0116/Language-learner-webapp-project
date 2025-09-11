// seed-idioms.js
// 숙어/구동사 데이터를 idioms 테이블에서 vocab 테이블로 통합하는 시딩 스크립트

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateIdiomsToVocab() {
    console.log('🔄 Starting idiom migration to vocab table...');
    
    try {
        // 1. 기존 idioms 데이터 조회
        const idioms = await prisma.idiom.findMany();
        console.log(`📊 Found ${idioms.length} idioms to migrate`);
        
        if (idioms.length === 0) {
            console.log('ℹ️  No idioms found to migrate');
            return;
        }

        let migratedCount = 0;
        let skippedCount = 0;
        let updatedCount = 0;

        for (const idiom of idioms) {
            try {
                // CEFR 레벨 추출 (category에서)
                let cefrLevel = 'B1'; // 기본값
                if (idiom.category) {
                    const match = idiom.category.match(/(A[12]|B[12]|C[12])/);
                    if (match) {
                        cefrLevel = match[1];
                    }
                }

                // pos 결정 (숙어 vs 구동사)
                const pos = idiom.category?.includes('구동사') ? 'phrasal verb' : 'idiom';

                // 이미 존재하는 vocab 확인 (lemma와 pos로)
                const existingVocab = await prisma.vocab.findFirst({
                    where: {
                        lemma: idiom.idiom,
                        pos: pos,
                        source: 'idiom_migration'
                    }
                });

                if (existingVocab) {
                    // 기존 레코드가 있으면 업데이트
                    await prisma.vocab.update({
                        where: { id: existingVocab.id },
                        data: {
                            levelCEFR: cefrLevel,
                            source: 'idiom_migration'
                        }
                    });

                    // dictentry 업데이트
                    const existingDictEntry = await prisma.dictentry.findUnique({
                        where: { vocabId: existingVocab.id }
                    });

                    const audioData = {
                        word: idiom.audioWord,
                        gloss: idiom.audioGloss,
                        example: idiom.audioExample
                    };

                    const examples = [
                        {
                            ko: idiom.korean_meaning || '',
                            kind: 'gloss',
                            source: 'idiom_migration'
                        },
                        {
                            en: idiom.example_sentence || '',
                            ko: idiom.ko_example_sentence || '',
                            kind: 'example',
                            source: 'idiom_migration',
                            chirpScript: idiom.koChirpScript || ''
                        },
                        {
                            ko: idiom.usage_context_korean || '',
                            kind: 'usage',
                            source: 'idiom_migration'
                        }
                    ].filter(ex => ex.ko || ex.en); // 빈 예시 제거

                    if (existingDictEntry) {
                        await prisma.dictentry.update({
                            where: { vocabId: existingVocab.id },
                            data: {
                                audioLocal: JSON.stringify(audioData),
                                examples: examples,
                                sourceUrl: 'idiom_migration'
                            }
                        });
                    } else {
                        await prisma.dictentry.create({
                            data: {
                                vocabId: existingVocab.id,
                                audioLocal: JSON.stringify(audioData),
                                examples: examples,
                                sourceUrl: 'idiom_migration'
                            }
                        });
                    }

                    updatedCount++;
                    console.log(`🔄 Updated existing vocab: ${idiom.idiom} (${pos})`);
                } else {
                    // 새 vocab 레코드 생성
                    const newVocab = await prisma.vocab.create({
                        data: {
                            lemma: idiom.idiom,
                            pos: pos,
                            levelCEFR: cefrLevel,
                            source: 'idiom_migration'
                        }
                    });

                    // dictentry 생성
                    const audioData = {
                        word: idiom.audioWord,
                        gloss: idiom.audioGloss,
                        example: idiom.audioExample
                    };

                    const examples = [
                        {
                            ko: idiom.korean_meaning || '',
                            kind: 'gloss',
                            source: 'idiom_migration'
                        },
                        {
                            en: idiom.example_sentence || '',
                            ko: idiom.ko_example_sentence || '',
                            kind: 'example',
                            source: 'idiom_migration',
                            chirpScript: idiom.koChirpScript || ''
                        },
                        {
                            ko: idiom.usage_context_korean || '',
                            kind: 'usage',
                            source: 'idiom_migration'
                        }
                    ].filter(ex => ex.ko || ex.en); // 빈 예시 제거

                    await prisma.dictentry.create({
                        data: {
                            vocabId: newVocab.id,
                            audioLocal: JSON.stringify(audioData),
                            examples: examples,
                            sourceUrl: 'idiom_migration'
                        }
                    });

                    migratedCount++;
                    console.log(`✅ Migrated: ${idiom.idiom} (${pos}) -> vocab.id: ${newVocab.id}`);
                }

            } catch (error) {
                console.error(`❌ Error migrating idiom '${idiom.idiom}':`, error.message);
                skippedCount++;
            }
        }

        console.log('\n📊 Migration Summary:');
        console.log(`✅ Migrated: ${migratedCount} new vocab records`);
        console.log(`🔄 Updated: ${updatedCount} existing vocab records`);
        console.log(`⚠️  Skipped: ${skippedCount} due to errors`);
        console.log(`📋 Total processed: ${idioms.length} idioms`);

        // 마이그레이션된 데이터 검증
        const migratedVocabs = await prisma.vocab.count({
            where: {
                source: 'idiom_migration'
            }
        });

        console.log(`\n🔍 Verification: Found ${migratedVocabs} vocab records with source 'idiom_migration'`);

        console.log('\n✅ Idiom migration completed successfully!');
        console.log('\nℹ️  Note: The original idioms table is preserved for backup. You can drop it manually after verifying the migration.');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// 실행
if (require.main === module) {
    migrateIdiomsToVocab()
        .then(() => {
            console.log('🎉 Migration script completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Migration script failed:', error);
            process.exit(1);
        });
}

module.exports = { migrateIdiomsToVocab };