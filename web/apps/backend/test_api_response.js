const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testApiResponse() {
  try {
    console.log('🧪 프론트엔드 API 응답 시뮬레이션 테스트');

    // API와 동일한 방식으로 데이터 조회 (실제 API 코드 복사)
    const wrongAnswers = await prisma.wronganswer.findMany({
      where: {
        userId: 1, // 테스트용 사용자 ID
        isCompleted: false,
        itemType: 'grammar'
      },
      include: {
        vocab: {
          include: {
            translations: {
              include: { language: true }
            }
          }
        }
      },
      orderBy: { wrongAt: 'desc' }
    });

    console.log(`\n✅ 총 ${wrongAnswers.length}개의 문법 오답 발견\n`);

    // detectLanguage 함수 시뮬레이션
    const detectLanguage = (wrongAnswer) => {
      console.log(`🔍 detectLanguage 함수 실행:`);
      console.log(`   - selectedTab: "grammar"`);
      console.log(`   - wrongAnswer.wrongData:`, wrongAnswer.wrongData ? 'exists' : 'null');

      if (wrongAnswer.wrongData) {
        console.log(`   - wrongData.language:`, wrongAnswer.wrongData.language || 'undefined');

        // 첫 번째 조건: language === 'ja'
        if (wrongAnswer.wrongData.language === 'ja') {
          console.log(`   ✅ 조건 1: language === 'ja' → 'ja' 반환`);
          return 'ja';
        }

        // 두 번째 조건: 일본어 문자 검사
        const hasJapaneseChars = wrongAnswer.wrongData.question && /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(wrongAnswer.wrongData.question);
        console.log(`   - 문제 텍스트:`, wrongAnswer.wrongData.question ? wrongAnswer.wrongData.question.substring(0, 50) + '...' : 'null');
        console.log(`   - 일본어 문자 포함:`, hasJapaneseChars);

        if (hasJapaneseChars) {
          console.log(`   ✅ 조건 2: 일본어 문자 포함 → 'ja' 반환`);
          return 'ja';
        }

        console.log(`   ➡️ 기본값: 'en' 반환`);
        return 'en';
      }

      console.log(`   ➡️ wrongData 없음: 'en' 반환`);
      return 'en';
    };

    wrongAnswers.forEach((wa, index) => {
      console.log(`\n=== ${index + 1}번째 오답 분석 ===`);
      console.log(`ID: ${wa.id}`);
      console.log(`오답 시각: ${wa.wrongAt}`);

      const detectedLanguage = detectLanguage(wa);
      console.log(`📊 최종 감지된 언어: ${detectedLanguage}`);

      // 필터링 시뮬레이션
      console.log(`\n🎯 언어별 필터링 결과:`);
      console.log(`   - selectedLanguage="all": ${true ? '표시됨' : '숨김'}`);
      console.log(`   - selectedLanguage="en": ${detectedLanguage === 'en' ? '표시됨' : '숨김'}`);
      console.log(`   - selectedLanguage="ja": ${detectedLanguage === 'ja' ? '표시됨' : '숨김'}`);
    });

  } catch (error) {
    console.error('❌ 테스트 실행 오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testApiResponse();