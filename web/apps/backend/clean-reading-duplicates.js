const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanReadingDuplicates() {
  try {
    console.log('🧹 Reading 테이블 중복 데이터 정리 시작...');

    // 1. 현재 상태 확인
    const totalCount = await prisma.reading.count();
    console.log(`📊 현재 총 데이터 개수: ${totalCount}개`);

    // 2. 중복 데이터 찾기
    const duplicates = await prisma.reading.groupBy({
      by: ['title'],
      having: {
        id: {
          _count: {
            gt: 1
          }
        }
      },
      _count: {
        id: true
      }
    });

    console.log(`🔍 중복된 제목 개수: ${duplicates.length}개`);

    // 3. 각 중복 제목에 대해 가장 작은 ID만 남기고 나머지 삭제
    let deletedCount = 0;

    for (const duplicate of duplicates) {
      const title = duplicate.title;

      // 해당 제목의 모든 레코드를 ID 순으로 정렬해서 가져오기
      const records = await prisma.reading.findMany({
        where: { title: title },
        orderBy: { id: 'asc' }
      });

      if (records.length > 1) {
        // 첫 번째(가장 작은 ID)를 제외한 나머지 삭제
        const idsToDelete = records.slice(1).map(r => r.id);

        const deleteResult = await prisma.reading.deleteMany({
          where: {
            id: {
              in: idsToDelete
            }
          }
        });

        deletedCount += deleteResult.count;
        console.log(`  🗑️  "${title}": ${idsToDelete.length}개 중복 삭제`);
      }
    }

    console.log(`\n✅ 중복 정리 완료! ${deletedCount}개 데이터 삭제됨`);

    // 4. 정리 후 상태 확인
    const finalCount = await prisma.reading.count();
    console.log(`📋 정리 후 총 데이터 개수: ${finalCount}개`);

    const levelCounts = await prisma.reading.groupBy({
      by: ['levelCEFR'],
      _count: {
        id: true
      }
    });

    console.log('\n📖 정리 후 레벨별 데이터 개수:');
    levelCounts.forEach(level => {
      console.log(`  ${level.levelCEFR}: ${level._count.id}개`);
    });

  } catch (error) {
    console.error('❌ 중복 정리 중 오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanReadingDuplicates();