// server/routes/examVocab.js
const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');
const { ok, fail } = require('../lib/resp');

/**
 * @route   GET /exam-vocab/categories
 * @desc    모든 시험 카테고리 목록 조회
 * @access  Public
 */
router.get('/categories', async (req, res) => {
    try {
        const categoriesRaw = await prisma.$queryRaw`
            SELECT 
                ec.*,
                COALESCE(COUNT(vec.vocabId), 0) as actualWordCount
            FROM exam_categories ec
            LEFT JOIN vocab_exam_categories vec ON ec.id = vec.examCategoryId
            GROUP BY ec.id
            ORDER BY ec.id
        `;

        // BigInt를 Number로 변환
        const categories = categoriesRaw.map(cat => ({
            ...cat,
            id: Number(cat.id),
            totalWords: Number(cat.totalWords),
            actualWordCount: Number(cat.actualWordCount)
        }));

        return ok(res, categories);
    } catch (error) {
        console.error('Failed to fetch exam categories:', error);
        return fail(res, 500, 'Failed to fetch exam categories');
    }
});

/**
 * @route   GET /exam-vocab/:examName
 * @desc    특정 시험의 단어 목록 조회
 * @access  Public
 */
router.get('/:examName', async (req, res) => {
    try {
        const { examName } = req.params;
        const { page = 1, limit = 50, search = '' } = req.query;
        
        const offset = (page - 1) * limit;

        // 먼저 카테고리 존재 확인
        const category = await prisma.$queryRaw`
            SELECT * FROM exam_categories WHERE name = ${examName}
        `;

        if (!category || category.length === 0) {
            return fail(res, 404, 'Exam category not found');
        }

        const categoryId = category[0].id;

        // 단어 목록 조회 (페이징 적용)
        let vocabsRaw, totalCountResult;

        if (search) {
            const searchPattern = `%${search}%`;
            vocabsRaw = await prisma.$queryRaw`
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
                AND v.lemma LIKE ${searchPattern}
                ORDER BY vec.priority DESC, v.lemma ASC 
                LIMIT ${limit} OFFSET ${offset}
            `;

            // 검색 시에는 실제 검색 결과 개수 사용
            totalCountResult = await prisma.$queryRaw`
                SELECT COUNT(*) as total
                FROM vocab v
                INNER JOIN vocab_exam_categories vec ON v.id = vec.vocabId
                WHERE vec.examCategoryId = ${categoryId}
                AND v.lemma LIKE ${searchPattern}
            `;
        } else {
            vocabsRaw = await prisma.$queryRaw`
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
                LIMIT ${limit} OFFSET ${offset}
            `;

            // 카테고리의 totalWords 필드 사용 (JSON 원본 기준)
            console.log(`[DEBUG] Using category totalWords: ${category[0].totalWords}`);
            totalCountResult = [{ total: BigInt(category[0].totalWords) }];
        }

        // VocabTranslation 테이블에서 한국어 번역 가져오기
        const vocabIds = vocabsRaw.map(v => Number(v.id));
        const vocabTranslations = vocabIds.length > 0 ? await prisma.vocabTranslation.findMany({
            where: {
                vocabId: { in: vocabIds },
                language: { code: 'ko' }
            },
            include: {
                language: true
            }
        }) : [];

        // VocabTranslation을 vocabId로 매핑
        const translationMap = new Map();
        vocabTranslations.forEach(t => {
            translationMap.set(t.vocabId, t.translation);
        });

        // BigInt 변환 및 ko_gloss 추출
        const vocabs = vocabsRaw.map(vocab => {
            const rawExamples = Array.isArray(vocab.examples) ? vocab.examples : [];

            // Korean gloss 추출 - VocabTranslation 테이블 우선
            let primaryGloss = translationMap.get(Number(vocab.id)) || null;

            // VocabTranslation에 없으면 기존 방식 시도
            if (!primaryGloss) {
                // CEFR 구조: examples[].ko (gloss kind)
                const glossExample = rawExamples.find(ex => ex.kind === 'gloss');
                if (glossExample && glossExample.ko) {
                    primaryGloss = glossExample.ko;
                }

                // 만약 gloss가 없다면 첫 번째 example의 ko 사용 (하지만 이건 예문이므로 사용하지 않음)
                // if (!primaryGloss && rawExamples.length > 0 && rawExamples[0].ko) {
                //     primaryGloss = rawExamples[0].ko;
                // }

                // 기존 복잡한 구조도 지원 (backward compatibility)
                if (!primaryGloss && rawExamples.length > 0 && rawExamples[0].definitions?.length > 0) {
                    primaryGloss = rawExamples[0].definitions[0].ko_def || null;
                }
            }

            return {
                ...vocab,
                id: Number(vocab.id),
                priority: Number(vocab.priority),
                ko_gloss: primaryGloss,
                examples: rawExamples
            };
        });

        const totalCount = Number(totalCountResult[0].total);
        const totalPages = Math.ceil(totalCount / limit);

        return ok(res, {
            examCategory: {
                ...category[0],
                id: Number(category[0].id),
                totalWords: Number(category[0].totalWords)
            },
            vocabs,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalCount: parseInt(totalCount),
                limit: parseInt(limit),
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('Failed to fetch exam vocabs:', error);
        return fail(res, 500, 'Failed to fetch exam vocabs');
    }
});

/**
 * @route   POST /exam-vocab/:examName/add-words
 * @desc    특정 시험에 단어들 추가 (중복 방지)
 * @access  Private (auth 필요)
 */
router.post('/:examName/add-words', async (req, res) => {
    try {
        const { examName } = req.params;
        const { words } = req.body; // [{ lemma, pos, priority, ... }, ...]

        if (!Array.isArray(words) || words.length === 0) {
            return fail(res, 400, 'Words array is required');
        }

        // 카테고리 조회
        const category = await prisma.$queryRaw`
            SELECT * FROM exam_categories WHERE name = ${examName}
        `;

        if (!category || category.length === 0) {
            return fail(res, 404, 'Exam category not found');
        }

        const categoryId = category[0].id;
        let addedCount = 0;
        let skippedCount = 0;

        // 트랜잭션으로 단어들 추가
        await prisma.$transaction(async (tx) => {
            for (const wordData of words) {
                if (!wordData.lemma) continue;

                const lemma = wordData.lemma.trim();
                
                // 1. vocab 테이블에서 단어 찾기 또는 생성
                let vocab = await tx.vocab.findUnique({
                    where: { lemma }
                });

                if (!vocab) {
                    vocab = await tx.vocab.create({
                        data: {
                            lemma,
                            pos: wordData.pos || 'unknown',
                            levelCEFR: wordData.levelCEFR || 'Unknown',
                            source: `exam-${examName}`
                        }
                    });
                }

                // 2. 시험 카테고리 관계 추가 (중복 체크)
                const existing = await tx.$queryRaw`
                    SELECT id FROM vocab_exam_categories 
                    WHERE vocabId = ${vocab.id} AND examCategoryId = ${categoryId}
                `;

                if (existing.length === 0) {
                    await tx.$executeRaw`
                        INSERT INTO vocab_exam_categories (vocabId, examCategoryId, priority)
                        VALUES (${vocab.id}, ${categoryId}, ${wordData.priority || 0})
                    `;
                    addedCount++;
                } else {
                    skippedCount++;
                }
            }

            // 카테고리의 총 단어 수 업데이트
            const totalWords = await tx.$queryRaw`
                SELECT COUNT(*) as count 
                FROM vocab_exam_categories 
                WHERE examCategoryId = ${categoryId}
            `;

            await tx.$executeRaw`
                UPDATE exam_categories 
                SET totalWords = ${totalWords[0].count}
                WHERE id = ${categoryId}
            `;
        });

        return ok(res, {
            message: `Successfully processed ${words.length} words`,
            addedCount,
            skippedCount,
            totalProcessed: words.length
        });

    } catch (error) {
        console.error('Failed to add words to exam category:', error);
        return fail(res, 500, 'Failed to add words to exam category');
    }
});

/**
 * @route   GET /exam-vocab/:examName/stats
 * @desc    특정 시험의 통계 정보 조회
 * @access  Public
 */
router.get('/:examName/stats', async (req, res) => {
    try {
        const { examName } = req.params;

        const category = await prisma.$queryRaw`
            SELECT * FROM exam_categories WHERE name = ${examName}
        `;

        if (!category || category.length === 0) {
            return fail(res, 404, 'Exam category not found');
        }

        const categoryId = category[0].id;

        // 통계 조회
        const stats = await prisma.$queryRaw`
            SELECT 
                COUNT(*) as totalWords,
                COUNT(CASE WHEN v.levelCEFR = 'A1' THEN 1 END) as a1Words,
                COUNT(CASE WHEN v.levelCEFR = 'A2' THEN 1 END) as a2Words,
                COUNT(CASE WHEN v.levelCEFR = 'B1' THEN 1 END) as b1Words,
                COUNT(CASE WHEN v.levelCEFR = 'B2' THEN 1 END) as b2Words,
                COUNT(CASE WHEN v.levelCEFR = 'C1' THEN 1 END) as c1Words,
                COUNT(CASE WHEN v.levelCEFR = 'C2' THEN 1 END) as c2Words,
                COUNT(CASE WHEN de.id IS NOT NULL THEN 1 END) as wordsWithDefinition
            FROM vocab_exam_categories vec
            INNER JOIN vocab v ON vec.vocabId = v.id
            LEFT JOIN dictentry de ON v.id = de.vocabId
            WHERE vec.examCategoryId = ${categoryId}
        `;

        const statsConverted = {
            ...stats[0],
            totalWords: Number(stats[0].totalWords),
            a1Words: Number(stats[0].a1Words),
            a2Words: Number(stats[0].a2Words),
            b1Words: Number(stats[0].b1Words),
            b2Words: Number(stats[0].b2Words),
            c1Words: Number(stats[0].c1Words),
            c2Words: Number(stats[0].c2Words),
            wordsWithDefinition: Number(stats[0].wordsWithDefinition)
        };

        return ok(res, {
            examCategory: {
                ...category[0],
                id: Number(category[0].id),
                totalWords: Number(category[0].totalWords)
            },
            stats: statsConverted
        });

    } catch (error) {
        console.error('Failed to fetch exam stats:', error);
        return fail(res, 500, 'Failed to fetch exam stats');
    }
});

module.exports = router;