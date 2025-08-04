// server/tools/seed_grammar.js
require('dotenv').config({ path: '../.env' });
const { PrismaClient } = require('@prisma/client');
const { grammarTopics } = require('../../src/data/mockGrammar.js');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 문법 연습문제(GrammarExercise) 데이터베이스 시딩을 시작합니다...');

  for (const topic of grammarTopics) {
    try {
      const exercise = await prisma.grammarExercise.upsert({
        where: { topicId: topic.id },
        update: {
          topic: topic.title,
          levelCEFR: topic.level,
          items: topic.questions,
        },
        create: {
          topicId: topic.id,
          topic: topic.title,
          levelCEFR: topic.level,
          items: topic.questions,
        },
      });
      console.log(`✅ 처리 완료: ${exercise.topic}`);
    } catch (e) {
      console.error(`❌ 처리 실패: ${topic.title}`, e.message);
    }
  }

  console.log('🌳 문법 시딩 작업이 완료되었습니다.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });