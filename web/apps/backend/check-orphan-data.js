const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOrphanData() {
  console.log('=== 고아 데이터 검사 시작 ===\n');

  try {
    // 1. srsfolderitem은 folderId가 NOT NULL이므로 생략
    console.log('📁 srsfolderitem은 folderId NOT NULL 필드이므로 고아 데이터 없음');

    // 2. folderId가 null인 wronganswer 확인
    const orphanWrongAnswers = await prisma.wronganswer.findMany({
      where: { folderId: null },
      include: {
        vocab: { select: { lemma: true } }
      }
    });

    console.log(`\n❌ 고아 wronganswer: ${orphanWrongAnswers.length}개`);
    if (orphanWrongAnswers.length > 0) {
      console.log('상세:');
      orphanWrongAnswers.forEach((item, index) => {
        console.log(`  ${index + 1}. ID: ${item.id}, vocab: ${item.vocab?.lemma || 'N/A'}, createdAt: ${item.createdAt}`);
      });
    }

    // 3. 어떤 폴더에도 속하지 않는 srscard 확인
    const orphanCards = await prisma.srscard.findMany({
      where: {
        srsfolderitem: { none: {} }
      }
    });

    console.log(`\n📄 고아 srscard: ${orphanCards.length}개`);
    if (orphanCards.length > 0) {
      console.log('상세:');

      // vocab 정보를 별도로 조회
      const vocabCards = orphanCards.filter(card => card.itemType === 'vocab');
      if (vocabCards.length > 0) {
        const vocabIds = vocabCards.map(card => card.itemId);
        const vocabs = await prisma.vocab.findMany({
          where: { id: { in: vocabIds } },
          select: { id: true, lemma: true }
        });

        orphanCards.forEach((item, index) => {
          const vocab = item.itemType === 'vocab' ? vocabs.find(v => v.id === item.itemId) : null;
          console.log(`  ${index + 1}. ID: ${item.id}, itemType: ${item.itemType}, itemId: ${item.itemId}, vocab: ${vocab?.lemma || 'N/A'}, createdAt: ${item.createdAt}`);
        });
      } else {
        orphanCards.forEach((item, index) => {
          console.log(`  ${index + 1}. ID: ${item.id}, itemType: ${item.itemType}, itemId: ${item.itemId}, createdAt: ${item.createdAt}`);
        });
      }
    }

    // 4. 존재하지 않는 folderId를 참조하는 데이터 확인
    const invalidFolderRefs = await prisma.srsfolderitem.findMany({
      where: {
        folderId: { not: null },
        srsfolder: null
      }
    });

    console.log(`\n🔗 잘못된 폴더 참조: ${invalidFolderRefs.length}개`);
    if (invalidFolderRefs.length > 0) {
      console.log('상세:');
      invalidFolderRefs.forEach((item, index) => {
        console.log(`  ${index + 1}. ID: ${item.id}, folderId: ${item.folderId} (존재하지 않음)`);
      });
    }

    console.log('\n=== 검사 완료 ===');

  } catch (error) {
    console.error('검사 중 오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkOrphanData();