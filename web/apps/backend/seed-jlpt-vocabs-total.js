const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🌱 Starting JLPT vocab seeding (N1-N5)...');

    // JLPT 레벨 배열 (N1부터 N5까지)
    const jlptLevels = ['N1', 'N2', 'N3', 'N4', 'N5'];

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
      where: {
        OR: [
          { source: 'jlpt_vocabs' },
          { source: 'jlpt_total' },
          { levelJLPT: { not: null } }
        ]
      }
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
        where: {
          OR: [
            { source: 'jlpt_vocabs' },
            { source: 'jlpt_total' },
            { levelJLPT: { not: null } }
          ]
        }
      });

      console.log(`✅ Cleared ${existingJlpt.length} existing JLPT entries`);
    }

    let totalProcessed = 0;
    let totalTranslationsCreated = 0;

    // 각 JLPT 레벨별로 시딩
    for (const level of jlptLevels) {
      console.log(`\n📚 Processing JLPT ${level}...`);

      // JSON 파일 경로
      const jlptPath = path.join(__dirname, '..', '..', '..', 'succeed-seeding-file', 'jlpt', `${level}_fixed.json`);

      if (!fs.existsSync(jlptPath)) {
        console.warn(`⚠️ ${level}_fixed.json not found, skipping...`);
        continue;
      }

      console.log(`📖 Reading ${level}_fixed.json...`);
      const rawData = fs.readFileSync(jlptPath, 'utf8');
      const vocabData = JSON.parse(rawData);

      console.log(`📚 Found ${vocabData.length} Japanese vocabulary items for ${level}`);

      // Process in smaller batches to avoid memory issues
      const BATCH_SIZE = 50;
      let levelProcessed = 0;
      let levelTranslationsCreated = 0;

      for (let i = 0; i < vocabData.length; i += BATCH_SIZE) {
        const batch = vocabData.slice(i, i + BATCH_SIZE);

        console.log(`🚀 Processing ${level} batch ${Math.floor(i/BATCH_SIZE) + 1} (items ${i + 1}-${Math.min(i + BATCH_SIZE, vocabData.length)})`);

        for (const item of batch) {
          try {
            // Create vocab entry
            const vocab = await prisma.vocab.create({
              data: {
                lemma: item.lemma || '',
                pos: item.pos || 'unknown',
                levelJLPT: level,
                languageId: japaneseLang.id,
                source: 'jlpt_total'
              }
            });

            // Create dictentry with examples and audio
            let examplesData = [];

            // koExample이 있는 경우 예문 데이터 생성
            if (item.koExample && item.koExample.trim()) {
              // 1. 상세페이지용 배열 구조 (VocabDetailModal.jsx 호환)
              examplesData.push({
                kind: 'example',
                ja: item.example || item.lemma, // 일본어 예문 (없으면 단어 자체)
                ko: item.koExample,             // 한국어 해석
                en: item.example || item.lemma, // SRS 폴더 호환용
                source: 'jlpt_total'
              });

              // 2. SRS 폴더용 객체 구조 (SrsFolderDetail.jsx 호환)
              examplesData.definitions = [
                {
                  examples: [
                    {
                      en: item.example || item.lemma, // 일본어 예문을 en 필드에 저장
                      ko: item.koExample,             // 한국어 해석
                      ja: item.example || item.lemma, // 일본어 원문
                      kind: 'example',
                      source: 'jlpt_total'
                    }
                  ]
                }
              ];
            }

            // 오디오 정보 처리
            let audioLocal = null;
            if (item.audio || item.romaji) {
              audioLocal = JSON.stringify({
                word: item.audio?.word || `/jlpt/${level.toLowerCase()}/${item.romaji || item.lemma}/word.mp3`,
                gloss: item.audio?.gloss || `/jlpt/${level.toLowerCase()}/${item.romaji || item.lemma}/gloss.mp3`,
                example: item.audio?.example || `/jlpt/${level.toLowerCase()}/${item.romaji || item.lemma}/example.mp3`
              });
            }

            const dictentry = await prisma.dictentry.create({
              data: {
                vocabId: vocab.id,
                ipa: item.kana || null,        // Store kana reading in ipa field
                ipaKo: item.romaji || null,    // Store romaji in ipaKo field
                audioUrl: null,
                audioLocal: audioLocal,
                license: `JLPT ${level} Vocabs Dataset`,
                attribution: `JLPT ${level} Vocabs Dataset`,
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
              levelTranslationsCreated++;
              totalTranslationsCreated++;
            }

            levelProcessed++;
            totalProcessed++;

            if (levelProcessed % 50 === 0) {
              console.log(`✨ ${level}: Processed ${levelProcessed} items, created ${levelTranslationsCreated} translations...`);
            }

          } catch (error) {
            console.error(`❌ Error processing ${level} item ${item.lemma}:`, error.message);
            continue;
          }
        }
      }

      console.log(`✅ ${level} completed: ${levelProcessed} words, ${levelTranslationsCreated} translations`);
    }

    console.log(`\n🎉 Successfully seeded ${totalProcessed} Japanese vocabulary items and ${totalTranslationsCreated} translations!`);
    console.log('📊 Summary by level:');

    // Show final count by level
    for (const level of jlptLevels) {
      const levelCount = await prisma.vocab.count({
        where: {
          source: 'jlpt_total',
          levelJLPT: level
        }
      });
      console.log(`   ${level}: ${levelCount} words`);
    }

    // Show total count
    const totalJapanese = await prisma.vocab.count({
      where: { source: 'jlpt_total' }
    });

    console.log(`   📚 Total Japanese words: ${totalJapanese}`);

    // Verify translations were created
    const totalTranslations = await prisma.vocabTranslation.count({
      where: {
        vocab: { source: 'jlpt_total' }
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