const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkIdioms() {
  console.log('🔍 숙어와 구동사를 확인합니다...\n');
  
  // 공백이 포함된 단어들 (숙어/구동사) 확인
  const idioms = await prisma.vocab.findMany({
    where: {
      lemma: {
        contains: ' '
      }
    },
    take: 20,
    orderBy: {
      lemma: 'asc'
    }
  });
  
  console.log('공백 포함 단어들 (숙어/구동사):');
  idioms.forEach(item => {
    console.log(`- ${item.lemma} (${item.levelCEFR || 'No level'})`);
  });
  
  const totalIdioms = await prisma.vocab.count({
    where: {
      lemma: {
        contains: ' '
      }
    }
  });
  
  console.log(`\n총 숙어/구동사 개수: ${totalIdioms}개`);
  
  // 레벨별 분포도 확인
  console.log('\n레벨별 분포:');
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1'];
  for (const level of levels) {
    const count = await prisma.vocab.count({
      where: {
        lemma: {
          contains: ' '
        },
        levelCEFR: level
      }
    });
    console.log(`${level}: ${count}개`);
  }
  
  await prisma.$disconnect();
}

checkIdioms().catch(console.error);