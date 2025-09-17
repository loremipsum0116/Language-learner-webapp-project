const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOrphans() {
  try {
    console.log('\n========== 🔍 고아 데이터 검사 시작 ==========\n');

    // 1. 폴더 확인
    const folders = await prisma.srsfolder.findMany({
      where: { userId: 1 },
      select: { id: true, name: true, parentId: true }
    });
    console.log('📁 남은 폴더:', folders.length + '개');
    if (folders.length > 0) {
      folders.forEach(f => {
        console.log(`   - ID:${f.id} "${f.name}" (parentId: ${f.parentId || 'root'})`);
      });
    }

    // 2. 고아 SRS 카드 확인 (폴더와 연결되지 않은 카드)
    const orphanCards = await prisma.srscard.findMany({
      where: {
        userId: 1,
        srsfolderitem: { none: {} }
      }
    });
    console.log('\n🃏 고아 SRS 카드:', orphanCards.length + '개');
    if (orphanCards.length > 0) {
      // vocab 정보 가져오기
      for (const card of orphanCards) {
        let vocabInfo = 'unknown';
        if (card.itemType === 'vocab' && card.itemId) {
          const vocab = await prisma.vocab.findUnique({
            where: { id: card.itemId },
            select: { lemma: true }
          });
          vocabInfo = vocab?.lemma || 'vocab not found';
        }
        console.log(`   - CardID:${card.id} "${vocabInfo}" (itemType:${card.itemType}, itemId:${card.itemId})`);
      }
    }

    // 3. 고아 폴더-카드 연결 확인 (존재하지 않는 폴더를 참조)
    const folderItems = await prisma.srsfolderitem.findMany({
      include: {
        srsfolder: { select: { id: true, name: true } },
        srscard: { select: { id: true, itemId: true } }
      }
    });
    const orphanItems = folderItems.filter(item => !item.srsfolder || !item.srscard);
    console.log('\n🔗 고아 폴더-카드 연결:', orphanItems.length + '개');
    if (orphanItems.length > 0) {
      orphanItems.forEach(item => {
        console.log(`   - ItemID:${item.id} (folderId:${item.folderId}, cardId:${item.cardId}) - 폴더나 카드가 존재하지 않음`);
      });
    }

    // 4. 고아 오답노트 확인
    const wrongAnswers = await prisma.wronganswer.findMany({
      where: { userId: 1 },
      include: {
        folder: { select: { id: true } },
        vocab: { select: { id: true, lemma: true } }
      }
    });
    const orphanWrong = wrongAnswers.filter(w => (w.folderId && !w.folder) || (w.vocabId && !w.vocab));
    console.log('\n❌ 고아 오답노트:', orphanWrong.length + '개');
    if (orphanWrong.length > 0) {
      orphanWrong.forEach(w => {
        console.log(`   - WrongID:${w.id} (folderId:${w.folderId}, vocabId:${w.vocabId}) - 참조 데이터 없음`);
      });
    }

    // 5. 전체 통계
    const totalCards = await prisma.srscard.count({ where: { userId: 1 } });
    const totalItems = await prisma.srsfolderitem.count();
    const totalWrong = await prisma.wronganswer.count({ where: { userId: 1 } });

    console.log('\n📊 전체 통계:');
    console.log(`   - 전체 SRS 카드: ${totalCards}개`);
    console.log(`   - 전체 폴더-카드 연결: ${totalItems}개`);
    console.log(`   - 전체 오답노트: ${totalWrong}개`);

    // 6. 정합성 검증
    console.log('\n✅ 데이터 정합성 검증:');
    if (folders.length === 0 && totalCards === 0 && totalItems === 0) {
      console.log('   🎉 모든 SRS 데이터가 깨끗하게 삭제되었습니다!');
    } else if (orphanCards.length === 0 && orphanItems.length === 0 && orphanWrong.length === 0) {
      console.log('   ✅ 고아 데이터가 없습니다. 데이터 정합성이 유지되고 있습니다.');
    } else {
      console.log('   ⚠️ 고아 데이터가 발견되었습니다. 정리가 필요합니다.');
    }

    console.log('\n========== 검사 완료 ==========\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkOrphans();