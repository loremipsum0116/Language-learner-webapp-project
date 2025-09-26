const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function exploreJlptData() {
  console.log('🔍 JLPT 데이터 구조 탐색 시작...\n');

  try {
    // 1. dictentry에서 audioUrl이 있는 항목들 조회
    console.log('1. dictentry 테이블의 audioUrl 패턴 조사...');
    const audioUrlSamples = await prisma.dictentry.findMany({
      where: {
        audioUrl: {
          not: null
        }
      },
      select: {
        id: true,
        audioUrl: true,
        vocab: {
          select: {
            lemma: true,
            levelJLPT: true
          }
        }
      },
      take: 20
    });

    console.log('audioUrl 샘플들:');
    audioUrlSamples.forEach(entry => {
      console.log(`- ${entry.vocab.lemma} (JLPT: ${entry.vocab.levelJLPT}): ${entry.audioUrl}`);
    });

    // 2. JLPT 레벨이 있는 vocab 조회
    console.log('\n2. JLPT 레벨이 있는 vocab 조사...');
    const jlptVocabs = await prisma.vocab.findMany({
      where: {
        levelJLPT: {
          not: null
        }
      },
      include: {
        dictentry: {
          select: {
            audioUrl: true,
            audioLocal: true
          }
        }
      },
      take: 10
    });

    console.log('JLPT vocab 샘플들:');
    jlptVocabs.forEach(vocab => {
      console.log(`- ${vocab.lemma} (${vocab.levelJLPT}): audioUrl=${vocab.dictentry?.audioUrl}, audioLocal=${vocab.dictentry?.audioLocal}`);
    });

    // 3. examcategory에서 JLPT 관련 카테고리 조회
    console.log('\n3. examcategory에서 JLPT 관련 항목 조사...');
    const jlptCategories = await prisma.examcategory.findMany({
      where: {
        name: {
          contains: 'JLPT'
        }
      }
    });

    console.log('JLPT 시험 카테고리들:');
    jlptCategories.forEach(cat => {
      console.log(`- ${cat.name} (ID: ${cat.id})`);
    });

    // 4. vocabexamcategory를 통해 JLPT 단어들 조회
    if (jlptCategories.length > 0) {
      console.log('\n4. JLPT 카테고리에 속한 vocab들 조사...');
      const jlptVocabsFromCategory = await prisma.vocabexamcategory.findMany({
        where: {
          examCategoryId: {
            in: jlptCategories.map(cat => cat.id)
          }
        },
        include: {
          vocab: {
            include: {
              dictentry: {
                select: {
                  audioUrl: true,
                  audioLocal: true
                }
              }
            }
          },
          examCategory: true
        },
        take: 10
      });

      console.log('JLPT 카테고리 vocab들:');
      jlptVocabsFromCategory.forEach(item => {
        console.log(`- ${item.vocab.lemma} (${item.examCategory.name}): audioUrl=${item.vocab.dictentry?.audioUrl}`);
      });
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 스크립트 실행
if (require.main === module) {
  exploreJlptData()
    .then(() => {
      console.log('\n✅ 탐색 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 탐색 실패:', error);
      process.exit(1);
    });
}