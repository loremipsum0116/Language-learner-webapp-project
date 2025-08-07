/**
 * server/routes/quiz.js
 *
 * [수정 사항]
 * 1. POST /by-vocab 라우트 추가: 특정 단어 ID들로 퀴즈를 생성하는 API
 * 2. 퀴즈 정답 처리 로직 유지
 */
const { ok, fail } = require('../lib/resp');
const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');
const { generateMcqQuizItems } = require('../services/quizService');

// 헬퍼 함수들은 이전과 동일하게 파일 상단에 위치해야 합니다.
// function shuffleArray(array) {
//     for (let i = array.length - 1; i > 0; i--) {
//         const j = Math.floor(Math.random() * (i + 1));
//         [array[i], array[j]] = [array[j], array[i]];
//     }
//     return array;
// }

// async function generateMcqQuizItems(prisma, userId, vocabIds) {
//     if (!vocabIds || vocabIds.length === 0) return [];
//     const ids = vocabIds.map(Number).filter(Number.isFinite);
//     if (ids.length === 0) return [];

//     const [vocabs, cards, distractorPool] = await Promise.all([
//         prisma.vocab.findMany({ where: { id: { in: ids } }, include: { dictMeta: true } }),
//         prisma.sRSCard.findMany({ where: { userId, itemType: 'vocab', itemId: { in: ids } }, select: { id: true, itemId: true } }),
//         prisma.vocab.findMany({ where: { id: { notIn: ids }, dictMeta: { isNot: null } }, include: { dictMeta: true }, take: 500 }),
//     ]);

//     const cardIdMap = new Map(cards.map(c => [c.itemId, c.id]));
//     const distractorGlosses = new Set();
//     distractorPool.forEach(v => {
//         const examples = Array.isArray(v.dictMeta?.examples) ? v.dictMeta.examples : [];
//         const glossEntry = examples.find(ex => ex.kind === 'gloss' && ex.ko) || examples.find(ex => ex.definitions?.[0]?.ko_def);
//         let gloss = glossEntry?.ko || glossEntry?.definitions?.[0]?.ko_def;
//         if (gloss) distractorGlosses.add(gloss.split(';')[0].split(',')[0].trim());
//     });

//     const pickN = (arr, n) => [...arr].sort(() => 0.5 - Math.random()).slice(0, n);

//     const quizItems = [];
//     for (const vocab of vocabs) {
//         if (!vocab.dictMeta) continue;
//         const examples = Array.isArray(vocab.dictMeta.examples) ? vocab.dictMeta.examples : [];
//         const glossEntry = examples.find(ex => ex.kind === 'gloss' && ex.ko) || examples.find(ex => ex.definitions?.[0]?.ko_def);
//         const correct = glossEntry?.ko || glossEntry?.definitions?.[0]?.ko_def;
//         if (!correct) continue;

//         const localDistractors = new Set(distractorGlosses);
//         localDistractors.delete(correct);
//         const wrongOptions = pickN(Array.from(localDistractors), 3);
//         const options = [correct, ...wrongOptions];
//         while (options.length < 4) options.push("관련 없는 뜻");

//         quizItems.push({
//             cardId: cardIdMap.get(vocab.id) || null,
//             vocabId: vocab.id,
//             question: vocab.lemma,
//             answer: correct,
//             quizType: 'mcq',
//             options: shuffleArray(options),
//             pron: { ipa: vocab.dictMeta.ipa, ipaKo: vocab.dictMeta.ipaKo },
//         });
//     }
//     return quizItems;
// }

// ✅ [수정] 이 라우트가 404 에러를 해결합니다.
router.post('/by-vocab', async (req, res) => {
    try {
        const { vocabIds } = req.body || {};
        if (!Array.isArray(vocabIds)) {
            return fail(res, 400, 'vocabIds must be an array');
        }
        // 헬퍼 함수를 호출하여 퀴즈 생성
        const items = await generateMcqQuizItems(prisma, req.user.id, vocabIds);
        return ok(res, items);
    } catch (e) {
        console.error('POST /quiz/by-vocab Error:', e);
        return fail(res, 500, 'Internal Server Error');
    }
});


// POST /quiz/answer
router.post('/answer', async (req, res) => {
    try {
        const { cardId, correct } = req.body;
        // ... (입력값 검증 및 카드 소유권 확인 로직) ...
        const card = await prisma.sRSCard.findUnique({ where: { id: Number(cardId) } });
        if (!card || card.userId !== req.user.id) {
            return fail(res, 403, 'Not your card');
        }

        let newStage = card.stage;
        let newActiveState = card.active;
        let nextReviewAt;

        const intervalByStage = (stage) => [1, 3, 7, 16, 35][Math.min(stage, 4)] || 35;

        if (correct) {
            newStage = card.stage + 1;
            nextReviewAt = dayjs().add(intervalByStage(newStage), 'day').toDate();
            if (newStage >= 4) { // Max stage
                newActiveState = false;
            }
        } else {
            newStage = 0; // 스테이지 초기화
            // ★★★ 틀렸을 경우, 다음 복습일은 무조건 '내일'로 설정 ★★★
            nextReviewAt = dayjs().add(1, 'day').startOf('day').toDate();
        }

        await prisma.sRSCard.update({
            where: { id: card.id },
            data: {
                stage: newStage,
                active: newActiveState,
                lastResult: correct ? 'pass' : 'fail',
                nextReviewAt: nextReviewAt, // 수정된 복습일 적용
                correctCount: { increment: correct ? 1 : 0 },
                incorrectCount: { increment: correct ? 0 : 1 },
                // updatedAt은 자동으로 갱신됨
            }
        });

        return ok(res, { ok: true, nextStage: newStage, graduated: !newActiveState });
    } catch (e) {
        console.error('POST /quiz/answer error:', e);
        return fail(res, 500, 'Server error while processing answer');
    }
});

module.exports = router;
