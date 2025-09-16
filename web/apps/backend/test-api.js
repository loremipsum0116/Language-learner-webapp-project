const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testAPI() {
  console.log('=== API 테스트: 구동사 조회 ===');

  // 1. 구동사 직접 조회 (프론트엔드에서 사용하는 쿼리와 동일)
  const phrasalVerbs = await prisma.vocab.findMany({
    where: {
      pos: 'phrasal verb',
      source: 'idiom_migration'
    },
    include: {
      dictentry: true,
      translations: {
        include: {
          language: true
        }
      }
    },
    orderBy: {
      lemma: 'asc'
    },
    take: 10
  });

  console.log(`\n1. 구동사 조회 결과: ${phrasalVerbs.length}개`);
  phrasalVerbs.forEach((item, index) => {
    console.log(`  ${index + 1}. "${item.lemma}" (ID: ${item.id})`);
  });

  // 2. 전체 구동사 개수 확인
  const totalCount = await prisma.vocab.count({
    where: {
      pos: 'phrasal verb',
      source: 'idiom_migration'
    }
  });

  console.log(`\n2. 전체 구동사 개수: ${totalCount}개`);

  // 3. 숙어 개수도 확인
  const idiomCount = await prisma.vocab.count({
    where: {
      pos: 'idiom',
      source: 'idiom_migration'
    }
  });

  console.log(`3. 전체 숙어 개수: ${idiomCount}개`);

  // 4. simple-vocab API 로직 시뮬레이션
  console.log('\n=== simple-vocab API 로직 시뮬레이션 ===');

  const pos = 'phrasal verb';
  const search = '';

  const whereClause = {
    pos: pos,
    ...(search && {
      OR: [
        { lemma: { contains: search, mode: 'insensitive' } },
        { translations: { some: { text: { contains: search, mode: 'insensitive' } } } }
      ]
    })
  };

  console.log('4. Where 절:', JSON.stringify(whereClause, null, 2));

  const apiResult = await prisma.vocab.findMany({
    where: whereClause,
    include: {
      dictentry: true,
      translations: {
        include: {
          language: true
        }
      }
    },
    orderBy: { lemma: 'asc' },
    take: 1000
  });

  console.log(`5. API 시뮬레이션 결과: ${apiResult.length}개`);
}

testAPI()
  .catch((e) => {
    console.error('Error:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });