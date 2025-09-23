const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function deleteJapaneseWords() {
  try {
    console.log('🗑️ Starting deletion of existing Japanese words...');

    // First find Japanese language ID
    const japaneseLanguage = await prisma.language.findUnique({
      where: { code: 'ja' }
    });

    if (!japaneseLanguage) {
      console.log('❌ Japanese language not found in database');
      return;
    }

    // Delete all Japanese vocabulary
    const deleteResult = await prisma.vocab.deleteMany({
      where: {
        languageId: japaneseLanguage.id
      }
    });

    console.log(`✅ Deleted ${deleteResult.count} Japanese vocabulary items`);

    // Also delete orphaned dictentry records
    const deleteDictentries = await prisma.dictentry.deleteMany({
      where: {
        vocab: {
          is: null
        }
      }
    });

    if (deleteDictentries.count > 0) {
      console.log(`✅ Cleaned up ${deleteDictentries.count} orphaned dictentry records`);
    }

  } catch (error) {
    console.error('❌ Error deleting Japanese words:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteJapaneseWords();