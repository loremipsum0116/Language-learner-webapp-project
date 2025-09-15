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
    const existingIdioms = await prisma.vocab.findMany({
      where: {
        OR: [
          { source: 'idiom_migration' },
          { source: 'phrasal_verb_migration' }
        ]
      }
    });

    if (existingIdioms.length > 0) {
      // Delete related translations first
      await prisma.vocabTranslation.deleteMany({
        where: {
          vocabId: { in: existingIdioms.map(v => v.id) }
        }
      });

      // Delete dict entries
      await prisma.dictentry.deleteMany({
        where: {
          vocabId: { in: existingIdioms.map(v => v.id) }
        }
      });

      // Delete vocab entries
      await prisma.vocab.deleteMany({
        where: {
          OR: [
            { source: 'idiom_migration' },
            { source: 'phrasal_verb_migration' }
          ]
        }
      });

      console.log(`✅ Cleared ${existingIdioms.length} existing idiom and phrasal verb entries`);
    }

    let processed = 0;
    let successful = 0;
    let failed = 0;

    console.log('📝 Processing idioms...');

    for (const idiom of idiomData) {
      try {
        processed++;

        if (processed % 100 === 0) {
          console.log(`⏳ Processed ${processed}/${idiomData.length} idioms...`);
        }

        // Determine if it's an idiom or phrasal verb based on category and audio path
        const isPhrasalVerb = idiom.category.includes('구동사') || idiom.audio?.word?.startsWith('phrasal_verb/');
        const pos = isPhrasalVerb ? 'phrasal_verb' : 'idiom';
        const source = isPhrasalVerb ? 'phrasal_verb_migration' : 'idiom_migration';

        // Extract CEFR level from category
        const getCefrLevel = (categories) => {
          if (!categories) return 'A1';
          if (categories.includes('입문') || categories.includes('기초')) return 'A1';
          if (categories.includes('초급')) return 'A2';
          if (categories.includes('중급')) return 'B1';
          if (categories.includes('중상급')) return 'B2';
          if (categories.includes('고급') || categories.includes('상급')) return 'C1';
          if (categories.includes('최고급')) return 'C2';
          return 'A1'; // default
        };

        // Create vocab entry
        const vocabEntry = await prisma.vocab.create({
          data: {
            lemma: idiom.idiom,
            pos: pos,
            levelCEFR: getCefrLevel(idiom.category),
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
            examples: examples.length > 0 ? examples : null
          }
        });

        successful++;

      } catch (error) {
        console.error(`❌ Failed to process idiom "${idiom.idiom}":`, error.message);
        failed++;
      }
    }

    console.log('\n🎉 Idiom seeding completed!');
    console.log(`📊 Final Statistics:`);
    console.log(`   - Total processed: ${processed}`);
    console.log(`   - Successfully inserted: ${successful}`);
    console.log(`   - Failed: ${failed}`);

    // Verify the results
    const idiomCount = await prisma.vocab.count({
      where: { source: 'idiom_migration' }
    });

    const phrasalVerbCount = await prisma.vocab.count({
      where: { source: 'phrasal_verb_migration' }
    });

    console.log(`   - Idioms in database: ${idiomCount}`);
    console.log(`   - Phrasal verbs in database: ${phrasalVerbCount}`);
    console.log(`   - Total: ${idiomCount + phrasalVerbCount}`);

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
    samplePhrasalVerbs.forEach((phrasal, index) => {
      const koreanTranslation = phrasal.translations.find(t => t.language.code === 'ko');
      console.log(`   ${index + 1}. ${phrasal.lemma} - ${koreanTranslation?.translation || 'No translation'}`);
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