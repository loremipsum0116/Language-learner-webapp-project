// server/utils/examVocabSeeder.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * 시험별 단어 시딩 유틸리티
 * 중복을 방지하고 기존 vocab 테이블의 단어들을 재활용합니다.
 */
class ExamVocabSeeder {
    
    /**
     * 특정 시험에 단어들을 시딩합니다.
     * @param {string} examName - 시험 이름 (예: 'TOEIC', 'IELTS_GENERAL')
     * @param {Array} wordsData - 단어 데이터 배열
     * @returns {Object} 시딩 결과
     */
    async seedExamWords(examName, wordsData) {
        try {
            console.log(`🌱 Starting to seed ${wordsData.length} words for ${examName}...`);

            // 1. 시험 카테고리 조회
            const category = await prisma.$queryRaw`
                SELECT * FROM exam_categories WHERE name = ${examName}
            `;

            if (!category || category.length === 0) {
                throw new Error(`Exam category '${examName}' not found`);
            }

            const categoryId = category[0].id;
            let addedCount = 0;
            let updatedCount = 0;
            let skippedCount = 0;
            const errors = [];

            // 2. 트랜잭션으로 단어들 처리
            await prisma.$transaction(async (tx) => {
                for (const [index, wordData] of wordsData.entries()) {
                    try {
                        if (!wordData.lemma) {
                            console.warn(`Skipping word at index ${index}: missing lemma`);
                            skippedCount++;
                            continue;
                        }

                        const lemma = this.normalizelemma(wordData.lemma);
                        
                        // 3. vocab 테이블에서 단어 찾기 또는 생성
                        let vocab = await tx.vocab.findUnique({
                            where: { lemma }
                        });

                        let isNewVocab = false;
                        if (!vocab) {
                            vocab = await tx.vocab.create({
                                data: {
                                    lemma,
                                    pos: wordData.pos || 'unknown',
                                    levelCEFR: wordData.levelCEFR || this.inferCEFRLevel(examName),
                                    source: `exam-${examName.toLowerCase()}`,
                                    freq: wordData.frequency || null,
                                    plural: wordData.plural || null
                                }
                            });
                            isNewVocab = true;
                        }

                        // 4. dictentry 처리 (있는 경우)
                        if (wordData.definition || wordData.pronunciation || wordData.audioUrl) {
                            await this.upsertDictEntry(tx, vocab.id, wordData, examName);
                        }

                        // 5. 시험 카테고리 관계 추가/업데이트
                        const existingRelation = await tx.$queryRaw`
                            SELECT id, priority FROM vocab_exam_categories 
                            WHERE vocabId = ${vocab.id} AND examCategoryId = ${categoryId}
                        `;

                        const priority = this.calculatePriority(wordData, examName);

                        if (existingRelation.length === 0) {
                            await tx.$executeRaw`
                                INSERT INTO vocab_exam_categories (vocabId, examCategoryId, priority)
                                VALUES (${vocab.id}, ${categoryId}, ${priority})
                            `;
                            addedCount++;
                        } else {
                            // 우선순위가 더 높은 경우 업데이트
                            if (priority > existingRelation[0].priority) {
                                await tx.$executeRaw`
                                    UPDATE vocab_exam_categories 
                                    SET priority = ${priority}
                                    WHERE vocabId = ${vocab.id} AND examCategoryId = ${categoryId}
                                `;
                                updatedCount++;
                            } else {
                                skippedCount++;
                            }
                        }

                        // 진행상황 출력
                        if ((index + 1) % 100 === 0) {
                            console.log(`📊 Processed ${index + 1}/${wordsData.length} words...`);
                        }

                    } catch (wordError) {
                        console.error(`❌ Error processing word at index ${index}:`, wordError);
                        errors.push({
                            index,
                            word: wordData.lemma,
                            error: wordError.message
                        });
                    }
                }

                // 6. 시험 카테고리의 총 단어 수 업데이트
                const totalWords = await tx.$queryRaw`
                    SELECT COUNT(*) as count 
                    FROM vocab_exam_categories 
                    WHERE examCategoryId = ${categoryId}
                `;

                await tx.$executeRaw`
                    UPDATE exam_categories 
                    SET totalWords = ${totalWords[0].count}, updatedAt = NOW()
                    WHERE id = ${categoryId}
                `;
            });

            const result = {
                examName,
                totalProcessed: wordsData.length,
                addedCount,
                updatedCount,
                skippedCount,
                errorCount: errors.length,
                errors: errors.slice(0, 10), // 최대 10개 오류만 반환
                success: true
            };

            console.log(`✅ Seeding completed for ${examName}:`);
            console.log(`   - Added: ${addedCount}`);
            console.log(`   - Updated: ${updatedCount}`);
            console.log(`   - Skipped: ${skippedCount}`);
            console.log(`   - Errors: ${errors.length}`);

            return result;

        } catch (error) {
            console.error(`❌ Failed to seed words for ${examName}:`, error);
            return {
                examName,
                success: false,
                error: error.message
            };
        }
    }

    /**
     * lemma 정규화
     */
    normalizelemma(lemma) {
        return lemma.trim().toLowerCase()
            .replace(/^\w/, c => c.toUpperCase()); // 첫 글자만 대문자
    }

    /**
     * 시험별 기본 CEFR 레벨 추론
     */
    inferCEFRLevel(examName) {
        const levels = {
            'TOEIC': 'B1',
            'TOEIC_SPEAKING': 'B1',
            'TOEFL': 'B2',
            'IELTS_GENERAL': 'B1',
            'IELTS_ACADEMIC': 'B2',
            'OPIC': 'B1',
            'GONGMUWON': 'B1',
            'SUNEUNG': 'B1'
        };
        return levels[examName] || 'B1';
    }

    /**
     * 우선순위 계산
     */
    calculatePriority(wordData, examName) {
        let priority = wordData.priority || 0;
        
        // 빈도수가 있는 경우 우선순위에 반영
        if (wordData.frequency) {
            priority += Math.floor(wordData.frequency / 100);
        }
        
        // 난이도별 가중치
        if (wordData.difficulty) {
            priority += (6 - wordData.difficulty) * 10; // 쉬울수록 높은 우선순위
        }

        return priority;
    }

    /**
     * dictentry 업서트
     */
    async upsertDictEntry(tx, vocabId, wordData, examName) {
        const examples = [];
        
        if (wordData.definition && wordData.koGloss) {
            examples.push({
                pos: wordData.pos || 'unknown',
                definitions: [{
                    def: wordData.definition,
                    ko_def: wordData.koGloss,
                    examples: wordData.example && wordData.koExample ? 
                        [{ de: wordData.example, ko: wordData.koExample }] : []
                }]
            });
        }

        const existingEntry = await tx.dictentry.findUnique({
            where: { vocabId }
        });

        if (existingEntry) {
            // 기존 dictentry가 있으면 그대로 사용 (중복 방지)
            // 발음 정보나 오디오 URL만 없는 경우에만 업데이트
            const updateData = {};
            
            if (wordData.pronunciation && !existingEntry.ipa) {
                updateData.ipa = wordData.pronunciation;
                updateData.ipaKo = wordData.pronunciation;
            }
            if (wordData.audioUrl && !existingEntry.audioUrl) {
                updateData.audioUrl = wordData.audioUrl;
            }
            
            // examples는 기존 것을 그대로 유지 (중복 추가 방지)
            // 기존에 examples가 없거나 비어있는 경우에만 새로 추가
            if (examples.length > 0) {
                const existingExamples = Array.isArray(existingEntry.examples) ? 
                    existingEntry.examples : [];
                
                if (existingExamples.length === 0) {
                    // 기존 examples가 없는 경우에만 새로 추가
                    updateData.examples = examples;
                }
                // 기존 examples가 있으면 그대로 유지 (중복 방지)
            }

            if (Object.keys(updateData).length > 0) {
                await tx.dictentry.update({
                    where: { vocabId },
                    data: updateData
                });
            }
        } else {
            // 새 dictentry 생성
            await tx.dictentry.create({
                data: {
                    vocabId,
                    ipa: wordData.pronunciation,
                    ipaKo: wordData.pronunciation,
                    audioUrl: wordData.audioUrl,
                    examples,
                    license: 'Proprietary',
                    attribution: `${examName} vocabulary`
                }
            });
        }
    }

    /**
     * 여러 시험에 공통 단어들 시딩
     */
    async seedCommonWords(examNames, wordsData) {
        const results = [];
        
        for (const examName of examNames) {
            const result = await this.seedExamWords(examName, wordsData);
            results.push(result);
        }
        
        return results;
    }
}

module.exports = new ExamVocabSeeder();