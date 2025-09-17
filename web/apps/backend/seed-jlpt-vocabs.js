const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🌱 Starting JLPT vocab seeding...');

    // Read the jlpt_n5_vocabs.json file
    const jlptPath = path.join(__dirname, '..', '..', '..', 'succeed-seeding-file', 'jlpt_n5_vocabs.json');

    if (!fs.existsSync(jlptPath)) {
      console.error('❌ jlpt_n5_vocabs.json not found!');
      return;
    }

    console.log('📖 Reading jlpt_n5_vocabs.json...');
    const rawData = fs.readFileSync(jlptPath, 'utf8');
    const vocabData = JSON.parse(rawData);

    console.log(`📚 Found ${vocabData.length} Japanese vocabulary items`);

    // Get or create Japanese language entry
    console.log('🌐 Setting up language entries...');
    let japaneseLang = await prisma.language.findUnique({
      where: { code: 'ja' }
    });

    if (!japaneseLang) {
      japaneseLang = await prisma.language.create({
        data: {
          code: 'ja',
          name: 'Japanese',
          nativeName: '日本語',
          isActive: true
        }
      });
      console.log('✅ Created Japanese language entry');
    } else {
      console.log('✅ Japanese language entry already exists');
    }

    // Get Korean language entry
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
    } else {
      console.log('✅ Korean language entry already exists');
    }

    // Clear existing JLPT data
    console.log('🧹 Clearing existing JLPT data...');
    const existingJlpt = await prisma.vocab.findMany({
      where: { source: 'jlpt_vocabs' }
    });

    if (existingJlpt.length > 0) {
      // Delete related translations first
      await prisma.vocabTranslation.deleteMany({
        where: {
          vocabId: { in: existingJlpt.map(v => v.id) }
        }
      });

      // Delete dict entries
      await prisma.dictentry.deleteMany({
        where: {
          vocabId: { in: existingJlpt.map(v => v.id) }
        }
      });

      // Delete vocab entries
      await prisma.vocab.deleteMany({
        where: { source: 'jlpt_vocabs' }
      });

      console.log(`✅ Cleared ${existingJlpt.length} existing JLPT entries`);
    }

    // Process in smaller batches to avoid memory issues
    const BATCH_SIZE = 50;
    let processed = 0;
    let translationsCreated = 0;

    for (let i = 0; i < vocabData.length; i += BATCH_SIZE) {
      const batch = vocabData.slice(i, i + BATCH_SIZE);

      console.log(`🚀 Processing batch ${Math.floor(i/BATCH_SIZE) + 1} (items ${i + 1}-${Math.min(i + BATCH_SIZE, vocabData.length)})`);

      for (const item of batch) {
        try {
          // Create vocab entry
          const vocab = await prisma.vocab.create({
            data: {
              lemma: item.lemma || '',
              pos: item.pos || 'unknown',
              levelJLPT: 'N5', // All items in this file are N5
              languageId: japaneseLang.id,
              source: 'jlpt_vocabs'
            }
          });

          // Create dictentry with examples and audio
          // 두 가지 구조 모두 지원: SRS 폴더용 + 상세페이지용
          let examplesData = [];

          if (item.example && item.koExample) {
            // 1. 상세페이지용 배열 구조 (VocabDetailModal.jsx 호환)
            examplesData.push({
              kind: 'example',
              ja: item.example,        // 일본어 예문
              ko: item.koExample,      // 한국어 해석
              en: item.example,        // SRS 폴더 호환용 (en 필드에도 저장)
              source: 'jlpt_vocabs'
            });

            // 2. SRS 폴더용 객체 구조 (SrsFolderDetail.jsx 호환)
            examplesData.definitions = [
              {
                examples: [
                  {
                    en: item.example,        // 일본어 예문을 en 필드에 저장 (SRS 폴더 호환)
                    ko: item.koExample,      // 한국어 해석
                    ja: item.example,        // 일본어 원문도 별도 보관
                    kind: 'example',
                    source: 'jlpt_vocabs'
                  }
                ]
              }
            ];
          }

          const dictentry = await prisma.dictentry.create({
            data: {
              vocabId: vocab.id,
              ipa: item.kana || null, // Store kana reading in ipa field
              ipaKo: item.romaji || null, // Store romaji in ipaKo field
              audioUrl: null,
              audioLocal: item.audio ? JSON.stringify(item.audio) : null,
              license: 'JLPT N5 Vocabs Dataset',
              attribution: 'JLPT N5 Vocabs Dataset',
              examples: Object.keys(examplesData).length > 0 ? examplesData : null
            }
          });

          // Create Korean translation
          if (item.koGloss && item.koGloss.trim()) {
            await prisma.vocabTranslation.create({
              data: {
                vocabId: vocab.id,
                languageId: koreanLang.id,
                translation: item.koGloss.trim(),
                definition: item.definition || null,
                isVerified: true,
                confidence: 1.0
              }
            });
            translationsCreated++;
          }

          processed++;

          if (processed % 50 === 0) {
            console.log(`✨ Processed ${processed} items, created ${translationsCreated} translations...`);
          }

        } catch (error) {
          console.error(`❌ Error processing item ${item.lemma}:`, error.message);
          continue;
        }
      }
    }

    console.log(`🎉 Successfully seeded ${processed} Japanese vocabulary items and ${translationsCreated} translations!`);
    console.log('📊 Summary:');

    // Show final count
    const totalJapanese = await prisma.vocab.count({
      where: { source: 'jlpt_vocabs' }
    });

    console.log(`   Total Japanese words: ${totalJapanese}`);

    // Verify translations were created
    const totalTranslations = await prisma.vocabTranslation.count({
      where: {
        vocab: { source: 'jlpt_vocabs' }
      }
    });
    console.log(`📝 Total Korean translations for Japanese words: ${totalTranslations}`);

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