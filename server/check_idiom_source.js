const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkIdiomSource() {
  console.log('🔍 숙어/구동사의 source 값을 확인합니다...\n');
  
  // 공백 포함 단어들의 source 값 확인
  const idioms = await prisma.vocab.findMany({
    where: {
      lemma: {
        contains: ' '
      }
    },
    take: 10,
    select: {
      id: true,
      lemma: true,
      pos: true,
      source: true,
      levelCEFR: true
    },
    orderBy: {
      lemma: 'asc'
    }
  });
  
  console.log('숙어/구동사 샘플:');
  idioms.forEach(item => {
    console.log(`- ${item.lemma} (${item.levelCEFR || 'No level'}) - pos: "${item.pos}", source: "${item.source}"`);
  });
  
  // 고유한 source 값들 확인
  const uniqueSources = await prisma.vocab.findMany({
    where: {
      lemma: {
        contains: ' '
      }
    },
    select: {
      source: true
    },
    distinct: ['source']
  });
  
  console.log('\n고유한 source 값들:');
  uniqueSources.forEach(item => {
    console.log(`- "${item.source}"`);
  });
  
  // pos별 개수 확인
  const posCounts = await prisma.vocab.groupBy({
    by: ['pos'],
    where: {
      lemma: {
        contains: ' '
      }
    },
    _count: {
      pos: true
    }
  });
  
  console.log('\npos별 숙어/구동사 개수:');
  posCounts.forEach(item => {
    console.log(`- "${item.pos}": ${item._count.pos}개`);
  });
  
  await prisma.$disconnect();
}

checkIdiomSource().catch(console.error);