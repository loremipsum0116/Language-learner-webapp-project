const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function testApiLogic() {
  try {
    console.log('🧪 API 로직 테스트 중...');

    // 프론트엔드에서 전송하는 파라미터
    const pos = 'phrasal verb';
    const search = '';

    console.log('📥 입력 파라미터:', { pos, search });

    // vocab.js의 mapping 로직 재현
    const posMapping = {
      'idiom': 'idiom',
      'phrasal verb': 'phrasal_verb'
    };

    const dbPos = posMapping[pos] || pos;
    const dbSource = dbPos === 'phrasal_verb' ? 'phrasal_verb_migration' : 'idiom_migration';

    console.log('🔄 매핑 결과:', { dbPos, dbSource });

    // where 조건 구성
    const where = {
      pos: dbPos,
      source: dbSource
    };

    if (search && search.trim().length > 0) {
      where.lemma = {
        contains: search.trim()
      };
    }

    console.log('🔍 데이터베이스 쿼리 조건:', JSON.stringify(where, null, 2));

    // 실제 쿼리 실행
    const vocabs = await prisma.vocab.findMany({
      where,
      include: {
        translations: {
          include: { language: true }
        },
        dictentry: true
      }
    });

    console.log(`📊 검색 결과: ${vocabs.length}개`);

    if (vocabs.length > 0) {
      console.log('📝 샘플 결과 (첫 3개):');
      vocabs.slice(0, 3).forEach((vocab, index) => {
        const koreanTranslation = vocab.translations.find(t => t.language.code === 'ko');
        console.log(`   ${index + 1}. ${vocab.lemma} - ${koreanTranslation?.translation || 'No translation'}`);
      });
    } else {
      console.log('❌ 검색 결과가 없습니다');
    }

  } catch (error) {
    console.error('❌ 에러:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testApiLogic();