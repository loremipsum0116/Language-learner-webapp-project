const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('=== 숙어·구동사 관련 pos 값 확인 ===');

  // 1. 모든 고유한 pos 값 확인
  const allPosValues = await prisma.vocab.findMany({
    where: {
      source: 'idiom_migration'
    },
    select: {
      pos: true
    },
    distinct: ['pos']
  });

  console.log('\n1. idiom_migration 소스의 모든 pos 값:');
  allPosValues.forEach(item => console.log(`  - "${item.pos}"`));

  // 2. 각 pos별 개수 확인
  const posCount = await prisma.vocab.groupBy({
    by: ['pos'],
    where: {
      source: 'idiom_migration'
    },
    _count: {
      id: true
    }
  });

  console.log('\n2. pos별 개수:');
  posCount.forEach(item => console.log(`  - "${item.pos}": ${item._count.id}개`));

  // 3. phrasal과 관련된 항목들 확인
  const phrasalItems = await prisma.vocab.findMany({
    where: {
      source: 'idiom_migration',
      pos: {
        contains: 'phrasal'
      }
    },
    select: {
      id: true,
      lemma: true,
      pos: true
    },
    take: 5
  });

  console.log('\n3. "phrasal"이 포함된 pos 값의 예시:');
  phrasalItems.forEach(item => console.log(`  - ID: ${item.id}, lemma: "${item.lemma}", pos: "${item.pos}"`));

  // 4. 구동사로 추정되는 항목들 확인 (phrasal verb로 검색)
  const phrasalVerbs = await prisma.vocab.findMany({
    where: {
      source: 'idiom_migration',
      pos: 'phrasal verb'
    },
    select: {
      id: true,
      lemma: true,
      pos: true
    },
    take: 5
  });

  console.log('\n4. pos="phrasal verb"인 항목들 예시:');
  phrasalVerbs.forEach(item => console.log(`  - ID: ${item.id}, lemma: "${item.lemma}", pos: "${item.pos}"`));

  console.log(`\n총 "phrasal verb" 개수: ${phrasalVerbs.length}개`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });