// server/routes/my-idioms.js
const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');
const { ok, fail } = require('../lib/resp');
const { 
    createManualIdiomFolder, 
    ensureCardsForIdioms, 
    addItemsToFolder,
    validateFolderContentType 
} = require('../services/srsService');

// GET /my-idioms - 내 숙어/구동사 목록 조회
router.get('/', async (req, res) => {
    try {
        const { category } = req.query; // '숙어' 또는 '구동사' 필터
        const userId = req.user.id;

        // 사용자가 추가한 숙어들 조회 (SRS 카드가 있는 것만)
        const where = {
            userId,
            itemType: 'idiom'
        };

        const srsCards = await prisma.srscard.findMany({
            where,
            select: {
                itemId: true,
                correctTotal: true,
                wrongTotal: true,
                stage: true,
                nextReviewAt: true,
                isMastered: true
            },
            distinct: ['itemId'] // 중복 제거
        });

        if (srsCards.length === 0) {
            return res.json({ data: [] });
        }

        const idiomIds = srsCards.map(card => card.itemId);
        
        // 카테고리 필터링을 위한 where 조건
        let idiomWhere = { id: { in: idiomIds } };
        if (category) {
            idiomWhere.category = { contains: category };
        }

        const idioms = await prisma.idiom.findMany({
            where: idiomWhere,
            orderBy: { idiom: 'asc' }
        });

        // SRS 카드 정보 매핑
        const srsCardMap = new Map(srsCards.map(card => [card.itemId, card]));

        const processedItems = idioms.map(idiom => ({
            id: idiom.id,
            idiom: idiom.idiom,
            korean_meaning: idiom.korean_meaning,
            usage_context_korean: idiom.usage_context_korean,
            category: idiom.category,
            koChirpScript: idiom.koChirpScript,
            audio: {
                word: idiom.audioWord,
                gloss: idiom.audioGloss,
                example: idiom.audioExample
            },
            example: idiom.example_sentence,
            koExample: idiom.ko_example_sentence,
            srsCard: srsCardMap.get(idiom.id) || null
        }));

        return res.json({ data: processedItems });
    } catch (error) {
        console.error('GET /my-idioms failed:', error);
        return res.status(500).json({ error: 'Failed to load idioms' });
    }
});

// POST /my-idioms/add - 숙어를 내 컬렉션에 추가
router.post('/add', async (req, res) => {
    try {
        const { idiomId } = req.body;
        if (!idiomId) {
            return res.status(400).json({ error: 'idiomId is required' });
        }

        const userId = req.user.id;
        const id = parseInt(idiomId);

        // 숙어가 존재하는지 확인
        const idiom = await prisma.idiom.findUnique({
            where: { id }
        });

        if (!idiom) {
            return res.status(404).json({ error: 'Idiom not found' });
        }

        // 이미 SRS 카드가 있는지 확인
        const existingCard = await prisma.srscard.findFirst({
            where: {
                userId,
                itemType: 'idiom',
                itemId: id
            }
        });

        if (existingCard) {
            return res.status(200).json({ 
                data: { idiomId: id }, 
                meta: { already: true } 
            });
        }

        // 새로운 SRS 카드 생성 (폴더 없이)
        const cardIds = await ensureCardsForIdioms(userId, [id]);

        return res.json({ 
            data: { idiomId: id, cardId: cardIds[0] },
            meta: { created: true }
        });
    } catch (error) {
        console.error('POST /my-idioms/add failed:', error);
        return res.status(500).json({ error: 'Failed to add idiom' });
    }
});

// DELETE /my-idioms/:idiomId - 숙어를 내 컬렉션에서 제거
router.delete('/:idiomId', async (req, res) => {
    try {
        const idiomId = parseInt(req.params.idiomId);
        const userId = req.user.id;

        // 해당 숙어의 모든 SRS 카드 삭제
        const deletedCards = await prisma.srscard.deleteMany({
            where: {
                userId,
                itemType: 'idiom',
                itemId: idiomId
            }
        });

        if (deletedCards.count === 0) {
            return res.status(404).json({ error: 'Idiom not found in your collection' });
        }

        return res.json({ 
            data: { idiomId, deletedCards: deletedCards.count },
            meta: { removed: true }
        });
    } catch (error) {
        console.error(`DELETE /my-idioms/${req.params.idiomId} failed:`, error);
        return res.status(500).json({ error: 'Failed to remove idiom' });
    }
});

// POST /my-idioms/create-folder - 숙어/구동사 학습 폴더 생성
router.post('/create-folder', async (req, res) => {
    try {
        const { 
            folderName, 
            idiomIds, 
            category, // '숙어' 또는 '구동사' 필터
            learningCurveType = 'long' 
        } = req.body;

        if (!folderName) {
            return res.status(400).json({ error: 'folderName is required' });
        }

        const userId = req.user.id;
        let selectedIdiomIds = [];

        if (idiomIds && Array.isArray(idiomIds)) {
            // 특정 숙어 ID들로 폴더 생성
            selectedIdiomIds = idiomIds.map(id => parseInt(id));
        } else if (category) {
            // 카테고리별 자동 선택
            const idioms = await prisma.idiom.findMany({
                where: { 
                    category: { contains: category } 
                },
                select: { id: true }
            });
            selectedIdiomIds = idioms.map(idiom => idiom.id);
        } else {
            return res.status(400).json({ 
                error: 'Either idiomIds or category must be provided' 
            });
        }

        if (selectedIdiomIds.length === 0) {
            return res.status(400).json({ error: 'No idioms found to add to folder' });
        }

        // 숙어 학습 폴더 생성
        const folder = await createManualIdiomFolder(
            userId, 
            folderName, 
            selectedIdiomIds, 
            learningCurveType
        );

        return res.json({ 
            data: { 
                folder,
                idiomCount: selectedIdiomIds.length 
            },
            meta: { created: true }
        });
    } catch (error) {
        console.error('POST /my-idioms/create-folder failed:', error);
        return res.status(500).json({ error: 'Failed to create idiom folder' });
    }
});

// POST /my-idioms/add-to-folder - 기존 폴더에 숙어 추가 (분리 규칙 적용)
router.post('/add-to-folder', async (req, res) => {
    try {
        const { folderId, idiomIds } = req.body;

        if (!folderId || !idiomIds || !Array.isArray(idiomIds)) {
            return res.status(400).json({ 
                error: 'folderId and idiomIds array are required' 
            });
        }

        const userId = req.user.id;
        const selectedIdiomIds = idiomIds.map(id => parseInt(id));

        // 폴더 콘텐츠 타입 검증 (vocab과 idiom 분리)
        await validateFolderContentType(folderId, 'idiom');

        // 숙어 카드 생성
        const cardIds = await ensureCardsForIdioms(userId, selectedIdiomIds, folderId);

        // 폴더에 추가 (idiom 타입으로)
        await addItemsToFolder(userId, folderId, cardIds, 'idiom');

        return res.json({ 
            data: { 
                folderId, 
                addedCount: cardIds.length 
            },
            meta: { added: true }
        });
    } catch (error) {
        console.error('POST /my-idioms/add-to-folder failed:', error);
        
        // 분리 규칙 위반 에러 처리
        if (error.status === 400) {
            return res.status(400).json({ error: error.message });
        }
        
        return res.status(500).json({ error: 'Failed to add idioms to folder' });
    }
});

module.exports = router;