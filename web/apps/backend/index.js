// server/index.js
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// --- 압축 및 최적화 미들웨어 임포트 ---
const {
  advancedCompression,
  apiResponseOptimization,
  contentTypeOptimization,
  responseSizeMonitoring,
  apiCacheOptimization,
  brotliCompression
} = require('./middleware/compression');

const {
  preCompressedStatic,
  audioOptimization,
  imageOptimization,
  jsonFileOptimization,
  staticFileLogging
} = require('./middleware/staticCompression');

// GCS 리다이렉트 미들웨어
const { createGcsRedirect, gcsAudioRedirect, gcsListeningRedirect } = require('./middleware/gcsRedirect');

// --- 라우터 임포트 ---
const authRoutes = require('./routes/auth');
const learnRoutes = require('./routes/learn');
const vocabRoutes = require('./routes/vocab');
const quizRoutes = require('./routes/quiz');
const srsRoutes = require('./routes/srs');                // ✅ 한번만
const userRoutes = require('./routes/user');
const readingRoutes = require('./routes/reading');
const japaneseReadingRoutes = require('./routes/japanese-reading');
const japaneseListeningRoutes = require('./routes/japanese-listening');
const categoryRoutes = require('./routes/categories');
const myWordbookRoutes = require('./routes/my-wordbook');
const myIdiomsRoutes = require('./routes/my-idioms');
const odatNoteRoutes = require('./routes/odat-note');
const dictRoutes = require('./routes/dict');
const examVocabRoutes = require('./routes/examVocab');
const autoFolderRoutes = require('./routes/autoFolder');
const cardReportsRoutes = require('./routes/cardReports');
// const idiomRoutes = require('./routes/idiom'); // Removed - using idiom_working.js instead

// (선택) 대시보드 오버라이드/Flat 확장 라우터
const srsFlatExt = require('./routes/srs-flat-extensions');         // 제공 파일
const srsDashOverride = require('./routes/srs-dashboard-override');  // 제공 파일

// 타임머신 라우터
const { router: timeMachineRouter } = require('./routes/timeMachine');

// 관리자 라우터
const adminRoutes = require('./routes/admin');

// --- 미들웨어 임포트 ---
const authMiddleware = require('./middleware/auth');
const { 
  detectApiVersion, 
  validateApiVersion, 
  deprecationWarning, 
  formatApiResponse,
  generateApiDocs 
} = require('./middleware/apiVersion');

// --- 응답 포맷 표준화 미들웨어 ---
const { 
  responseFormatMiddleware, 
  errorResponseMiddleware 
} = require('./middleware/responseFormat');

// --- API 버전 라우터 임포트 ---
const apiV1Router = require('./routes/api/v1');
const mobileRouter = require('./routes/api/mobile');

const app = express();

console.log('[STARTUP] Express app created, setting up routes... v2024-12-28');

// TEST ENDPOINTS - Very early in the middleware stack
app.get('/immediate-test', (req, res) => {
  res.json({ message: 'Immediate test working!', timestamp: new Date().toISOString() });
});

app.get('/api/immediate-test', (req, res) => {
  res.json({ message: 'Immediate API test working!', timestamp: new Date().toISOString() });
});

// === API 문서화 (임시로 다른 경로 사용) ===
app.get('/api-docs', (req, res) => {
  console.log('[API DOCS] /api-docs route hit - immediate response');
  const { generateApiDocs } = require('./middleware/apiVersion');
  generateApiDocs([1])(req, res);
});

app.get('/docs/api-info', (req, res) => {
  console.log('[API DOCS] /docs/api-info route hit - immediate response'); 
  const { generateApiDocs } = require('./middleware/apiVersion');
  generateApiDocs([1])(req, res);
});

// === SIMPLE VOCAB ENDPOINT (NO MIDDLEWARE) ===
app.get('/simple-vocab', async (req, res) => {
  console.log('>>>>>>> SIMPLE-VOCAB ENDPOINT HIT! <<<<<<<');
  console.log('Query params:', req.query);
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const { limit = 100, levelCEFR = 'A1', pos, search, offset = 0 } = req.query;
    const limitInt = Math.min(parseInt(limit), 1000);
    const offsetInt = Math.max(parseInt(offset), 0);

    console.log(`[SIMPLE-VOCAB] Request params:`, { levelCEFR, limit, pos, search });

    // Handle idioms and phrasal verbs
    if (pos) {
      console.log('🔥 [SIMPLE-VOCAB] Processing idioms/phrasal verbs with pos:', pos);

      const posMapping = {
        'idiom': 'idiom',
        'phrasal verb': 'phrasal_verb'
      };

      const dbPos = posMapping[pos] || pos;
      const dbSource = dbPos === 'phrasal_verb' ? 'phrasal_verb_migration' : 'idiom_migration';

      console.log('🔍 [SIMPLE-VOCAB] Mapped values:', { pos, dbPos, dbSource });

      let whereClause = {
        pos: dbPos,
        source: dbSource,
        language: { code: 'en' }
      };

      // Add search filter if provided
      if (search && search.trim()) {
        whereClause.lemma = {
          contains: search.trim()
        };
      }

      console.log('📋 [SIMPLE-VOCAB] Where clause:', JSON.stringify(whereClause, null, 2));

      const vocabs = await prisma.vocab.findMany({
        where: whereClause,
        skip: offsetInt,
        take: limitInt,
        orderBy: { lemma: 'asc' },
        include: {
          dictentry: {
            select: {
              ipa: true,
              examples: true,
              audioUrl: true
            }
          },
          translations: {
            where: { language: { code: 'ko' } },
            select: {
              translation: true
            }
          }
        }
      });

      console.log(`🎯 [SIMPLE-VOCAB] Found ${vocabs.length} ${pos} items`);

      const transformedData = vocabs.map(vocab => {
        const dictentry = vocab.dictentry || {};
        const koTranslation = vocab.translations[0];
        const examples = dictentry.examples || [];

        let example = '';
        let koExample = '';

        if (examples.length > 0) {
          if (examples[0].en) {
            example = examples[0].en;
            koExample = examples[0].ko || '';
          } else if (typeof examples[0] === 'string') {
            example = examples[0];
          }
        }

        return {
          id: vocab.id,
          lemma: vocab.lemma,
          pos: vocab.pos,
          levelCEFR: vocab.levelCEFR || 'A1',
          ko_gloss: koTranslation ? koTranslation.translation : '번역 없음',
          ipa: dictentry.ipa || '',
          example: example,
          koExample: koExample,
          audioUrl: dictentry.audioUrl
        };
      });

      return res.json({
        success: true,
        count: transformedData.length,
        data: transformedData
      });
    }

    // Original logic for regular vocabulary
    console.log(`[SIMPLE-VOCAB] Fetching ${limitInt} vocabs for level ${levelCEFR}`);

    const vocabs = await prisma.vocab.findMany({
      where: {
        language: { code: 'en' },
        levelCEFR: levelCEFR,
      },
      take: limitInt,
      orderBy: { lemma: 'asc' },
      include: {
        dictentry: {
          select: {
            ipa: true,
            examples: true
          }
        },
        translations: {
          where: { language: { code: 'ko' } }
        }
      }
    });
    
    console.log(`[DEBUG] Found ${vocabs.length} vocabs`);
    
    const simplifiedVocabs = vocabs.map(vocab => {
      let koGloss = '';
      let enExample = '';
      let koExample = '';
      
      // Parse examples from dictentry
      let examples = [];
      if (vocab.dictentry?.examples) {
        try {
          examples = typeof vocab.dictentry.examples === 'string' 
            ? JSON.parse(vocab.dictentry.examples)
            : vocab.dictentry.examples;
        } catch (e) {
          examples = [];
        }
      }
      
      // Extract gloss and example from examples array
      if (Array.isArray(examples)) {
        const glossEntry = examples.find(ex => ex.kind === 'gloss');
        const exampleEntry = examples.find(ex => ex.kind === 'example');
        
        if (glossEntry) {
          koGloss = glossEntry.ko || '';
        }
        if (exampleEntry) {
          enExample = exampleEntry.en || '';
          koExample = exampleEntry.ko || '';
        }
      }
      
      // Fallback to translations if no gloss found
      if (!koGloss && vocab.translations && vocab.translations.length > 0) {
        koGloss = vocab.translations[0].translation;
      }
      
      return {
        id: vocab.id,
        lemma: vocab.lemma,
        pos: vocab.pos,
        levelCEFR: vocab.levelCEFR,
        ko_gloss: koGloss || `뜻: ${vocab.lemma}`,
        ipa: vocab.dictentry?.ipa || '',
        example: enExample,
        koExample: koExample
      };
    });
    
    await prisma.$disconnect();
    
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      // 'Access-Control-Allow-Origin': '*', // Handled by CORS middleware
    });
    res.end(JSON.stringify({
      success: true,
      count: simplifiedVocabs.length,
      data: simplifiedVocabs
    }));
    
  } catch (error) {
    console.error('[SIMPLE-VOCAB] Error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: error.message }));
  }
});


// === SIMPLE EXAM CATEGORIES ENDPOINT (NO MIDDLEWARE) ===
app.get('/simple-exam-categories', async (req, res) => {
  try {
    console.log('[SIMPLE-EXAM] Fetching exam categories');
    
    // Return basic exam categories without database query to avoid issues
    const categories = [
      { name: 'toeic', displayName: 'TOEIC' },
      { name: 'toefl', displayName: 'TOEFL' },
      { name: 'ielts', displayName: 'IELTS' },
      { name: 'basic', displayName: '기초 단어' }
    ];
    
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      // 'Access-Control-Allow-Origin': '*', // Handled by CORS middleware
    });
    res.end(JSON.stringify({
      success: true,
      data: categories
    }));
    
  } catch (error) {
    console.error('[SIMPLE-EXAM] Error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: error.message }));
  }
});

// === SIMPLE VOCAB DETAIL ENDPOINT (NO MIDDLEWARE) ===
app.get('/simple-vocab-detail/:id', async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    const vocabId = parseInt(req.params.id);
    console.log(`[SIMPLE-VOCAB-DETAIL] Fetching details for vocab ID: ${vocabId}`);
    
    const vocab = await prisma.vocab.findUnique({
      where: { id: vocabId },
      include: {
        dictentry: {
          select: {
            ipa: true,
            examples: true,
            audioUrl: true,
            audioLocal: true,
            attribution: true,
            license: true
          }
        },
        translations: {
          include: {
            language: {
              select: {
                code: true,
                name: true
              }
            }
          }
        }
      }
    });
    
    if (!vocab) {
      await prisma.$disconnect();
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Vocabulary not found' }));
      return;
    }
    
    // Get Korean translation from VocabTranslation table (same as simple-vocab endpoint)
    let koGloss = '';
    if (vocab.translations && vocab.translations.length > 0) {
      const koreanTranslation = vocab.translations.find(t => t.language.code === 'ko');
      if (koreanTranslation) {
        koGloss = koreanTranslation.translation;
      }
    }
    
    // Parse examples from dictentry (same as simple-vocab endpoint)
    let examples = [];
    console.log(`[SIMPLE-VOCAB-DETAIL] Raw dictentry.examples:`, vocab.dictentry?.examples);
    if (vocab.dictentry?.examples) {
      try {
        examples = typeof vocab.dictentry.examples === 'string' 
          ? JSON.parse(vocab.dictentry.examples)
          : vocab.dictentry.examples;
        console.log(`[SIMPLE-VOCAB-DETAIL] Parsed examples:`, examples);
      } catch (e) {
        console.log(`[SIMPLE-VOCAB-DETAIL] Failed to parse examples:`, e.message);
        examples = [];
      }
    } else {
      console.log(`[SIMPLE-VOCAB-DETAIL] No dictentry.examples found`);
    }
    
    let enExample = '';
    let koExample = '';
    
    if (Array.isArray(examples) && examples.length > 0) {
      // Use same logic as simple-vocab endpoint
      enExample = examples[0]?.text || '';
      koExample = examples[0]?.translation || '';
    }
    
    const detailData = {
      id: vocab.id,
      lemma: vocab.lemma,
      pos: vocab.pos,
      levelCEFR: vocab.levelCEFR,
      ko_gloss: koGloss || `뜻: ${vocab.lemma}`,
      ipa: vocab.dictentry?.ipa || '',
      ko_example: koExample,
      en_example: enExample,
      audio_url: vocab.dictentry?.audioUrl,
      audio_local: vocab.dictentry?.audioLocal,
      source: vocab.source || 'cefr_vocabs',
      attribution: vocab.dictentry?.attribution,
      license: vocab.dictentry?.license
    };
    
    console.log(`[SIMPLE-VOCAB-DETAIL] Returning data for ${vocab.lemma}:`, {
      ko_gloss: detailData.ko_gloss,
      en_example: detailData.en_example,
      ko_example: detailData.ko_example
    });
    
    await prisma.$disconnect();
    
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      // 'Access-Control-Allow-Origin': '*', // Handled by CORS middleware
    });
    res.end(JSON.stringify({
      success: true,
      data: detailData
    }));
    
  } catch (error) {
    console.error('[SIMPLE-VOCAB-DETAIL] Error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: error.message }));
  }
});

// === SIMPLE AUDIO FILES ENDPOINT (NO MIDDLEWARE) ===
app.get('/simple-audio-files/:level', async (req, res) => {
  try {
    const level = req.params.level;
    console.log(`[SIMPLE-AUDIO] Fetching audio files for level: ${level}`);
    
    // Return basic audio file structure without complex processing
    const audioFiles = [
      { name: 'sample1.mp3', path: `/${level}/audio/sample1.mp3` },
      { name: 'sample2.mp3', path: `/${level}/audio/sample2.mp3` },
      { name: 'sample3.mp3', path: `/${level}/audio/sample3.mp3` }
    ];
    
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      // 'Access-Control-Allow-Origin': '*', // Handled by CORS middleware
    });
    res.end(JSON.stringify({
      success: true,
      level: level,
      files: audioFiles
    }));
    
  } catch (error) {
    console.error('[SIMPLE-AUDIO] Error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: error.message }));
  }
});

// === SIMPLE SRS AVAILABLE ENDPOINT (NO MIDDLEWARE) ===
// DISABLED: 실제 SRS 라우트를 사용하도록 주석 처리
/*
app.get('/srs/available', (req, res) => {
  try {
    console.log('[SIMPLE-SRS] Fetching available SRS data');

    // Return simple mock data to prevent crashes
    const srsData = {
      cardsAvailable: 0,
      cardsReady: 0,
      nextReviewTime: null
    };

    // Add CORS headers manually for this endpoint
    const origin = req.headers.origin;
    const headers = {
      'Content-Type': 'application/json'
    };

    if (origin === 'http://localhost:3000' || origin === 'http://localhost:3001') {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Credentials'] = 'true';
    }

    res.writeHead(200, headers);
    res.end(JSON.stringify({
      success: true,
      data: srsData
    }));

  } catch (error) {
    console.error('[SIMPLE-SRS] Error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: error.message }));
  }
});
*/

// === 정적 파일 서빙 (최우선) ===
// Test route for debugging
app.get('/test-static', (req, res) => {
  console.log('[TEST] Static test route hit');
  res.json({ message: 'Static routing works', timestamp: new Date().toISOString() });
});

// vocabs_example.py로 생성된 레벨별 오디오 라우팅 (인증 불필요) - GCS 리다이렉트
app.use('/starter', createGcsRedirect('starter'));

app.use('/elementary', createGcsRedirect('elementary'));

app.use('/intermediate', createGcsRedirect('intermediate'));

app.use('/upper', createGcsRedirect('upper'));

app.use('/advanced', createGcsRedirect('advanced'));

// === CEFR 레벨 오디오 파일 (GCS 리다이렉트) ===
app.use('/A1/audio', createGcsRedirect('A1/audio'));

app.use('/A2/audio', createGcsRedirect('A2/audio'));

app.use('/B1/audio', createGcsRedirect('B1/audio'));

app.use('/B2/audio', createGcsRedirect('B2/audio'));

app.use('/C1/audio', createGcsRedirect('C1/audio'));

app.use('/C2/audio', createGcsRedirect('C2/audio'));

// 숙어/구동사 오디오 서빙 (인증 불필요) - GCS 리다이렉트
app.use('/idiom', createGcsRedirect('idiom'));

app.use('/phrasal_verb', createGcsRedirect('phrasal_verb'));

// 비디오 파일 서빙 - 압축 최적화 적용
app.use('/api/video', staticFileLogging, preCompressedStatic(path.join(__dirname, 'out')));

// === 압축 및 최적화 미들웨어 (최우선 적용) ===
// TEMPORARILY DISABLED: compression middleware causing RangeError
// app.use(advancedCompression);
// app.use(contentTypeOptimization);
// app.use(responseSizeMonitoring);
// app.use(brotliCompression);

// CORS 설정을 정적 파일보다 먼저 적용
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://project-1ujdn.vercel.app',
      'https://project-1ujdn-git-railway-deploy-fix-hyunseoks-projects-8b90da92.vercel.app',
      'https://project-1ujdn-9npzyfdcg-hyunseoks-projects-8b90da92.vercel.app'
    ];
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin || allowedOrigins.includes(origin) || origin.includes('vercel.app')) {
      callback(null, true);
    } else {
      console.log('[CORS] Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// 추가 CORS 헤더 보장 미들웨어
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://project-1ujdn.vercel.app',
    'https://project-1ujdn-git-railway-deploy-fix-hyunseoks-projects-8b90da92.vercel.app',
    'https://project-1ujdn-9npzyfdcg-hyunseoks-projects-8b90da92.vercel.app'
  ];

  if (allowedOrigins.includes(origin) || (origin && origin.includes('vercel.app'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.sendStatus(204);
  }
  
  next();
});

// 정적 파일 최적화 적용
app.use('/public', staticFileLogging, imageOptimization, preCompressedStatic(path.join(__dirname, 'public')));

// JLPT 오디오 파일 서빙 - GCS 리다이렉트
app.use('/jlpt', createGcsRedirect('public/jlpt'));

// 리스닝 오디오 파일 서빙 - GCS 리다이렉트
// 영어 리스닝
app.use('/A1_Listening_mix', gcsListeningRedirect('A1'));
app.use('/A2_Listening_mix', gcsListeningRedirect('A2'));
app.use('/B1_Listening_mix', gcsListeningRedirect('B1'));
app.use('/B2_Listening_mix', gcsListeningRedirect('B2'));
app.use('/C1_Listening_mix', gcsListeningRedirect('C1'));
app.use('/C2_Listening_mix', gcsListeningRedirect('C2'));

// 일본어 리스닝
app.use('/N1_Listening_mix', gcsListeningRedirect('N1'));
app.use('/N2_Listening_mix', gcsListeningRedirect('N2'));
app.use('/N3_Listening_mix', gcsListeningRedirect('N3'));
app.use('/N4_Listening_mix', gcsListeningRedirect('N4'));
app.use('/N5_Listening_mix', gcsListeningRedirect('N5'));
app.use(express.json({ limit: '10mb' })); // JSON 크기 제한 증가
app.use(cookieParser());

// === API 응답 최적화 ===
// TEMPORARILY DISABLED: apiResponseOptimization causing RangeError
// app.use(apiResponseOptimization);
app.use(apiCacheOptimization);

// === 응답 포맷 표준화 미들웨어 ===
// TEMPORARILY DISABLED: responseFormatMiddleware causing RangeError
// app.use(responseFormatMiddleware);

// === API 버전 관리 미들웨어 ===
// TEMPORARILY DISABLED: detectApiVersion causing RangeError  
// app.use(detectApiVersion);
// TEMPORARILY DISABLED: validateApiVersion causing API version undefined error
// app.use(validateApiVersion([1])); // 현재 v1만 지원
// app.use(deprecationWarning);
// TEMPORARILY DISABLED: formatApiResponse causing RangeError
// app.use(formatApiResponse);

// Simple vocab endpoint for idioms/phrasal verbs (must be before other API routes)
app.get('/api/simple-vocab', async (req, res) => {
  console.log('>>>>>>> API/SIMPLE-VOCAB ENDPOINT HIT! <<<<<<<');
  console.log('Query params:', req.query);
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const { limit = 100, offset = 0, levelCEFR = 'A1', pos, search } = req.query;
    console.log('Extracted params:', { limit, offset, levelCEFR, pos, search });

    if (pos) {
      // 실제 데이터베이스의 pos 값과 매핑 (phrasal_verb -> phrasal verb 변환)
      const dbPos = pos === 'phrasal_verb' ? 'phrasal verb' : pos;
      const dbSource = 'idiom_migration'; // 모든 숙어·구동사는 같은 소스

      console.log(`Querying for pos: ${dbPos}, source: ${dbSource}`);

      let whereClause = {
        pos: dbPos,
        source: dbSource,
        language: { code: 'en' }
      };

      if (search && search.trim()) {
        whereClause = {
          AND: [
            { pos: dbPos },
            { source: dbSource },
            { language: { code: 'en' } },
            {
              OR: [
                { lemma: { contains: search.trim() } },
                {
                  translations: {
                    some: {
                      AND: [
                        { language: { code: 'ko' } }, // Korean language
                        { translation: { contains: search.trim() } }
                      ]
                    }
                  }
                }
              ]
            }
          ]
        };
        console.log('Adding search filter (lemma or Korean translation):', search.trim());
      }

      console.log('Final where clause:', JSON.stringify(whereClause, null, 2));

      // Get total count first
      const totalCount = await prisma.vocab.count({
        where: whereClause
      });

      const vocabData = await prisma.vocab.findMany({
        where: whereClause,
        include: {
          language: true,
          translations: {
            include: { language: true }
          },
          dictentry: true
        },
        take: parseInt(limit),
        skip: parseInt(offset)
      });

      console.log(`Found ${vocabData.length} vocab items out of ${totalCount} total`);

      if (vocabData.length === 0) {
        return res.json({
          success: true,
          data: [],
          message: `No ${pos} found${search ? ` for search: "${search}"` : ''}`,
          total: totalCount,
          returned: 0
        });
      }

      const transformedData = vocabData.map(vocab => {
        const koreanTranslation = vocab.translations.find(t => t.language.code === 'ko');

        let examples = [];
        if (vocab.dictentry && vocab.dictentry.examples) {
          examples = Array.isArray(vocab.dictentry.examples)
            ? vocab.dictentry.examples
            : JSON.parse(vocab.dictentry.examples || '[]');
        }

        return {
          id: vocab.id,
          lemma: vocab.lemma,
          pos: vocab.pos,
          levelCEFR: vocab.levelCEFR,
          meaning: koreanTranslation ? koreanTranslation.translation : '',
          audioUrl: vocab.dictentry ? vocab.dictentry.audioUrl : null,
          examples: examples,
          source: vocab.source
        };
      });

      console.log(`Returning ${transformedData.length} transformed items`);

      await prisma.$disconnect();

      return res.json({
        success: true,
        data: transformedData,
        total: totalCount,
        returned: transformedData.length,
        pos: pos,
        search: search || ''
      });
    }

    await prisma.$disconnect();
    res.json({
      success: false,
      error: 'pos parameter is required'
    });

  } catch (error) {
    console.error('Error in /api/simple-vocab:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/test-endpoint', (req, res) => {
  res.json({ message: 'Test endpoint working!', timestamp: new Date().toISOString() });
});

app.get('/api/test-public', (req, res) => {
  res.json({ message: 'Public test endpoint working!', timestamp: new Date().toISOString() });
});

// === 새로운 버전 관리 API (v1) ===
app.use('/api/v1', apiV1Router);

// === 모바일 API (표준 응답 포맷 적용) ===
app.use('/api/mobile', mobileRouter);

// --- 인증 불필요 라우트 (Legacy - 하위 호환성 유지) ---
app.use('/auth', authRoutes);
app.use('/time-accelerator', require('./routes/timeAccelerator').router);  // 시간 가속 API (인증 불필요)
app.use('/dict', dictRoutes);  // 사전 검색 API (인증 불필요)
app.use('/exam-vocab', examVocabRoutes);  // 시험별 단어 API (인증 불필요)
app.use('/api/reading', readingRoutes);  // Reading API (인증 불필요)
app.use('/api/japanese-reading', japaneseReadingRoutes);  // Japanese Reading API (인증 불필요)
app.use('/api/japanese-listening', japaneseListeningRoutes);  // Japanese Listening API (인증 필요)
app.use('/api/listening', require('./routes/listening'));  // Listening API
app.use('/api/idiom', require('./routes/idiom_working')); // Idiom API (인증 불필요) - Working version from test server
app.use('/test-vocab', require('./routes/test-vocab')); // Simple vocab API for mobile app testing
app.use('/api/admin', require('./routes/admin-seeding')); // Admin seeding API
// Vocab-by-pos endpoint for idiom/phrasal verb integration (unauthenticated)
app.get('/api/vocab/vocab-by-pos', async (req, res) => {
  try {
    const { prisma } = require('./lib/prismaClient');
    const { pos, search } = req.query;
    
    console.log('[API] vocab-by-pos called with:', { pos, search });
    
    if (!pos) {
      return res.status(400).json({ ok: false, error: 'pos parameter is required' });
    }
    
    const where = { 
      pos: pos,
      source: 'idiom_migration'
    };
    
    if (search && search.trim()) {
      where.lemma = { contains: search.trim() };
    }
    
    console.log('[API] Query where:', JSON.stringify(where));
    
    const vocabs = await prisma.vocab.findMany({
      where,
      include: {
        dictentry: true
      },
      orderBy: { lemma: 'asc' }
    });
    
    console.log('[API] Found vocabs:', vocabs.length);
    
    // Transform to expected idiom format
    const transformedData = vocabs.map(vocab => {
      const examples = vocab.dictentry?.examples || [];
      const glossExample = examples.find(ex => ex.kind === 'gloss');
      const sentenceExample = examples.find(ex => ex.kind === 'example');
      const usageExample = examples.find(ex => ex.kind === 'usage');
      
      // Parse audio data
      let audioData = {};
      if (vocab.dictentry?.audioLocal) {
        try {
          audioData = JSON.parse(vocab.dictentry.audioLocal);
        } catch (e) {
          console.warn('Failed to parse audio for', vocab.lemma, e.message);
        }
      }
      
      return {
        id: vocab.id,
        idiom: vocab.lemma,
        pos: vocab.pos,
        korean_meaning: glossExample?.ko || '',
        example: sentenceExample?.en || '',
        koExample: sentenceExample?.ko || '',
        koChirpScript: sentenceExample?.chirpScript || '',
        usage_context_korean: usageExample?.ko || '',
        category: `${vocab.levelCEFR}, ${vocab.pos}`,
        audio: audioData
      };
    });
    
    res.json({ 
      ok: true, 
      data: transformedData,
      count: transformedData.length 
    });
    
  } catch (error) {
    console.error('[API] vocab-by-pos error:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

app.use('/api/vocab', vocabRoutes); // Vocab API for unified idiom/phrasal verb access (인증 불필요)

// === 모바일 전용 API (인증 불필요 엔드포인트 포함) ===
app.use('/api/mobile', mobileRouter);

// 오디오 파일 목록 API (인증 불필요)
app.get('/audio-files/:level', (req, res) => {
  try {
    const level = req.params.level; // A1, A2 등
    
    // CEFR 레벨을 실제 폴더명으로 매핑
    const levelToFolder = {
      'A1': 'starter',
      'A2': 'elementary', 
      'B1': 'intermediate',
      'B2': 'upper',
      'C1': 'advanced',
      'C2': 'advanced'
    };
    
    const folderName = levelToFolder[level] || 'starter';
    const audioDir = path.join(__dirname, folderName);
    
    if (!fs.existsSync(audioDir)) {
      return res.status(404).json({ error: `Audio directory for ${level} (${folderName}) not found` });
    }
    
    // 폴더 내의 모든 하위 디렉토리를 검색하여 MP3 파일 찾기
    const files = [];
    
    function collectMp3Files(dir) {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          collectMp3Files(fullPath); // 재귀적으로 하위 디렉토리 검색
        } else if (item.endsWith('.mp3')) {
          files.push(item);
        }
      }
    }
    
    collectMp3Files(audioDir);
    
    res.json({ files: files.sort() });
  } catch (error) {
    console.error('Error reading audio files:', error);
    res.status(500).json({ error: 'Failed to read audio files' });
  }
});

// --- 이 지점부터 인증 필요 ---
app.use((req, res, next) => {
  // Skip auth for API documentation endpoints
  if (req.path === '/api' || req.path === '/docs/api') {
    return next();
  }
  // Skip auth for mobile API (handled internally)
  if (req.path.startsWith('/api/mobile')) {
    return next();
  }
  // Skip auth for simple-vocab API (public idioms/phrasal verbs)
  if (req.path.startsWith('/api/simple-vocab')) {
    return next();
  }
  // Skip auth for test API
  if (req.path.startsWith('/api/test')) {
    return next();
  }
  // Skip auth for reading APIs (but not for submit/record endpoints)
  if (req.path.startsWith('/api/reading') && !req.path.includes('/record')) {
    return next();
  }
  if (req.path.startsWith('/api/japanese-reading') && !req.path.includes('/submit') && !req.path.includes('/history')) {
    return next();
  }
  return authMiddleware(req, res, next);
});

// --- SRS 보강 라우터(기존 srs.js 유지하면서 확장/오버라이드) ---
// app.use(srsFlatExt);            // POST /srs/folders/create 제공
// app.use(srsDashOverride);       // GET /srs/dashboard 안전 오버라이드

// --- 인증 필요한 라우트 ---
app.use('/learn', learnRoutes);
app.use('/vocab', vocabRoutes);
app.use('/quiz', quizRoutes);
app.use('/srs', srsRoutes);     // ✅ 단 한 번만 등록
app.use('/categories', categoryRoutes);
app.use('/my-wordbook', myWordbookRoutes);
app.use('/my-idioms', myIdiomsRoutes);
app.use('/api/odat-note', odatNoteRoutes);
// Idiom API moved to unauthenticated section above
// app.use('/dict', dictRoutes);  // 이미 인증 불필요 섹션에서 등록됨
app.use('/time-machine', timeMachineRouter);  // 타임머신 API
app.use('/api/admin', adminRoutes);  // 관리자 API
app.use('/auto-folder', autoFolderRoutes);  // 자동 폴더 생성 API
app.use('/api/card-reports', cardReportsRoutes);  // 신고 API
app.use(userRoutes);

// --- 크론 ---
require('./cron');

// --- 에러 핸들러 (표준 포맷 적용) ---
app.use(errorResponseMiddleware);

const PORT = process.env.PORT || 4000;

// Initialize database before starting server
const { initializeDatabase } = require('./lib/db-init');

async function startServer() {
  // Initialize database (create tables if needed)
  await initializeDatabase();

  // Start server
  app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
