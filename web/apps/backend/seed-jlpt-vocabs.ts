import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface JlptVocab {
  lemma: string;
  kana: string;
  romaji: string;
  pos: string;
  categories: string;
  definition: string;
  koGloss: string;
  koExample: string;
  koChirpScript: string;
  example: string;
  exampleKana: string;
  exampleTranslation: string;
  kanji?: string | null;
  onyomi?: string | null;
  kunyomi?: string | null;
  audio?: {
    word?: string;
    gloss?: string;
    example?: string;
  };
}

async function main() {
  console.log('Starting JLPT vocabulary seeding...');

  // Read the JSON file
  const jsonPath = path.join(__dirname, '..', '..', '..', 'succeed-seeding-file', 'jlpt_n5_vocabs.json');
  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const vocabs: JlptVocab[] = JSON.parse(rawData);

  // First, ensure Japanese language exists
  const japaneseLanguage = await prisma.language.upsert({
    where: { code: 'ja' },
    update: {},
    create: {
      code: 'ja',
      name: 'Japanese',
      nativeName: '日本語',
      isActive: true
    }
  });

  console.log(`Japanese language ID: ${japaneseLanguage.id}`);

  // Ensure Korean language exists for translations
  const koreanLanguage = await prisma.language.upsert({
    where: { code: 'ko' },
    update: {},
    create: {
      code: 'ko',
      name: 'Korean',
      nativeName: '한국어',
      isActive: true
    }
  });

  console.log(`Korean language ID: ${koreanLanguage.id}`);

  // Ensure English language exists for translations
  const englishLanguage = await prisma.language.upsert({
    where: { code: 'en' },
    update: {},
    create: {
      code: 'en',
      name: 'English',
      nativeName: 'English',
      isActive: true
    }
  });

  console.log(`English language ID: ${englishLanguage.id}`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  // Process each vocabulary item
  for (const vocabData of vocabs) {
    try {
      // Determine JLPT level from categories
      let jlptLevel = 'N5'; // Default level
      const categories = vocabData.categories.toUpperCase();

      if (categories.includes('N1')) {
        jlptLevel = 'N1';
      } else if (categories.includes('N2')) {
        jlptLevel = 'N2';
      } else if (categories.includes('N3')) {
        jlptLevel = 'N3';
      } else if (categories.includes('N4')) {
        jlptLevel = 'N4';
      } else if (categories.includes('N5')) {
        jlptLevel = 'N5';
      }

      // Check if vocab already exists
      const existingVocab = await prisma.vocab.findFirst({
        where: {
          languageId: japaneseLanguage.id,
          lemma: vocabData.lemma,
          pos: vocabData.pos
        }
      });

      let vocab;
      if (existingVocab) {
        // Update existing vocab
        vocab = await prisma.vocab.update({
          where: { id: existingVocab.id },
          data: {
            levelJLPT: jlptLevel,
            source: 'jlpt'
          }
        });
        console.log(`Updated existing vocab: ${vocabData.lemma} (${vocabData.pos})`);
      } else {
        // Create new vocab
        vocab = await prisma.vocab.create({
          data: {
            languageId: japaneseLanguage.id,
            lemma: vocabData.lemma,
            pos: vocabData.pos,
            levelJLPT: jlptLevel,
            source: 'jlpt'
          }
        });
        console.log(`Created new vocab: ${vocabData.lemma} (${vocabData.pos})`);
      }

      // Create or update Korean translation
      await prisma.vocabTranslation.upsert({
        where: {
          vocabId_languageId: {
            vocabId: vocab.id,
            languageId: koreanLanguage.id
          }
        },
        update: {
          translation: vocabData.koGloss,
          definition: vocabData.koChirpScript,
          examples: {
            example: vocabData.koExample,
            chirpScript: vocabData.koChirpScript
          },
          isVerified: true
        },
        create: {
          vocabId: vocab.id,
          languageId: koreanLanguage.id,
          translation: vocabData.koGloss,
          definition: vocabData.koChirpScript,
          examples: {
            example: vocabData.koExample,
            chirpScript: vocabData.koChirpScript
          },
          isVerified: true
        }
      });

      // Create or update English translation
      await prisma.vocabTranslation.upsert({
        where: {
          vocabId_languageId: {
            vocabId: vocab.id,
            languageId: englishLanguage.id
          }
        },
        update: {
          translation: vocabData.definition,
          definition: vocabData.exampleTranslation,
          examples: {
            example: vocabData.example,
            exampleKana: vocabData.exampleKana,
            exampleTranslation: vocabData.exampleTranslation
          },
          isVerified: true
        },
        create: {
          vocabId: vocab.id,
          languageId: englishLanguage.id,
          translation: vocabData.definition,
          definition: vocabData.exampleTranslation,
          examples: {
            example: vocabData.example,
            exampleKana: vocabData.exampleKana,
            exampleTranslation: vocabData.exampleTranslation
          },
          isVerified: true
        }
      });

      // Create or update dictionary entry with pronunciation and additional data
      await prisma.dictentry.upsert({
        where: { vocabId: vocab.id },
        update: {
          ipa: vocabData.kana,  // Store kana as pronunciation
          ipaKo: vocabData.romaji,  // Store romaji as Korean pronunciation
          examples: {
            kana: vocabData.kana,
            romaji: vocabData.romaji,
            kanji: vocabData.kanji,
            onyomi: vocabData.onyomi,
            kunyomi: vocabData.kunyomi,
            example: vocabData.example,
            exampleKana: vocabData.exampleKana,
            exampleTranslation: vocabData.exampleTranslation,
            koExample: vocabData.koExample
          },
          audioUrl: vocabData.audio?.word,
          audioLocal: vocabData.audio?.word
        },
        create: {
          vocabId: vocab.id,
          ipa: vocabData.kana,  // Store kana as pronunciation
          ipaKo: vocabData.romaji,  // Store romaji as Korean pronunciation
          examples: {
            kana: vocabData.kana,
            romaji: vocabData.romaji,
            kanji: vocabData.kanji,
            onyomi: vocabData.onyomi,
            kunyomi: vocabData.kunyomi,
            example: vocabData.example,
            exampleKana: vocabData.exampleKana,
            exampleTranslation: vocabData.exampleTranslation,
            koExample: vocabData.koExample
          },
          audioUrl: vocabData.audio?.word,
          audioLocal: vocabData.audio?.word
        }
      });

      successCount++;
    } catch (error) {
      console.error(`Error processing vocab ${vocabData.lemma}:`, error);
      errorCount++;
    }
  }

  console.log(`\nSeeding completed!`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`⏭️  Skipped: ${skipCount}`);
  console.log(`❌ Errors: ${errorCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });