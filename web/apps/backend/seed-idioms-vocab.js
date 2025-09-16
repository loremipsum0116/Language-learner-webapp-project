// Idiom seeding script that uses vocab table structure
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const prisma = new PrismaClient();

async function seedIdiomsAsVocab() {
  try {
    console.log('🚀 Starting idiom seeding as vocab...');

    // Read the idiom.json file
    const idiomPath = path.join(__dirname, 'idiom.json');

    if (!fs.existsSync(idiomPath)) {
      console.error('❌ idiom.json not found!');
      return;
    }

    console.log('📖 Reading idiom.json...');
    const rawData = fs.readFileSync(idiomPath, 'utf8');
    const idiomData = JSON.parse(rawData);

    console.log(`📚 Found ${idiomData.length} idiom items`);

    // Get or create English language entry
    console.log('🌐 Setting up language entries...');
    let englishLang = await prisma.language.findUnique({
      where: { code: 'en' }
    });

    if (!englishLang) {
      englishLang = await prisma.language.create({
        data: {
          code: 'en',
          name: 'English',
          nativeName: 'English',
          isActive: true
        }
      });
      console.log('✅ Created English language entry');
    }

    // Get or create Korean language entry
    let koreanLang = await prisma.language.findUnique({
      where: { code: 'ko' }
    });

    if (!koreanLang) {
      koreanLang = await prisma.language.create({
        data: {
          code: 'ko',
          name: 'Korean',
          nativeName: '한국어',
          isActive: true
        }
      });
      console.log('✅ Created Korean language entry');
    }

    // Clear existing idiom and phrasal verb data
    console.log('🧹 Clearing existing idiom and phrasal verb data...');
    const existingData = await prisma.vocab.findMany({
      where: {
        source: { in: ['idiom_migration', 'phrasal_verb_migration'] }
      }
    });

    if (existingData.length > 0) {
      // Delete related translations first
      await prisma.vocabTranslation.deleteMany({
        where: {
          vocabId: { in: existingData.map(v => v.id) }
        }
      });

      // Delete dict entries
      await prisma.dictentry.deleteMany({
        where: {
          vocabId: { in: existingData.map(v => v.id) }
        }
      });

      // Delete vocab entries
      await prisma.vocab.deleteMany({
        where: {
          source: { in: ['idiom_migration', 'phrasal_verb_migration'] }
        }
      });

      console.log(`✅ Cleared ${existingData.length} existing entries`);
    }

    let processed = 0;
    let successful = 0;
    let failed = 0;
    let idiomsCount = 0;
    let phrasalVerbsCount = 0;

    console.log('📝 Processing idioms and phrasal verbs...');

    for (const idiom of idiomData) {
      try {
        processed++;

        if (processed % 100 === 0) {
          console.log(`⏳ Processed ${processed}/${idiomData.length} idioms...`);
        }

        // Determine if it's idiom or phrasal verb based on audio path
        const isPhrasalVerb = idiom.audio?.word?.includes('phrasal_verb/');
        const pos = isPhrasalVerb ? 'phrasal_verb' : 'idiom';
        const source = isPhrasalVerb ? 'phrasal_verb_migration' : 'idiom_migration';

        // Extract level from category field and map to CEFR
        let levelCEFR = 'B1'; // Default level for idioms/phrasal verbs
        if (idiom.category) {
          if (idiom.category.includes('기초')) {
            levelCEFR = 'A2';
          } else if (idiom.category.includes('중급')) {
            levelCEFR = 'B1';
          } else if (idiom.category.includes('중상급')) {
            levelCEFR = 'B2';
          } else if (idiom.category.includes('고급')) {
            levelCEFR = 'C1';
          }
        }

        if (isPhrasalVerb) {
          phrasalVerbsCount++;
        } else {
          idiomsCount++;
        }

        // Create vocab entry
        const vocabEntry = await prisma.vocab.create({
          data: {
            lemma: idiom.idiom,
            pos: pos,
            levelCEFR: levelCEFR,
            source: source,
            languageId: englishLang.id
          }
        });

        // Create Korean translation
        if (idiom.korean_meaning) {
          await prisma.vocabTranslation.create({
            data: {
              vocabId: vocabEntry.id,
              languageId: koreanLang.id,
              translation: idiom.korean_meaning
            }
          });
        }

        // Create dict entry with examples and audio
        const examples = [];

        // Add usage context as first example
        if (idiom.usage_context_korean) {
          examples.push({
            kind: 'usage',
            ko: idiom.usage_context_korean
          });
        }

        // Add example sentence
        if (idiom.example && idiom.koExample) {
          examples.push({
            kind: 'example',
            en: idiom.example,
            ko: idiom.koExample
          });
        }

        await prisma.dictentry.create({
          data: {
            vocabId: vocabEntry.id,
            ipa: null,
            audioUrl: idiom.audio?.word || null,
            audioLocal: idiom.audio ? JSON.stringify(idiom.audio) : null,
            examples: examples.length > 0 ? examples : null
          }
        });

        successful++;

      } catch (error) {
        console.error(`❌ Failed to process idiom "${idiom.idiom}":`, error.message);
        failed++;
      }
    }

    console.log('\n🎉 Idiom and phrasal verb seeding completed!');
    console.log(`📊 Final Statistics:`);
    console.log(`   - Total processed: ${processed}`);
    console.log(`   - Successfully inserted: ${successful}`);
    console.log(`   - Failed: ${failed}`);
    console.log(`   - Idioms: ${idiomsCount}`);
    console.log(`   - Phrasal verbs: ${phrasalVerbsCount}`);

    // Verify the results
    const idiomCount = await prisma.vocab.count({
      where: { source: 'idiom_migration' }
    });

    const phrasalVerbCount = await prisma.vocab.count({
      where: { source: 'phrasal_verb_migration' }
    });

    console.log(`   - Database idiom count: ${idiomCount}`);
    console.log(`   - Database phrasal verb count: ${phrasalVerbCount}`);

    // Show sample data
    const sampleIdioms = await prisma.vocab.findMany({
      where: { source: 'idiom_migration' },
      include: {
        translations: {
          include: { language: true }
        }
      },
      take: 3
    });

    const samplePhrasalVerbs = await prisma.vocab.findMany({
      where: { source: 'phrasal_verb_migration' },
      include: {
        translations: {
          include: { language: true }
        }
      },
      take: 3
    });

    console.log('\n📝 Sample idioms:');
    sampleIdioms.forEach((idiom, index) => {
      const koreanTranslation = idiom.translations.find(t => t.language.code === 'ko');
      console.log(`   ${index + 1}. ${idiom.lemma} - ${koreanTranslation?.translation || 'No translation'}`);
    });

    console.log('\n📝 Sample phrasal verbs:');
    samplePhrasalVerbs.forEach((verb, index) => {
      const koreanTranslation = verb.translations.find(t => t.language.code === 'ko');
      console.log(`   ${index + 1}. ${verb.lemma} - ${koreanTranslation?.translation || 'No translation'}`);
    });

  } catch (error) {
    console.error('💥 Fatal error during seeding:', error);
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Database connection closed');
  }
}

// Run the script
if (require.main === module) {
  seedIdiomsAsVocab()
    .then(() => {
      console.log('✅ Seeding process completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💀 Seeding process failed:', error);
      process.exit(1);
    });
}

module.exports = seedIdiomsAsVocab;