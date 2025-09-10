const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testBankAudio() {
  try {
    console.log('Searching for bank vocabulary...');
    
    // Search for bank vocabulary
    const bankVocabs = await prisma.vocab.findMany({
      where: {
        lemma: {
          contains: 'bank'
        },
        language: { code: 'en' }
      },
      include: {
        dictentry: {
          select: {
            ipa: true,
            examples: true,
            audioLocal: true
          }
        }
      }
    });
    
    console.log(`Found ${bankVocabs.length} bank vocabularies:`);
    
    bankVocabs.forEach(vocab => {
      console.log('\n-------------------');
      console.log('ID:', vocab.id);
      console.log('Lemma:', vocab.lemma);
      console.log('POS:', vocab.pos);
      console.log('Level:', vocab.levelCEFR);
      
      if (vocab.dictentry?.audioLocal) {
        let audioLocal;
        try {
          audioLocal = typeof vocab.dictentry.audioLocal === 'string'
            ? JSON.parse(vocab.dictentry.audioLocal)
            : vocab.dictentry.audioLocal;
          console.log('Audio Local:', audioLocal);
        } catch (e) {
          console.log('Audio Local (raw):', vocab.dictentry.audioLocal);
        }
      } else {
        console.log('No audio_local data');
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBankAudio();