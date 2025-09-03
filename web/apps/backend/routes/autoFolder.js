// server/routes/autoFolder.js
const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');
const { ok, fail } = require('../lib/resp');

/**
 * @route   POST /auto-folder/generate
 * @desc    시험별 또는 CEFR 레벨별 단어로 자동 폴더 생성
 * @access  Private
 */
router.post('/generate', async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            examCategory,      // 'TOEIC', 'IELTS_GENERAL' 등 (시험별인 경우)
            cefrLevel,         // 'A1', 'A2', 'B1', 'B2', 'C1' (CEFR별인 경우)
            selectedVocabIds,  // 내 단어장에서 선택된 단어 ID들 배열
            dailyWordCount,    // 하루 학습할 단어 수
            parentFolderId,    // 상위 폴더 ID (HierarchicalFolderPickerModal에서 선택됨)
            folderNamePrefix = 'DAY',  // 폴더 이름 접두사
            includeOnlyNew = false     // 새로운 단어만 포함할지 여부
        } = req.body;

        // 입력 유효성 검사
        if (!selectedVocabIds && !examCategory && !cefrLevel) {
            return fail(res, 400, 'Either selectedVocabIds, examCategory, or cefrLevel must be provided');
        }

        if (!dailyWordCount || dailyWordCount < 1 || dailyWordCount > 500) {
            return fail(res, 400, 'Invalid dailyWordCount: must be between 1 and 500');
        }

        if (examCategory && cefrLevel) {
            return fail(res, 400, 'Cannot specify both examCategory and cefrLevel');
        }

        let categoryId = null;
        let sourceType = '';
        let sourceName = '';

        if (selectedVocabIds && Array.isArray(selectedVocabIds)) {
            // 내 단어장에서 선택된 단어들
            sourceType = 'selected';
            sourceName = `${selectedVocabIds.length} selected words`;
        } else if (examCategory) {
            // 시험 카테고리 조회
            const category = await prisma.$queryRaw`
                SELECT * FROM exam_categories WHERE name = ${examCategory}
            `;

            if (!category || category.length === 0) {
                return fail(res, 404, 'Exam category not found');
            }

            categoryId = category[0].id;
            sourceType = 'exam';
            sourceName = examCategory;
        } else if (cefrLevel) {
            // CEFR 레벨 유효성 검사
            const validCefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1'];
            if (!validCefrLevels.includes(cefrLevel)) {
                return fail(res, 400, 'Invalid CEFR level');
            }

            sourceType = 'cefr';
            sourceName = cefrLevel;
        }

        // 상위 폴더 유효성 검사 및 학습 곡선 타입 조회 (제공된 경우)
        let parentFolder = null;
        if (parentFolderId) {
            parentFolder = await prisma.srsfolder.findFirst({
                where: { id: parentFolderId, userId },
                select: {
                    id: true,
                    learningCurveType: true
                }
            });
            if (!parentFolder) {
                return fail(res, 404, 'Parent folder not found or access denied');
            }
        }

        // 단어들 조회 (선택된 단어, 시험별 또는 CEFR별)
        let vocabs = [];

        if (sourceType === 'selected') {
            // 내 단어장에서 선택된 단어들로 폴더 생성
            const validIds = selectedVocabIds.filter(id => Number.isInteger(id) && id > 0);
            if (validIds.length === 0) {
                return fail(res, 400, 'No valid vocab IDs provided');
            }

            vocabs = await prisma.vocab.findMany({
                where: {
                    id: {
                        in: validIds
                    }
                },
                orderBy: {
                    lemma: 'asc'
                }
            });
        } else if (sourceType === 'exam') {
            // 시험별 단어 조회
            if (includeOnlyNew) {
                vocabs = await prisma.$queryRaw`
                    SELECT DISTINCT v.*, vec.priority
                    FROM vocab v
                    INNER JOIN vocab_exam_categories vec ON v.id = vec.vocabId
                    WHERE vec.examCategoryId = ${categoryId}
                    AND v.id NOT IN (
                        SELECT DISTINCT uv.vocabId 
                        FROM uservocab uv 
                        WHERE uv.userId = ${userId}
                    )
                    ORDER BY vec.priority DESC, v.lemma ASC
                `;
            } else {
                vocabs = await prisma.$queryRaw`
                    SELECT DISTINCT v.*, vec.priority
                    FROM vocab v
                    INNER JOIN vocab_exam_categories vec ON v.id = vec.vocabId
                    WHERE vec.examCategoryId = ${categoryId}
                    ORDER BY vec.priority DESC, v.lemma ASC
                `;
            }
        } else {
            // CEFR 레벨별 단어 조회
            if (includeOnlyNew) {
                vocabs = await prisma.$queryRaw`
                    SELECT DISTINCT v.*, 0 as priority
                    FROM vocab v
                    WHERE v.levelCEFR = ${cefrLevel}
                    AND v.id NOT IN (
                        SELECT DISTINCT uv.vocabId 
                        FROM uservocab uv 
                        WHERE uv.userId = ${userId}
                    )
                    ORDER BY v.lemma ASC
                `;
            } else {
                vocabs = await prisma.$queryRaw`
                    SELECT DISTINCT v.*, 0 as priority
                    FROM vocab v
                    WHERE v.levelCEFR = ${cefrLevel}
                    ORDER BY v.lemma ASC
                `;
            }
        }

        if (vocabs.length === 0) {
            const sourceDesc = sourceType === 'exam' ? 'exam category' : 'CEFR level';
            return fail(res, 400, `No words available for this ${sourceDesc}`);
        }

        // 필요한 폴더 수 계산
        const totalDays = Math.ceil(vocabs.length / dailyWordCount);

        // 트랜잭션으로 폴더들 생성
        const result = await prisma.$transaction(async (tx) => {
            const createdFolders = [];
            
            for (let day = 1; day <= totalDays; day++) {
                // 폴더 생성 - 부모 폴더의 learningCurveType 상속
                const folder = await tx.srsfolder.create({
                    data: {
                        userId,
                        parentId: parentFolderId || null,
                        name: `${folderNamePrefix}${day}`,
                        createdDate: new Date(),
                        kind: 'auto-generated',
                        autoCreated: true,
                        date: new Date(),
                        cycleAnchorAt: new Date(),
                        updatedAt: new Date(),
                        // 부모 폴더가 있으면 부모의 learningCurveType 상속, 없으면 기본값 'long'
                        learningCurveType: parentFolder?.learningCurveType || 'long'
                    }
                });

                // 해당 날짜에 할당될 단어들 계산
                const startIndex = (day - 1) * dailyWordCount;
                const endIndex = Math.min(startIndex + dailyWordCount, vocabs.length);
                const dayVocabs = vocabs.slice(startIndex, endIndex);

                let addedWordsCount = 0;

                // SRS 카드 생성 및 폴더에 추가
                for (const vocab of dayVocabs) {
                    try {
                        // 중복 체크: 같은 사용자, 같은 단어, 같은 폴더
                        const existingCard = await tx.srscard.findFirst({
                            where: {
                                userId,
                                itemType: 'vocab',
                                itemId: vocab.id,
                                folderId: folder.id
                            }
                        });

                        if (existingCard) continue;

                        // SRS 카드 생성
                        const srsCard = await tx.srscard.create({
                            data: {
                                userId,
                                itemType: 'vocab',
                                itemId: vocab.id,
                                folderId: folder.id,
                                stage: 0,
                                correctTotal: 0,
                                wrongTotal: 0,
                                isFromWrongAnswer: false,
                                isMastered: false,
                                masterCycles: 0,
                                wrongStreakCount: 0
                            }
                        });

                        // 폴더 아이템 추가
                        await tx.srsfolderitem.create({
                            data: {
                                folderId: folder.id,
                                cardId: srsCard.id,
                                vocabId: vocab.id,
                                learned: false,
                                wrongCount: 0
                            }
                        });

                        // UserVocab 관계 생성 (중복 방지)
                        await tx.uservocab.upsert({
                            where: {
                                userId_vocabId_folderId: {
                                    userId,
                                    vocabId: vocab.id,
                                    folderId: folder.id
                                }
                            },
                            update: {},
                            create: {
                                userId,
                                vocabId: vocab.id,
                                folderId: folder.id,
                                createdAt: new Date()
                            }
                        });

                        addedWordsCount++;
                    } catch (itemError) {
                        console.warn(`Failed to add word ${vocab.lemma} to folder ${folder.name}:`, itemError);
                        // 개별 단어 추가 실패는 무시하고 계속 진행
                    }
                }

                createdFolders.push({
                    id: folder.id,
                    name: folder.name,
                    wordCount: addedWordsCount,
                    plannedWordCount: dayVocabs.length,
                    createdAt: folder.createdAt
                });
            }
            
            return {
                folders: createdFolders,
                totalFolders: totalDays,
                totalWordsProcessed: vocabs.length,
                dailyWordCount
            };
        });

        const responseData = {
            success: true,
            sourceType,
            sourceName,
            parentFolderId,
            inheritedLearningCurveType: parentFolder?.learningCurveType || 'long',
            ...result,
            message: `Successfully created ${result.totalFolders} folders with ${result.totalWordsProcessed} words`
        };

        if (sourceType === 'exam') {
            responseData.examCategory = category[0];
        }

        return ok(res, responseData);

    } catch (error) {
        console.error('Auto folder generation failed:', error);
        return fail(res, 500, `Failed to generate folders: ${error.message}`);
    }
});

/**
 * @route   GET /auto-folder/preview
 * @desc    자동 폴더 생성 미리보기 (시험별 또는 CEFR별)
 * @access  Private
 */
router.get('/preview', async (req, res) => {
    try {
        const userId = req.user.id;
        const { examCategory, cefrLevel, dailyWordCount, includeOnlyNew = false, selectedVocabIds } = req.query;
        
        console.log('[AutoFolder Preview] Request params:', {
            userId,
            examCategory,
            cefrLevel,
            dailyWordCount,
            includeOnlyNew,
            selectedVocabIds
        });

        // 내 단어장에서 선택된 단어들인 경우
        if (selectedVocabIds) {
            const vocabIdsArray = selectedVocabIds.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
            
            if (vocabIdsArray.length === 0) {
                return fail(res, 400, 'No valid vocab IDs provided');
            }

            if (!dailyWordCount) {
                return fail(res, 400, 'dailyWordCount is required');
            }

            const totalWords = vocabIdsArray.length;
            const dailyCount = parseInt(dailyWordCount);
            const estimatedFolders = Math.ceil(totalWords / dailyCount);

            const responseData = {
                totalWords,
                dailyWordCount: dailyCount,
                estimatedFolders,
                includeOnlyNew: false,
                selectedVocabIds: vocabIdsArray,
                preview: {
                    firstFolderName: `DAY1`,
                    lastFolderName: `DAY${estimatedFolders}`,
                    lastFolderWordCount: totalWords % dailyCount || dailyCount
                }
            };

            return ok(res, responseData);
        }

        if ((!examCategory && !cefrLevel) || !dailyWordCount) {
            return fail(res, 400, 'Either examCategory or cefrLevel, and dailyWordCount are required');
        }

        if (examCategory && cefrLevel) {
            return fail(res, 400, 'Cannot specify both examCategory and cefrLevel');
        }

        let result = [];
        let sourceType = '';
        let sourceName = '';
        let category = null; // 전역 변수로 선언

        if (examCategory) {
            // 시험 카테고리 조회
            category = await prisma.$queryRaw`
                SELECT * FROM exam_categories WHERE name = ${examCategory}
            `;

            if (!category || category.length === 0) {
                return fail(res, 404, 'Exam category not found');
            }

            const categoryId = category[0].id;
            sourceType = 'exam';
            sourceName = examCategory;

            // 시험별 단어 수 조회
            if (includeOnlyNew === 'true') {
                result = await prisma.$queryRaw`
                    SELECT COUNT(DISTINCT v.id) as totalWords
                    FROM vocab v
                    INNER JOIN vocab_exam_categories vec ON v.id = vec.vocabId
                    WHERE vec.examCategoryId = ${categoryId}
                    AND v.id NOT IN (
                        SELECT DISTINCT uv.vocabId 
                        FROM uservocab uv 
                        WHERE uv.userId = ${userId}
                    )
                `;
            } else {
                result = await prisma.$queryRaw`
                    SELECT COUNT(DISTINCT v.id) as totalWords
                    FROM vocab v
                    INNER JOIN vocab_exam_categories vec ON v.id = vec.vocabId
                    WHERE vec.examCategoryId = ${categoryId}
                `;
            }
        } else {
            // CEFR 레벨 유효성 검사
            const validCefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1'];
            if (!validCefrLevels.includes(cefrLevel)) {
                return fail(res, 400, 'Invalid CEFR level');
            }

            sourceType = 'cefr';
            sourceName = cefrLevel;

            // CEFR별 단어 수 조회
            if (includeOnlyNew === 'true') {
                result = await prisma.$queryRaw`
                    SELECT COUNT(DISTINCT v.id) as totalWords
                    FROM vocab v
                    WHERE v.levelCEFR = ${cefrLevel}
                    AND v.id NOT IN (
                        SELECT DISTINCT uv.vocabId 
                        FROM uservocab uv 
                        WHERE uv.userId = ${userId}
                    )
                `;
            } else {
                result = await prisma.$queryRaw`
                    SELECT COUNT(DISTINCT v.id) as totalWords
                    FROM vocab v
                    WHERE v.levelCEFR = ${cefrLevel}
                `;
            }
        }
        const totalWords = parseInt(result[0].totalWords);
        
        const dailyCount = parseInt(dailyWordCount);
        const estimatedFolders = Math.ceil(totalWords / dailyCount);

        const responseData = {
            totalWords,
            dailyWordCount: dailyCount,
            estimatedFolders,
            includeOnlyNew: includeOnlyNew === 'true',
            preview: {
                firstFolderName: `DAY1`,
                lastFolderName: `DAY${estimatedFolders}`,
                lastFolderWordCount: totalWords % dailyCount || dailyCount
            }
        };

        // 시험별인 경우에만 examCategory 추가
        if (examCategory && typeof category !== 'undefined' && category.length > 0) {
            responseData.examCategory = {
                ...category[0],
                id: Number(category[0].id),
                totalWords: Number(category[0].totalWords)
            };
        }

        return ok(res, responseData);

    } catch (error) {
        console.error('Failed to generate preview:', error);
        return fail(res, 500, 'Failed to generate preview');
    }
});

module.exports = router;