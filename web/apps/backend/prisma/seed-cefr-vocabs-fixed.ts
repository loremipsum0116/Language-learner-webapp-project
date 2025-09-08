import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// CEFR level mapping
const cefrLevelMap: { [key: string]: string } = {
  '입문': 'A1',
  'TOEIC': 'B1',
  'TOEFL': 'B2', 
  'IELTS-A': 'A1',
  'IELTS-B': 'A2',
  'IELTS-I': 'B1',
  'IELTS-U': 'B2',
  'IELTS-P': 'C1',
  'IELTS-A+': 'C2'
};

function determineCEFRLevel(categories: string): string {
  if (!categories) return 'A1';
  
  const cats = categories.split(',').map(c => c.trim());
  
  // Priority order for level determination
  const levelPriority = ['입문', 'IELTS-A', 'IELTS-B', 'IELTS-I', 'TOEIC', 'IELTS-U', 'TOEFL', 'IELTS-P', 'IELTS-A+'];
  
  for (const level of levelPriority) {
    if (cats.includes(level)) {
      return cefrLevelMap[level] || 'A1';
    }
  }
  
  return 'A1'; // default
}

async function seedCEFRVocabs() {
  try {
    console.log('🚀 Starting CEFR vocabulary seeding with correct Korean translations...');
    
    // Read the JSON file
    const jsonPath = path.join(__dirname, '..', 'cefr_vocabs.json');
    console.log('📖 Reading JSON file from:', jsonPath);
    
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`File not found: ${jsonPath}`);
    }
    
    const jsonData = fs.readFileSync(jsonPath, 'utf8');
    const vocabs = JSON.parse(jsonData);
    
    console.log(`📊 Found ${vocabs.length} vocabulary entries to process`);
    
    // Get or create English language
    let englishLang = await prisma.language.findUnique({
      where: { code: 'en' }
    });
    
    if (!englishLang) {
      englishLang = await prisma.language.create({
        data: {
          code: 'en',
          name: 'English'
        }
      });
    }
    
    // Get or create Korean language  
    let koreanLang = await prisma.language.findUnique({
      where: { code: 'ko' }
    });
    
    if (!koreanLang) {
      koreanLang = await prisma.language.create({
        data: {
          code: 'ko', 
          name: 'Korean'
        }
      });
    }
    
    console.log('🌍 Language setup complete');
    
    // Clear existing vocabulary data
    console.log('🗑️ Clearing existing vocabulary data...');
    await prisma.vocabTranslation.deleteMany({});
    await prisma.dictentry.deleteMany({});
    await prisma.vocab.deleteMany({});
    
    let processedCount = 0;
    let errorCount = 0;
    
    for (const item of vocabs) {
      try {
        const cefrLevel = determineCEFRLevel(item.categories || '');
        
        // Create vocabulary entry
        const vocab = await prisma.vocab.create({
          data: {
            lemma: item.lemma || '',
            pos: item.pos || '',
            levelCEFR: cefrLevel,
            source: 'cefr_vocabs.json',
            language: {
              connect: { id: englishLang.id }
            }
          }
        });
        
        // Create dictionary entry with pronunciation and audio
        let audioUrl = null;
        if (item.audio && item.audio.word) {
          audioUrl = `/audio/${item.audio.word}`;
        }
        
        const dictEntry = await prisma.dictentry.create({
          data: {
            vocab: {
              connect: { id: vocab.id }
            },
            ipa: item.pronunciation || '',
            ipaKo: '', // Can be added later if needed
            audioUrl: audioUrl,
            examples: item.example ? JSON.stringify([{
              text: item.example,
              translation: item.koExample || ''
            }]) : null
          }
        });
        
        // Create Korean translation with proper koGloss
        if (item.koGloss) {
          await prisma.vocabTranslation.create({
            data: {
              vocab: {
                connect: { id: vocab.id }
              },
              language: {
                connect: { id: koreanLang.id }
              },
              translation: item.koGloss, // This is the proper Korean translation!
              definition: item.definition || ''
            }
          });
        }
        
        processedCount++;
        
        if (processedCount % 100 === 0) {
          console.log(`✅ Processed ${processedCount} entries...`);
        }
        
      } catch (error) {
        errorCount++;
        console.error(`❌ Error processing ${item.lemma}:`, error);
        
        if (errorCount > 10) {
          console.error('Too many errors, stopping...');
          break;
        }
      }
    }
    
    console.log(`🎉 Seeding completed!`);
    console.log(`✅ Successfully processed: ${processedCount} entries`);
    console.log(`❌ Errors: ${errorCount} entries`);
    
    // Verify the data
    const totalVocabs = await prisma.vocab.count();
    const totalTranslations = await prisma.vocabTranslation.count();
    const totalDictEntries = await prisma.dictentry.count();
    
    console.log(`📊 Database summary:`);
    console.log(`   - Vocabularies: ${totalVocabs}`);
    console.log(`   - Translations: ${totalTranslations}`);
    console.log(`   - Dictionary entries: ${totalDictEntries}`);
    
    // Show sample entries by CEFR level
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
      const count = await prisma.vocab.count({
        where: { levelCEFR: level }
      });
      console.log(`   - ${level} level: ${count} words`);
    }
    
  } catch (error) {
    console.error('💥 Fatal error during seeding:', error);
    throw error;
  }
}

// Run the seeding
seedCEFRVocabs()
  .catch((e) => {
    console.error('💥 Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });