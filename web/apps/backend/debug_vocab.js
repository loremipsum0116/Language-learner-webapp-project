const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkVocabWrongAnswers() {
  try {
    console.log('📊 어휘 오답 데이터 조회 중...');

    const vocabWrongAnswers = await prisma.wronganswer.findMany({
      where: {
        itemType: 'vocab'
      },
      include: {
        vocab: true
      },
      orderBy: {
        wrongAt: 'desc'
      },
      take: 10
    });

    console.log(`\n✅ 총 ${vocabWrongAnswers.length}개의 어휘 오답 발견\n`);

    vocabWrongAnswers.forEach((wa, index) => {
      console.log(`\n${index + 1}. 오답 ID: ${wa.id}`);
      console.log(`   - 오답 시각: ${wa.wrongAt}`);
      console.log(`   - attempts: ${wa.attempts}`);
      console.log(`   - itemId: ${wa.itemId}`);
      console.log(`   - wrongData:`, wa.wrongData);

      if (wa.wrongData) {
        console.log(`   - question:`, wa.wrongData.question || '없음');
        console.log(`   - answer:`, wa.wrongData.answer || '없음');
        console.log(`   - userAnswer:`, wa.wrongData.userAnswer || '없음');
        console.log(`   - quizType:`, wa.wrongData.quizType || '없음');
      }

      console.log('   ---');
    });

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkVocabWrongAnswers();