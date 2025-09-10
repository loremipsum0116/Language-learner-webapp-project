const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixTranslations() {
  console.log('🔄 Fixing missing Korean translations...');
  
  try {
    // Get some sample vocab without Korean translations
    const vocabs = await prisma.vocab.findMany({
      where: {
        language: { code: 'en' },
        levelCEFR: 'A1'
      },
      include: {
        translations: {
          where: { language: { code: 'ko' } }
        },
        dictentry: true
      },
      take: 10
    });

    console.log(`Found ${vocabs.length} vocab items`);

    // Sample Korean translations for common A1 words
    const sampleTranslations = {
      'a': '하나의',
      'an': '하나의',
      'about': '에 대한',
      'above': '위에',
      'across': '가로질러',
      'action': '행동',
      'activity': '활동',
      'actor': '배우',
      'actress': '여배우',
      'add': '더하다',
      'address': '주소',
      'adult': '성인',
      'advice': '조언',
      'afraid': '두려운',
      'after': '후에',
      'afternoon': '오후',
      'again': '다시',
      'age': '나이',
      'ago': '전에',
      'agree': '동의하다',
      'air': '공기',
      'airport': '공항',
      'all': '모든',
      'also': '또한',
      'always': '항상',
      'amazing': '놀라운',
      'and': '그리고',
      'angry': '화난',
      'animal': '동물',
      'another': '다른',
      'answer': '답하다',
      'any': '어떤',
      'anyone': '누구든지',
      'anything': '무엇이든',
      'apartment': '아파트',
      'apple': '사과',
      'April': '4월',
      'area': '지역',
      'arm': '팔',
      'around': '주변에',
      'arrive': '도착하다',
      'art': '예술',
      'article': '기사',
      'artist': '예술가',
      'as': '~로서',
      'ask': '묻다',
      'at': '~에서',
      'August': '8월',
      'aunt': '이모',
      'away': '떨어져',
      'awesome': '멋진',
      'baby': '아기',
      'back': '뒤',
      'bad': '나쁜',
      'bag': '가방',
      'ball': '공',
      'banana': '바나나',
      'band': '밴드',
      'bank': '은행',
      'bar': '바',
      'baseball': '야구',
      'basketball': '농구',
      'bath': '목욕',
      'bathroom': '화장실',
      'be': '이다',
      'beach': '해변',
      'beautiful': '아름다운',
      'because': '왜냐하면',
      'become': '되다',
      'bed': '침대',
      'bedroom': '침실',
      'beer': '맥주',
      'before': '전에',
      'begin': '시작하다',
      'beginning': '시작',
      'behind': '뒤에',
      'believe': '믿다',
      'below': '아래에',
      'best': '최고의',
      'better': '더 좋은',
      'between': '사이에',
      'bicycle': '자전거',
      'big': '큰',
      'bike': '자전거',
      'bill': '계산서',
      'bird': '새',
      'birthday': '생일',
      'black': '검은',
      'blog': '블로그',
      'blond': '금발의',
      'blue': '파란',
      'boat': '배',
      'body': '몸',
      'book': '책',
      'boot': '부츠',
      'bored': '지루한',
      'boring': '지루한',
      'born': '태어난',
      'both': '둘 다',
      'bottle': '병'
    };

    for (const vocab of vocabs) {
      if (vocab.translations.length === 0) {
        const translation = sampleTranslations[vocab.lemma];
        if (translation) {
          console.log(`Adding Korean translation for "${vocab.lemma}": ${translation}`);
          
          // Find or create Korean language
          let koLang = await prisma.language.findUnique({
            where: { code: 'ko' }
          });
          
          if (!koLang) {
            koLang = await prisma.language.create({
              data: {
                code: 'ko',
                name: 'Korean'
              }
            });
          }
          
          // Create translation
          await prisma.vocabTranslation.create({
            data: {
              vocabId: vocab.id,
              languageId: koLang.id,
              translation: translation,
              definition: `${vocab.lemma}의 한국어 뜻: ${translation}`
            }
          });
        }
      }
    }

    console.log('✅ Korean translations added successfully!');
  } catch (error) {
    console.error('❌ Error fixing translations:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixTranslations();