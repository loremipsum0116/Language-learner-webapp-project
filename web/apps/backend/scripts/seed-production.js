// Production seeding script for Railway deployment
// Based on succeed-seeding-file/readme.md instructions
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function seedProduction() {
  try {
    console.log('[PRODUCTION SEED] Starting production seeding...');

    // 1. Create admin user
    console.log('[SEED] Creating admin user...');
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'super@root.com' }
    });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await prisma.user.create({
        data: {
          email: 'super@root.com',
          passwordHash: hashedPassword,
          role: 'SUPERADMIN',
          isApproved: true,
          name: 'Super Admin'
        }
      });
      console.log('[SEED] Admin user created');
    }

    // 2. Create basic languages
    console.log('[SEED] Creating languages...');
    const languages = [
      { code: 'en', name: 'English' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' }
    ];

    for (const lang of languages) {
      await prisma.language.upsert({
        where: { code: lang.code },
        update: {},
        create: lang
      });
    }

    // 3. Create basic vocabulary for testing
    console.log('[SEED] Creating sample vocabulary...');

    const enLang = await prisma.language.findUnique({ where: { code: 'en' }});

    // Sample English words
    const sampleWords = [
      { word: 'hello', meaning: '안녕하세요', level: 'A1' },
      { word: 'goodbye', meaning: '안녕히 가세요', level: 'A1' },
      { word: 'please', meaning: '부탁합니다', level: 'A1' },
      { word: 'thank you', meaning: '감사합니다', level: 'A1' },
      { word: 'water', meaning: '물', level: 'A1' }
    ];

    for (const word of sampleWords) {
      const existingVocab = await prisma.vocab.findFirst({
        where: {
          lemma: word.word,
          languageId: enLang.id
        }
      });

      if (!existingVocab) {
        const vocab = await prisma.vocab.create({
          data: {
            lemma: word.word,
            pos: 'noun',
            levelCEFR: word.level,
            languageId: enLang.id,
            source: 'basic_seed'
          }
        });

        // Add Korean translation
        await prisma.vocabTranslation.create({
          data: {
            vocabId: vocab.id,
            languageCode: 'ko',
            translation: word.meaning
          }
        });
      }
    }

    console.log('[PRODUCTION SEED] Production seeding completed successfully!');
    console.log('[INFO] Admin login: super@root.com / admin123');
    console.log('[INFO] Created 5 sample English words for testing');
    console.log('[INFO] To add full vocabulary data, run the complete seeding scripts from succeed-seeding-file/');

  } catch (error) {
    console.error('[PRODUCTION SEED] Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Only run if called directly
if (require.main === module) {
  seedProduction().catch(console.error);
}

module.exports = { seedProduction };