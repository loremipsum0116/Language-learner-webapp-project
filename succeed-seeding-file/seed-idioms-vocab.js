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

    // Clear existing idiom data (vocab with source 'idiom_migration')
    console.log('🧹 Clearing existing idiom data...');
    const existingIdioms = await prisma.vocab.findMany({
      where: { source: 'idiom_migration' }
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
        where: { source: 'idiom_migration' }
      });

      console.log(`✅ Cleared ${existingIdioms.length} existing idiom entries`);
    }

    let processed = 0;
    let successful = 0;
    let failed = 0;
    let idiomCount = 0;
    let phrasalVerbCount = 0;

    console.log('📝 Processing idioms and phrasal verbs...');

    for (const idiom of idiomData) {
      try {
        processed++;

        if (processed % 100 === 0) {
          console.log(`⏳ Processed ${processed}/${idiomData.length} idioms...`);
        }

        // Determine if it's an idiom or phrasal verb based on audio path
        let posType = 'idiom'; // default
        if (idiom.audio && idiom.audio.word) {
          if (idiom.audio.word.includes('phrasal_verb/')) {
            posType = 'phrasal verb';
            phrasalVerbCount++;
          } else {
            idiomCount++;
          }
        } else {
          idiomCount++; // default to idiom if no audio path
        }

        // Map Korean difficulty to CEFR level
        const categoryToCEFR = {
          '기초': 'A2',
          '중급': 'B1',
          '중상급': 'B2',
          '고급': 'C1'
        };

        // Extract difficulty from category (e.g., "중급, 숙어" -> "중급")
        const difficulty = idiom.category ? idiom.category.split(',')[0].trim() : '중급';
        const cefrLevel = categoryToCEFR[difficulty] || 'B1';

        // Create vocab entry for idiom/phrasal verb
        const vocabEntry = await prisma.vocab.create({
          data: {
            lemma: idiom.idiom,
            pos: posType,
            levelCEFR: cefrLevel,
            source: 'idiom_migration',
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
    console.log(`     • Idioms: ${idiomCount}`);
    console.log(`     • Phrasal verbs: ${phrasalVerbCount}`);
    console.log(`   - Failed: ${failed}`);

    // Verify the results
    const dbTotalCount = await prisma.vocab.count({
      where: { source: 'idiom_migration' }
    });

    const dbIdiomCount = await prisma.vocab.count({
      where: {
        source: 'idiom_migration',
        pos: 'idiom'
      }
    });

    const dbPhrasalCount = await prisma.vocab.count({
      where: {
        source: 'idiom_migration',
        pos: 'phrasal verb'
      }
    });

    console.log(`   - Database verification:`);
    console.log(`     • Total in DB: ${dbTotalCount}`);
    console.log(`     • Idioms in DB: ${dbIdiomCount}`);
    console.log(`     • Phrasal verbs in DB: ${dbPhrasalCount}`);

    // Show sample data
    const sampleIdioms = await prisma.vocab.findMany({
      where: { source: 'idiom_migration' },
      include: {
        translations: {
          include: { language: true }
        }
      },
      take: 5
    });

    console.log('\n📝 Sample data:');
    sampleIdioms.forEach((idiom, index) => {
      const koreanTranslation = idiom.translations.find(t => t.language.code === 'ko');
      console.log(`   ${index + 1}. ${idiom.lemma} - ${koreanTranslation?.translation || 'No translation'}`);
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