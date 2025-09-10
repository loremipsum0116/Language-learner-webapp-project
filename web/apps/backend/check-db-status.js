const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDbStatus() {
  try {
    console.log('🔍 Checking database status...');
    
    // Check total vocab count
    const totalVocabs = await prisma.vocab.count();
    console.log(`📚 Total vocab items: ${totalVocabs}`);
    
    // Check A1 vocabs with translations
    const a1VocabsWithTranslations = await prisma.vocab.findMany({
      where: {
        language: { code: 'en' },
        levelCEFR: 'A1'
      },
      include: {
        translations: {
          where: { language: { code: 'ko' } }
        },
        dictentry: true
      },
      take: 5
    });
    
    console.log(`🔍 Checking first 5 A1 vocabs:`);
    for (const vocab of a1VocabsWithTranslations) {
      console.log(`- "${vocab.lemma}": ${vocab.translations.length} translations`);
      if (vocab.translations.length > 0) {
        console.log(`  Translation: "${vocab.translations[0].translation}"`);
      }
      if (vocab.dictentry?.koGloss) {
        console.log(`  Dictionary koGloss: "${vocab.dictentry.koGloss}"`);
      }
    }
    
    // Check Korean language
    const koLang = await prisma.language.findUnique({
      where: { code: 'ko' }
    });
    console.log(`🇰🇷 Korean language entry:`, koLang ? 'Found' : 'Not found');
    
    // Check translation counts
    const translationCount = await prisma.vocabTranslation.count({
      where: { language: { code: 'ko' } }
    });
    console.log(`📝 Total Korean translations: ${translationCount}`);
    
  } catch (error) {
    console.error('❌ Database check failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDbStatus();