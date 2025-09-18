const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOrphanData() {
  console.log('=== 고아 데이터 간단 검사 ===\n');

  try {
    // 1. folderId가 null인 wronganswer 확인
    const orphanWrongAnswers = await prisma.wronganswer.count({
      where: { folderId: null }
    });
    console.log(`❌ 고아 wronganswer: ${orphanWrongAnswers}개`);

    // 2. 어떤 폴더에도 속하지 않는 srscard 확인
    const orphanCards = await prisma.srscard.count({
      where: {
        srsfolderitem: { none: {} }
      }
    });
    console.log(`📄 고아 srscard: ${orphanCards}개`);

    // 3. 상세 정보가 필요하면 개수가 0이 아닐 때만 조회
    if (orphanWrongAnswers > 0) {
      console.log('\n=== 고아 wronganswer 상세 ===');
      const wrongAnswers = await prisma.wronganswer.findMany({
        where: { folderId: null },
        select: {
          id: true,
          userId: true,
          itemId: true,
          itemType: true,
          wrongAt: true
        },
        take: 10 // 최대 10개만
      });

      wrongAnswers.forEach((item, index) => {
        console.log(`${index + 1}. ID: ${item.id}, userId: ${item.userId}, itemType: ${item.itemType}, itemId: ${item.itemId}, wrongAt: ${item.wrongAt}`);
      });
    }

    if (orphanCards > 0) {
      console.log('\n=== 고아 srscard 상세 ===');
      const cards = await prisma.srscard.findMany({
        where: {
          srsfolderitem: { none: {} }
        },
        select: {
          id: true,
          userId: true,
          itemType: true,
          itemId: true,
          stage: true
        },
        take: 10 // 최대 10개만
      });

      cards.forEach((item, index) => {
        console.log(`${index + 1}. ID: ${item.id}, userId: ${item.userId}, itemType: ${item.itemType}, itemId: ${item.itemId}, stage: ${item.stage}`);
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