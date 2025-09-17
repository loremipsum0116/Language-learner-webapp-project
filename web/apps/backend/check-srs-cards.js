const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAvailableCards() {
  try {
    console.log('=== SRS 카드 상태 분석 ===');

    const now = new Date();
    console.log('현재 시간:', now.toISOString());

    // 1. 기본 overdue 카드 수
    const overdueCards = await prisma.srscard.count({
      where: {
        userId: 1,
        isOverdue: true
      }
    });
    console.log('1. 기본 overdue 카드 수:', overdueCards);

    // 2. API와 동일한 조건으로 조회
    const cards = await prisma.srscard.findMany({
      where: {
        userId: 1,
        isOverdue: true,
        OR: [
          { overdueDeadline: { gt: now } },
          { overdueDeadline: null }
        ],
        frozenUntil: null
      },
      include: {
        srsfolderitem: {
          include: {
            vocab: {
              select: {
                lemma: true,
                levelJLPT: true
              }
            },
            srsfolder: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    console.log('2. API 조건 만족 카드 수:', cards.length);

    // 3. 고아 카드 필터링
    const validCards = [];
    const orphanCards = [];

    cards.forEach(card => {
      if (!card.srsfolderitem || card.srsfolderitem.length === 0) {
        orphanCards.push({ id: card.id, reason: 'srsfolderitem 없음' });
        return;
      }

      const hasValidFolder = card.srsfolderitem.some(item => item.srsfolder && item.srsfolder.id);
      if (!hasValidFolder) {
        orphanCards.push({ id: card.id, reason: '폴더 없음' });
        return;
      }

      validCards.push(card);
    });

    console.log('3. 유효한 카드 수:', validCards.length);
    console.log('4. 고아 카드 수:', orphanCards.length);

    if (orphanCards.length > 0) {
      console.log('\n=== 고아 카드 목록 ===');
      orphanCards.forEach((orphan, i) => {
        console.log(`${i+1}. 카드 ID ${orphan.id}: ${orphan.reason}`);
      });
    }

    if (validCards.length > 0) {
      console.log('\n=== 유효한 카드 목록 ===');
      validCards.forEach((card, i) => {
        const vocab = card.srsfolderitem[0]?.vocab;
        const folder = card.srsfolderitem[0]?.srsfolder;
        console.log(`${i+1}. 카드 ID ${card.id}: ${vocab?.lemma || 'N/A'} (JLPT: ${vocab?.levelJLPT || 'N/A'}) - 폴더: ${folder?.name || 'N/A'}`);
      });
    }

    // 5. 결론
    console.log('\n=== 결론 ===');
    if (validCards.length === 0 && overdueCards > 0) {
      console.log('❌ 문제 발견: overdue 카드는 있지만 모두 고아 카드입니다.');
      console.log('   → SRS 폴더 시스템에 문제가 있을 수 있습니다.');
    } else if (validCards.length === 0) {
      console.log('✅ 정상: 실제로 복습할 카드가 없습니다.');
    } else {
      console.log(`✅ 정상: ${validCards.length}개의 복습 가능한 카드가 있습니다.`);
      console.log('   → 바탕화면에서 0개로 표시되는 것은 인증 문제일 가능성이 높습니다.');
    }

  } catch (error) {
    console.error('에러:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAvailableCards();