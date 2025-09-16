const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanJapaneseVocabs() {
  try {
    console.log('🧹 일본어 어휘 데이터 정리 시작...');

    // Get Japanese language
    const japaneseLanguage = await prisma.language.findUnique({
      where: { code: 'ja' }
    });

    if (!japaneseLanguage) {
      console.log('❌ 일본어 언어 설정을 찾을 수 없습니다.');
      return;
    }

    console.log(`📋 일본어 언어 ID: ${japaneseLanguage.id}`);

    // Get all Japanese vocabs
    const japaneseVocabs = await prisma.vocab.findMany({
      where: { languageId: japaneseLanguage.id },
      select: { id: true }
    });

    console.log(`📊 삭제할 일본어 어휘: ${japaneseVocabs.length}개`);

    if (japaneseVocabs.length === 0) {
      console.log('삭제할 일본어 어휘가 없습니다.');
      return;
    }

    const vocabIds = japaneseVocabs.map(v => v.id);

    // Delete related data first
    console.log('🗑️  관련 데이터 삭제 중...');

    // Delete dictionary entries
    const deletedDictentries = await prisma.dictentry.deleteMany({
      where: { vocabId: { in: vocabIds } }
    });
    console.log(`   - 사전 항목: ${deletedDictentries.count}개 삭제`);

    // Delete translations
    const deletedTranslations = await prisma.vocabTranslation.deleteMany({
      where: { vocabId: { in: vocabIds } }
    });
    console.log(`   - 번역: ${deletedTranslations.count}개 삭제`);

    // Delete vocab entries
    const deletedVocabs = await prisma.vocab.deleteMany({
      where: { languageId: japaneseLanguage.id }
    });
    console.log(`   - 어휘: ${deletedVocabs.count}개 삭제`);

    console.log('✅ 일본어 어휘 데이터 정리 완료!');

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanJapaneseVocabs();