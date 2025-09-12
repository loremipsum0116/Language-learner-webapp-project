// Simple CEFR vocab seeding script for mobile app
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🌱 Starting CEFR vocab seeding...');

    // Read the cefr_vocabs.json file
    const cefrPath = path.join(__dirname, 'cefr_vocabs.json');
    
    if (!fs.existsSync(cefrPath)) {
      console.error('❌ cefr_vocabs.json not found!');
      return;
    }

    console.log('📖 Reading cefr_vocabs.json...');
    const rawData = fs.readFileSync(cefrPath, 'utf8');
    const vocabData = JSON.parse(rawData);
    
    console.log(`📚 Found ${vocabData.length} vocabulary items`);

    // Clear existing data first
    console.log('🧹 Clearing existing vocab data...');
    await prisma.dictentry.deleteMany({});
    await prisma.vocab.deleteMany({});
    
    console.log('✅ Cleared existing data');

    // Create English language entry if it doesn't exist
    console.log('🌐 Setting up language entries...');
    let englishLang = await prisma.language.findUnique({
      where: { id: 1 }
    });
    
    if (!englishLang) {
      englishLang = await prisma.language.create({
        data: {
          id: 1,
          name: 'English',
          code: 'en',
          nativeName: 'English'
        }
      });
      console.log('✅ Created English language entry');
    } else {
      console.log('✅ English language entry already exists');
    }

    // Process in smaller batches to avoid memory issues
    const BATCH_SIZE = 50;
    let processed = 0;

    for (let i = 0; i < vocabData.length; i += BATCH_SIZE) {
      const batch = vocabData.slice(i, i + BATCH_SIZE);
      
      console.log(`🚀 Processing batch ${Math.floor(i/BATCH_SIZE) + 1} (items ${i + 1}-${Math.min(i + BATCH_SIZE, vocabData.length)})`);
      
      for (const item of batch) {
        try {
          // Map categories to CEFR levels
          const getCefrLevel = (categories) => {
            if (!categories) return 'A1';
            if (categories.includes('입문')) return 'A1';
            if (categories.includes('기초')) return 'A2';  
            if (categories.includes('중급')) return 'B1';
            if (categories.includes('중상급')) return 'B2';
            if (categories.includes('고급') || categories.includes('상급')) return 'C1';
            if (categories.includes('최고급')) return 'C2';
            return 'A1'; // default
          };

          // Create vocab entry
          const vocab = await prisma.vocab.create({
            data: {
              lemma: item.lemma || '',
              pos: item.pos || 'unknown',
              levelCEFR: getCefrLevel(item.categories),
              languageId: 1, // English
              source: 'cefr_vocabs'
            }
          });

          // Create dictentry with simplified data
          const dictentry = await prisma.dictentry.create({
            data: {
              vocabId: vocab.id,
              ipa: item.pronunciation || null,
              audioUrl: null,
              audioLocal: item.audio ? JSON.stringify(item.audio) : null,
              license: 'CEFR Vocabs Dataset',
              attribution: 'CEFR Vocabs Dataset',
              examples: [
                {
                  kind: 'gloss',
                  ko: item.koGloss || '',
                  source: 'cefr_vocabs'
                },
                {
                  kind: 'example', 
                  en: item.example || '',
                  ko: item.koExample || '',
                  source: 'cefr_vocabs'
                }
              ].filter(ex => ex.ko || ex.en) // Only include non-empty examples
            }
          });

          processed++;
          
          if (processed % 100 === 0) {
            console.log(`✨ Processed ${processed} items...`);
          }

        } catch (error) {
          console.error(`❌ Error processing item ${item.lemma}:`, error.message);
          continue;
        }
      }
    }

    console.log(`🎉 Successfully seeded ${processed} vocabulary items!`);
    console.log('📊 Summary:');
    
    // Show counts by level
    const levelCounts = await prisma.vocab.groupBy({
      by: ['levelCEFR'],
      _count: { id: true },
      orderBy: { levelCEFR: 'asc' }
    });
    
    levelCounts.forEach(level => {
      console.log(`   ${level.levelCEFR}: ${level._count.id} words`);
    });

  } catch (error) {
    console.error('💥 Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Database connection closed');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });