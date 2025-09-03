// server/tools/cleanup_wiki_entries.js
require('dotenv').config({ path: '../.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Wiktionary에서 자동 생성된 단어들을 정리합니다...');

  // 1. 'Internal Seed'가 아닌 DictEntry 항목 찾기
  const entriesToDelete = await prisma.dictEntry.findMany({
    where: {
      NOT: {
        attribution: 'Internal Seed'
      }
    }
  });

  if (entriesToDelete.length === 0) {
    console.log('정리할 단어가 없습니다.');
    return;
  }

  const vocabIdsToDelete = entriesToDelete.map(entry => entry.vocabId);

  // 2. 해당 DictEntry 삭제
  const deletedEntries = await prisma.dictEntry.deleteMany({
    where: {
      vocabId: { in: vocabIdsToDelete }
    }
  });
  console.log(`- ${deletedEntries.count}개의 사전 정보(DictEntry)가 삭제되었습니다.`);

  // 3. 연결된 Vocab 삭제
  const deletedVocabs = await prisma.vocab.deleteMany({
    where: {
      id: { in: vocabIdsToDelete }
    }
  });
  console.log(`- ${deletedVocabs.count}개의 단어(Vocab)가 삭제되었습니다.`);

  console.log('✨ 정리 작업이 완료되었습니다.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });