const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function checkPhrasalVerbs() {
  try {
    console.log('🔍 구동사 데이터 확인 중...');

    // 전체 구동사 개수 확인
    const phrasalVerbCount = await prisma.vocab.count({
      where: { source: 'phrasal_verb_migration' }
    });

    console.log(`📊 구동사 총 개수: ${phrasalVerbCount}`);

    // pos로 구분 확인
    const posCount = await prisma.vocab.count({
      where: { pos: 'phrasal_verb' }
    });

    console.log(`📊 pos가 'phrasal_verb'인 단어 개수: ${posCount}`);

    // 샘플 구동사 5개 조회
    const samplePhrasalVerbs = await prisma.vocab.findMany({
      where: { source: 'phrasal_verb_migration' },
      include: {
        translations: {
          include: { language: true }
        }
      },
      take: 5
    });

    console.log('📝 샘플 구동사:');
    samplePhrasalVerbs.forEach((verb, index) => {
      const koreanTranslation = verb.translations.find(t => t.language.code === 'ko');
      console.log(`   ${index + 1}. ${verb.lemma} (pos: ${verb.pos}) - ${koreanTranslation?.translation || 'No translation'}`);
    });

    // API에서 사용하는 쿼리로 테스트
    console.log('\n🧪 API 쿼리 테스트:');
    const posType = 'phrasal verb';
    const dbPos = 'phrasal_verb';
    const dbSource = 'phrasal_verb_migration';

    const testQuery = await prisma.vocab.findMany({
      where: {
        pos: dbPos,
        source: dbSource
      },
      take: 3
    });

    console.log(`   pos: '${dbPos}', source: '${dbSource}' 검색 결과: ${testQuery.length}개`);
    testQuery.forEach((verb, index) => {
      console.log(`   ${index + 1}. ${verb.lemma}`);
    });

  } catch (error) {
    console.error('❌ 에러:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPhrasalVerbs();