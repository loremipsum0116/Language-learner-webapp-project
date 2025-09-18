const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkReadingData() {
  try {
    console.log('📊 Reading 테이블 데이터 확인 중...');

    // 전체 카운트
    const totalCount = await prisma.reading.count();
    console.log(`📋 총 reading 데이터 개수: ${totalCount}개`);

    // 레벨별 카운트
    const levelCounts = await prisma.reading.groupBy({
      by: ['levelCEFR'],
      _count: {
        id: true
      }
    });

    console.log('\n📖 레벨별 데이터 개수:');
    levelCounts.forEach(level => {
      console.log(`  ${level.levelCEFR}: ${level._count.id}개`);
    });

    // 각 레벨에서 샘플 데이터 확인
    console.log('\n🔍 각 레벨 샘플 데이터:');
    for (const levelData of levelCounts) {
      const level = levelData.levelCEFR;
      const sample = await prisma.reading.findFirst({
        where: { levelCEFR: level },
        select: {
          id: true,
          title: true,
          body: true,
          glosses: true
        }
      });

      if (sample) {
        console.log(`\n📚 ${level} 샘플:`);
        console.log(`  ID: ${sample.id}`);
        console.log(`  Title: ${sample.title}`);
        console.log(`  Body 길이: ${sample.body.length}자`);
        console.log(`  Body 미리보기: ${sample.body.substring(0, 100)}...`);

        if (sample.glosses && typeof sample.glosses === 'object') {
          console.log(`  Glosses 구조:`, Object.keys(sample.glosses));
          if (sample.glosses.question) {
            console.log(`  Question: ${sample.glosses.question.substring(0, 50)}...`);
          }
        }
      }
    }

    // 중복 확인
    console.log('\n🔄 중복 데이터 확인:');
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

    if (duplicates.length > 0) {
      console.log(`⚠️  중복된 제목이 ${duplicates.length}개 발견됨:`);
      duplicates.slice(0, 5).forEach(dup => {
        console.log(`  "${dup.title}": ${dup._count.id}개`);
      });
    } else {
      console.log('✅ 중복 데이터 없음');
    }

  } catch (error) {
    console.error('❌ 데이터 확인 중 오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkReadingData();