import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface CefrVocab {
  lemma: string;
  pos: string;
  categories: string;
  pronunciation?: string;
  definition: string;
  koGloss?: string;
  koExample?: string;
  koChirpScript?: string;
  audio?: {
    word?: string;
    gloss?: string;
    example?: string;
  };
  example?: string;
}

async function main() {
  console.log('Starting CEFR vocabulary seeding...');

  // Read the JSON file
  const jsonPath = path.join(__dirname, '..', 'cefr_vocabs.json');
  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const vocabs: CefrVocab[] = JSON.parse(rawData);

  // First, ensure English language exists
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

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  // Process each vocabulary item
  for (const vocabData of vocabs) {
    try {
      // Determine CEFR level from categories
      let cefrLevel = 'A1'; // Default level
      const categories = vocabData.categories.toLowerCase();
      
      if (categories.includes('c2') || categories.includes('ielts-c')) {
        cefrLevel = 'C2';
      } else if (categories.includes('c1')) {
        cefrLevel = 'C1';
      } else if (categories.includes('b2') || categories.includes('toefl')) {
        cefrLevel = 'B2';
      } else if (categories.includes('b1') || categories.includes('toeic')) {
        cefrLevel = 'B1';
      } else if (categories.includes('a2') || categories.includes('ielts-b')) {
        cefrLevel = 'A2';
      } else if (categories.includes('a1') || categories.includes('입문') || categories.includes('ielts-a')) {
        cefrLevel = 'A1';
      }

      // Check if vocab already exists
      const existingVocab = await prisma.vocab.findFirst({
        where: {
          languageId: englishLanguage.id,
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
            levelCEFR: cefrLevel,
            source: 'cefr_vocabs.json'
          }
        });
        skipCount++;
        console.log(`Updated existing vocab: ${vocabData.lemma} (${vocabData.pos})`);
      } else {
        // Create new vocab
        vocab = await prisma.vocab.create({
          data: {
            languageId: englishLanguage.id,
            lemma: vocabData.lemma,
            pos: vocabData.pos,
            levelCEFR: cefrLevel,
            source: 'cefr_vocabs.json'
          }
        });
        successCount++;
        console.log(`Created vocab: ${vocabData.lemma} (${vocabData.pos}) - Level: ${cefrLevel}`);
      }

      // Create or update dictionary entry if we have pronunciation or example
      if (vocabData.pronunciation || vocabData.example) {
        const examples = vocabData.example ? [{
          text: vocabData.example,
          translation: vocabData.koExample || ''
        }] : [];

        await prisma.dictentry.upsert({
          where: { vocabId: vocab.id },
          update: {
            ipa: vocabData.pronunciation,
            ipaKo: vocabData.koChirpScript,
            examples: examples,
            audioUrl: vocabData.audio?.word || null
          },
          create: {
            vocabId: vocab.id,
            ipa: vocabData.pronunciation,
            ipaKo: vocabData.koChirpScript,
            examples: examples,
            audioUrl: vocabData.audio?.word || null
          }
        });
      }

      // Create Korean translation if available
      if (vocabData.koGloss) {
        await prisma.vocabTranslation.upsert({
          where: {
            vocabId_languageId: {
              vocabId: vocab.id,
              languageId: koreanLanguage.id
            }
          },
          update: {
            translation: vocabData.koGloss,
            definition: vocabData.definition,
            examples: vocabData.koExample ? [vocabData.koExample] : null
          },
          create: {
            vocabId: vocab.id,
            languageId: koreanLanguage.id,
            translation: vocabData.koGloss,
            definition: vocabData.definition,
            examples: vocabData.koExample ? [vocabData.koExample] : null,
            isVerified: true
          }
        });
      }

    } catch (error) {
      console.error(`Error processing vocab "${vocabData.lemma}":`, error);
      errorCount++;
    }
  }

  console.log('\n=== Seeding Complete ===');
  console.log(`Total vocabs in JSON: ${vocabs.length}`);
  console.log(`Successfully created: ${successCount}`);
  console.log(`Updated existing: ${skipCount}`);
  console.log(`Errors: ${errorCount}`);
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });