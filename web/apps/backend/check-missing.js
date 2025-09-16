const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function findMissingVocabs() {
  try {
    // JSON 파일 읽기
    const jsonData = JSON.parse(fs.readFileSync('jlpt_n5_vocabs.json', 'utf-8'));
    console.log('JSON file has', jsonData.length, 'items');

    // DB에서 일본어 어휘 가져오기
    const japaneseLanguage = await prisma.language.findUnique({ where: { code: 'ja' } });
    const dbVocabs = await prisma.vocab.findMany({
      where: { languageId: japaneseLanguage.id },
      select: { lemma: true, pos: true }
    });

    console.log('DB has', dbVocabs.length, 'items');

    // JSON에는 있지만 DB에는 없는 항목 찾기
    const dbVocabSet = new Set(dbVocabs.map(v => `${v.lemma}|${v.pos}`));
    const missing = jsonData.filter(item => !dbVocabSet.has(`${item.lemma}|${item.pos}`));

    console.log('Missing vocabs:', missing.length);
    missing.forEach(item => {
      console.log(`- ${item.lemma} (${item.pos})`);
    });

    // JSON에 중복이 있는지 확인
    const jsonSet = new Set();
    const jsonDuplicates = [];
    jsonData.forEach(item => {
      const key = `${item.lemma}|${item.pos}`;
      if (jsonSet.has(key)) {
        jsonDuplicates.push(item);
      } else {
        jsonSet.add(key);
      }
    });

    console.log('JSON duplicates:', jsonDuplicates.length);
    jsonDuplicates.forEach(item => {
      console.log(`- Duplicate: ${item.lemma} (${item.pos})`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findMissingVocabs();