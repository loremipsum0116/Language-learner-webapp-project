// services/quizService.js
const { prisma } = require('../lib/prismaClient');

/**
 * 주어진 vocabId 배열로 4지선다 문제 세트 반환
 * @param {number[]} vocabIds
 * @returns {Promise<Array<{question: string, choices: string[], answer: number, cardId: number}>>}
 */
async function generateMcqQuizItems(vocabIds) {
  // ① 단어 / 뜻 조회
  const vocabs = await prisma.vocab.findMany({
    where: { id: { in: vocabIds } },
    select: { id: true, lemma: true, definition: true }
  });

  // ② Distractor(오답)용 후보 추출
  const pool = await prisma.vocab.findMany({
    where: { levelCEFR: { in: ['A1', 'A2', 'B1'] } },
    take: 4 * vocabIds.length
  });

  // ③ 각 문제 구성
  return vocabs.map(v => {
    // 정답 + 오답 3개
    const distractors = pool
      .filter(p => p.id !== v.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(d => d.definition);

    const choices = [...distractors, v.definition].sort(() => Math.random() - 0.5);
    const answer = choices.indexOf(v.definition);

    return {
      question: v.lemma,
      choices,
      answer,
      cardId: v.id        // 또는 SRSCard id
    };
  });
}

module.exports = { generateMcqQuizItems };
