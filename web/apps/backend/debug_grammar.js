const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkGrammarWrongAnswers() {
  try {
    console.log('📊 문법 오답 데이터 조회 중...');

    const grammarWrongAnswers = await prisma.wronganswer.findMany({
      where: {
        itemType: 'grammar'
      },
      include: {
        vocab: true
      },
      orderBy: {
        wrongAt: 'desc'
      },
      take: 10
    });

    console.log(`\n✅ 총 ${grammarWrongAnswers.length}개의 문법 오답 발견\n`);

    grammarWrongAnswers.forEach((wa, index) => {
      console.log(`\n${index + 1}. 오답 ID: ${wa.id}`);
      console.log(`   - 오답 시각: ${wa.wrongAt}`);
      console.log(`   - wrongData:`, wa.wrongData);

      if (wa.wrongData) {
        console.log(`   - language 필드:`, wa.wrongData.language || '없음');
        console.log(`   - question:`, wa.wrongData.question ? wa.wrongData.question.substring(0, 100) : '없음');
        console.log(`   - topicTitle:`, wa.wrongData.topicTitle || '없음');

        // 일본어 문자 검사
        const hasJapaneseChars = wa.wrongData.question && /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(wa.wrongData.question);
        console.log(`   - 일본어 문자 포함:`, hasJapaneseChars ? '예' : '아니오');

        // detectLanguage 함수 시뮬레이션
        let detectedLanguage = 'en'; // 기본값
        if (wa.wrongData.language === 'ja') {
          detectedLanguage = 'ja';
        } else if (hasJapaneseChars) {
          detectedLanguage = 'ja';
        }
        console.log(`   - 감지된 언어:`, detectedLanguage);
      }

      console.log('   ---');
    });

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkGrammarWrongAnswers();