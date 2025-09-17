const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function investigateJapaneseExamples() {
  try {
    console.log('🔍 Investigating Japanese word examples...\n');

    // 1. First, let's find the Japanese language ID
    const japaneseLanguage = await prisma.language.findUnique({
      where: { code: 'ja' }
    });

    if (!japaneseLanguage) {
      console.log('❌ Japanese language (code: ja) not found in database');
      return;
    }

    console.log('✅ Japanese language found:', japaneseLanguage);
    console.log('');

    // 2. Check for the specific word "あげる"
    console.log('🔎 Searching for "あげる"...');
    const ageruVocab = await prisma.vocab.findFirst({
      where: {
        lemma: 'あげる',
        source: 'jlpt_vocabs'
      },
      include: {
        dictentry: true,
        translations: {
          include: {
            language: true
          }
        },
        language: true
      }
    });

    if (!ageruVocab) {
      console.log('❌ Word "あげる" not found with source "jlpt_vocabs"');

      // Try without source filter
      const ageruAnySource = await prisma.vocab.findMany({
        where: {
          lemma: 'あげる'
        },
        include: {
          dictentry: true,
          translations: {
            include: {
              language: true
            }
          },
          language: true
        }
      });

      if (ageruAnySource.length > 0) {
        console.log(`Found ${ageruAnySource.length} instances of "あげる" with different sources:`);
        ageruAnySource.forEach((vocab, index) => {
          console.log(`  ${index + 1}. Source: ${vocab.source}, Language: ${vocab.language?.code}, ID: ${vocab.id}`);
        });
      } else {
        console.log('❌ Word "あげる" not found at all in vocab table');
      }
      return;
    }

    console.log('✅ Found "あげる":', {
      id: ageruVocab.id,
      lemma: ageruVocab.lemma,
      pos: ageruVocab.pos,
      source: ageruVocab.source,
      languageId: ageruVocab.languageId,
      languageCode: ageruVocab.language?.code
    });

    // 3. Check dictentry for examples
    if (ageruVocab.dictentry) {
      console.log('\n📖 Dictionary entry found:');
      console.log('- Examples field type:', typeof ageruVocab.dictentry.examples);
      console.log('- Examples content:', JSON.stringify(ageruVocab.dictentry.examples, null, 2));

      if (ageruVocab.dictentry.examples && typeof ageruVocab.dictentry.examples === 'object') {
        const examples = ageruVocab.dictentry.examples;
        if (Array.isArray(examples)) {
          console.log(`- Examples array length: ${examples.length}`);
        } else {
          console.log('- Examples structure:', Object.keys(examples));
        }
      }
    } else {
      console.log('\n❌ No dictionary entry found for "あげる"');
    }

    // 4. Check translations
    if (ageruVocab.translations && ageruVocab.translations.length > 0) {
      console.log('\n🌐 Translations found:');
      ageruVocab.translations.forEach((translation, index) => {
        console.log(`  ${index + 1}. Language: ${translation.language.code} (${translation.language.name})`);
        console.log(`     Translation: ${translation.translation}`);
        console.log(`     Definition: ${translation.definition || 'N/A'}`);
        console.log(`     Examples: ${translation.examples ? JSON.stringify(translation.examples, null, 2) : 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('\n❌ No translations found for "あげる"');
    }

    // 5. Check a few other Japanese words for comparison
    console.log('\n🔍 Checking other Japanese words for comparison...');
    const otherJapaneseWords = await prisma.vocab.findMany({
      where: {
        languageId: japaneseLanguage.id,
        source: 'jlpt_vocabs'
      },
      take: 5,
      include: {
        dictentry: true,
        translations: {
          include: {
            language: true
          }
        }
      }
    });

    console.log(`Found ${otherJapaneseWords.length} other Japanese words:`);
    otherJapaneseWords.forEach((vocab, index) => {
      console.log(`\n${index + 1}. Word: "${vocab.lemma}" (ID: ${vocab.id})`);
      console.log(`   - Has dictentry: ${vocab.dictentry ? 'Yes' : 'No'}`);
      if (vocab.dictentry) {
        const examples = vocab.dictentry.examples;
        if (examples) {
          if (Array.isArray(examples)) {
            console.log(`   - Examples count: ${examples.length}`);
          } else {
            console.log(`   - Examples type: ${typeof examples}`);
          }
        } else {
          console.log(`   - Examples: null/undefined`);
        }
      }
      console.log(`   - Translations count: ${vocab.translations.length}`);
    });

    // 6. Check total counts for Japanese
    const totalJapaneseVocabs = await prisma.vocab.count({
      where: {
        languageId: japaneseLanguage.id
      }
    });

    const japaneseWithDictentries = await prisma.vocab.count({
      where: {
        languageId: japaneseLanguage.id,
        dictentry: {
          isNot: null
        }
      }
    });

    const japaneseWithTranslations = await prisma.vocab.count({
      where: {
        languageId: japaneseLanguage.id,
        translations: {
          some: {}
        }
      }
    });

    console.log('\n📊 Japanese vocabulary statistics:');
    console.log(`- Total Japanese vocabs: ${totalJapaneseVocabs}`);
    console.log(`- With dictionary entries: ${japaneseWithDictentries}`);
    console.log(`- With translations: ${japaneseWithTranslations}`);

  } catch (error) {
    console.error('❌ Investigation failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

investigateJapaneseExamples();