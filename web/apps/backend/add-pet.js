const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addPetVocab() {
  try {
    // Get Japanese language
    const japaneseLanguage = await prisma.language.findUnique({
      where: { code: 'ja' }
    });

    const koreanLanguage = await prisma.language.findUnique({
      where: { code: 'ko' }
    });

    const englishLanguage = await prisma.language.findUnique({
      where: { code: 'en' }
    });

    // Check if ペット already exists
    const existing = await prisma.vocab.findFirst({
      where: {
        languageId: japaneseLanguage.id,
        lemma: 'ペット',
        pos: 'noun'
      }
    });

    if (existing) {
      console.log('ペット already exists in database:', existing.id);
      return;
    }

    console.log('ペット not found, creating new entry...');

    // Create vocab
    const vocab = await prisma.vocab.create({
      data: {
        languageId: japaneseLanguage.id,
        lemma: 'ペット',
        pos: 'noun',
        levelJLPT: 'N5',
        source: 'jlpt'
      }
    });

    console.log('Created vocab:', vocab);

    // Create Korean translation
    await prisma.vocabTranslation.create({
      data: {
        vocabId: vocab.id,
        languageId: koreanLanguage.id,
        translation: '반려동물, 펫',
        definition: 'ペット. 반려동물이라는 뜻의 명사입니다. ペットをかっていますか. 반려동물을 키우고 있습니까?라는 의미네요.',
        examples: {
          example: '반려동물을 키우고 있습니까?',
          chirpScript: 'ペット. 반려동물이라는 뜻의 명사입니다. ペットをかっていますか. 반려동물을 키우고 있습니까?라는 의미네요.'
        },
        isVerified: true
      }
    });

    // Create dictionary entry
    await prisma.dictentry.create({
      data: {
        vocabId: vocab.id,
        ipa: 'ペット',
        ipaKo: 'petto',
        examples: {
          kana: 'ペット',
          romaji: 'petto',
          kanji: null,
          onyomi: null,
          kunyomi: null,
          example: 'ペットを飼っていますか',
          exampleKana: 'ペットをかっていますか',
          exampleTranslation: null,
          koExample: '반려동물을 키우고 있습니까?'
        },
        audioUrl: null,
        audioLocal: null
      }
    });

    console.log('Successfully added ペット vocab');

  } catch (error) {
    console.error('Error adding ペット:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addPetVocab();