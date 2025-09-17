// server/routes/vocab.js
const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');

console.log('📊 [VOCAB ROUTER] vocab.js router loaded');

// Add middleware to log all requests to this router
router.use((req, res, next) => {
  console.log(`🎯 [VOCAB ROUTER] Request: ${req.method} ${req.path} | Query:`, req.query);
  next();
});

// Test endpoint
router.get('/test', (req, res) => {
  console.log('✅ [VOCAB TEST] Test endpoint hit');
  res.json({ message: 'vocab route works!' });
});

// Simple phrasal verb test
router.get('/phrasal-test', async (req, res) => {
  console.log('🔥 [PHRASAL TEST] Phrasal verb test endpoint hit');
  try {
    const phrasalVerbs = await prisma.vocab.findMany({
      where: {
        pos: 'phrasal_verb',
        source: 'phrasal_verb_migration'
      },
      take: 5,
      include: {
        translations: {
          include: { language: true }
        }
      }
    });
    console.log('🔥 [PHRASAL TEST] Found:', phrasalVerbs.length, 'phrasal verbs');
    res.json({
      message: 'phrasal verb test',
      count: phrasalVerbs.length,
      data: phrasalVerbs.slice(0,2)
    });
  } catch (error) {
    console.error('❌ [PHRASAL TEST] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /vocab/list
router.get('/list', async (req, res) => {
  try {
    const { level, q } = req.query;
    const where = {};
    if (q && q.trim()) {
      // Support both English lemma and Korean translation search
      where.OR = [
        { lemma: { contains: q.trim() } },
        {
          translations: {
            some: {
              AND: [
                { languageId: 2 }, // Korean language ID
                { translation: { contains: q.trim() } }
              ]
            }
          }
        }
      ];

      // If level is specified, also filter by level (for CEFR tab search)
      if (level) {
        where.AND = [
          { OR: where.OR },
          { levelCEFR: level }
        ];
        delete where.OR;
      }

      // Always exclude idioms and phrasal verbs
      if (where.AND) {
        where.AND.push({
          pos: { notIn: ['idiom', 'phrasal_verb'] }
        });
      } else {
        where.pos = { notIn: ['idiom', 'phrasal_verb'] };
      }
    } else {
      where.levelCEFR = level || 'A1';
      // Exclude idioms and phrasal verbs from level-based vocabulary
      where.pos = {
        notIn: ['idiom', 'phrasal_verb']
      };
    }
    
    console.log('DEBUG /list: Query where:', JSON.stringify(where));
    
    // First get vocabs without include to avoid potential issues
    const vocabs = await prisma.vocab.findMany({
      where,
      orderBy: { lemma: 'asc' }
    });
    
    console.log('DEBUG /list: Found vocabs:', vocabs.length);
    
    // Get dictentries for all vocabs
    const vocabIds = vocabs.map(v => v.id);
    const dictentries = await prisma.dictentry.findMany({
      where: { vocabId: { in: vocabIds } }
    });
    
    // VocabTranslation 테이블에서 한국어 번역 가져오기
    const vocabTranslations = await prisma.vocabTranslation.findMany({
      where: {
        vocabId: { in: vocabIds },
        language: { code: 'ko' }
      },
      include: {
        language: true
      }
    });

    // VocabTranslation을 vocabId로 매핑
    const translationMap = new Map();
    vocabTranslations.forEach(t => {
      translationMap.set(t.vocabId, t.translation);
    });

    console.log('DEBUG /list: Found VocabTranslations:', vocabTranslations.length);
    
    console.log('DEBUG /list: Found dictentries:', dictentries.length);
    if (dictentries.length > 0) {
      console.log('DEBUG /list: First dictentry:', JSON.stringify(dictentries[0], null, 2));
    }
    
    // Create map for quick lookup
    const dictMap = new Map();
    
    dictentries.forEach(d => {
      // Parse examples if it's a string
      let parsedExamples = d.examples;
      if (typeof d.examples === 'string') {
        try {
          parsedExamples = JSON.parse(d.examples);
        } catch (e) {
          console.warn('Failed to parse examples for vocabId', d.vocabId);
          parsedExamples = [];
        }
      }
      dictMap.set(d.vocabId, { ...d, examples: parsedExamples });
    });

    const items = vocabs.map(v => {
      const dictentry = dictMap.get(v.id);
      const rawMeanings = Array.isArray(dictentry?.examples) ? dictentry.examples : [];

      // Korean gloss 추출 - VocabTranslation 테이블 우선
      let primaryGloss = translationMap.get(v.id) || null;

      // VocabTranslation에 없으면 기존 방식 시도
      if (!primaryGloss) {
        // 1. examples에서 gloss kind 찾기 (실제 단어 뜻)
        if (rawMeanings.length > 0) {
          const glossExample = rawMeanings.find(ex => ex.kind === 'gloss' && ex.ko && ex.ko.trim());
          if (glossExample && glossExample.ko) {
            primaryGloss = glossExample.ko;
          }
        }

        // 2. ipaKo 사용 (fallback)
        if (!primaryGloss && dictentry?.ipaKo) {
          primaryGloss = dictentry.ipaKo;
        }
      }
      
      return {
        id: v.id, lemma: v.lemma, pos: v.pos, levelCEFR: v.levelCEFR,
        ko_gloss: primaryGloss, ipa: dictentry?.ipa ?? null,
        ipaKo: dictentry?.ipaKo ?? null, audio: dictentry?.audioUrl ?? null,
        examples: rawMeanings
      };
    });

    console.log('DEBUG /list: First item with dictentry:', JSON.stringify(items[0], null, 2));
    if (items[0]) {
      console.log('DEBUG /list: ipa:', items[0].ipa);
      console.log('DEBUG /list: ipaKo:', items[0].ipaKo);
    }
    return res.json({ data: items });
  } catch (e) {
    console.error('GET /vocab/list failed:', e);
    return res.status(500).json({ error: 'list query failed' });
  }
});

// ✅ MUST COME BEFORE "/:id"
// GET /vocab/search?q=...&limit=20&languageId=3
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim();
    const languageId = parseInt(req.query.languageId, 10);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10) || 20, 1), 50);

    if (!q) return res.json({ data: [] });

    console.log(`🔍 [VOCAB SEARCH] Searching for: "${q}" in language: ${languageId}`);

    let vocabs = [];
    const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(q);

    if (hasKorean) {
      // 한국어 검색: 언어별로 다른 검색 로직 사용
      console.log(`🇰🇷 [VOCAB SEARCH] Korean search for: "${q}" in language: ${languageId}`);

      if (languageId === 3) {
        // 일본어: VocabTranslation과 dictentry 모두에서 검색
        console.log(`🇯🇵 [VOCAB SEARCH] Japanese Korean search`);
        vocabs = await prisma.vocab.findMany({
          where: {
            AND: [
              { languageId: 3 }, // 일본어
              {
                OR: [
                  // VocabTranslation에서 검색
                  {
                    translations: {
                      some: {
                        translation: { contains: q },
                        languageId: 2 // 한국어
                      }
                    }
                  },
                  // dictentry.examples에서 koGloss 검색 (일본어 특별 구조)
                  {
                    dictentry: {
                      examples: {
                        path: '$[*].koGloss',
                        string_contains: q
                      }
                    }
                  }
                ]
              }
            ]
          },
          include: {
            dictentry: true,
            translations: {
              where: { languageId: 2 } // 한국어 번역
            }
          },
          take: limit,
          orderBy: { lemma: 'asc' }
        });
      } else {
        // 영어: VocabTranslation에서만 검색
        vocabs = await prisma.vocab.findMany({
          where: {
            AND: [
              languageId ? { languageId } : {},
              {
                translations: {
                  some: {
                    translation: { contains: q },
                    languageId: 2 // 한국어
                  }
                }
              }
            ]
          },
          include: {
            translations: {
              where: { languageId: 2 } // 한국어 번역만
            }
          },
          take: limit,
          orderBy: { lemma: 'asc' }
        });
      }
    } else {
      // 일본어/영어 검색: lemma에서 검색
      console.log(`🔤 [VOCAB SEARCH] Lemma search for: "${q}"`);
      vocabs = await prisma.vocab.findMany({
        where: {
          AND: [
            languageId ? { languageId } : {},
            { lemma: { contains: q } }
          ]
        },
        include: {
          translations: {
            where: { languageId: 2 } // 한국어 번역
          }
        },
        take: limit,
        orderBy: { lemma: 'asc' }
      });
    }

    console.log('DEBUG: Found vocabs:', vocabs.length);

    // Get dictentry separately to debug the relationship
    if (vocabs.length > 0) {
      const dictentries = await prisma.dictentry.findMany({
        where: { vocabId: vocabs[0].id }
      });
      console.log('DEBUG: Found dictentries for first vocab:', dictentries.length);
      console.log('DEBUG: First dictentry:', JSON.stringify(dictentries[0], null, 2));
    }

    // VocabTranslation 테이블에서 한국어 번역 가져오기
    const vocabIds = vocabs.map(v => v.id);
    const vocabTranslations = await prisma.vocabTranslation.findMany({
      where: {
        vocabId: { in: vocabIds },
        language: { code: 'ko' }
      },
      include: {
        language: true
      }
    });

    // VocabTranslation을 vocabId로 매핑
    const translationMap = new Map();
    vocabTranslations.forEach(t => {
      translationMap.set(t.vocabId, t.translation);
    });

    const data = vocabs.map(v => {
      const rawMeanings = Array.isArray(v.dictentry?.examples) ? v.dictentry.examples : [];
      
      // 고급 중복 제거: pos 기준으로 그룹화하여 가장 좋은 것만 선택
      const posGroups = new Map();
      for (const meaning of rawMeanings) {
        const pos = (meaning.pos || 'unknown').toLowerCase().trim();
        if (!posGroups.has(pos)) {
          posGroups.set(pos, []);
        }
        posGroups.get(pos).push(meaning);
      }
      
      const meanings = [];
      for (const [pos, groupMeanings] of posGroups.entries()) {
        if (groupMeanings.length === 1) {
          meanings.push(groupMeanings[0]);
        } else {
          // 같은 pos를 가진 여러 meanings 중에서 최고 선택
          const best = groupMeanings.reduce((prev, current) => {
            const prevExampleCount = prev.definitions?.[0]?.examples?.length || 0;
            const currentExampleCount = current.definitions?.[0]?.examples?.length || 0;
            
            if (currentExampleCount > prevExampleCount) return current;
            if (prevExampleCount > currentExampleCount) return prev;
            
            const prevKoDef = prev.definitions?.[0]?.ko_def || '';
            const currentKoDef = current.definitions?.[0]?.ko_def || '';
            
            if (currentKoDef.length > prevKoDef.length) return current;
            if (prevKoDef.length > currentKoDef.length) return prev;
            
            const prevDef = prev.definitions?.[0]?.def || '';
            const currentDef = current.definitions?.[0]?.def || '';
            
            return currentDef.length > prevDef.length ? current : prev;
          });
          meanings.push(best);
        }
      }

      // Korean gloss 추출 - VocabTranslation 테이블 우선
      let primaryGloss = translationMap.get(v.id) || null;

      // VocabTranslation에 없으면 기존 방식 시도
      if (!primaryGloss) {
        // CEFR 구조: examples[].ko (gloss kind)
        const glossExample = rawMeanings.find(ex => ex.kind === 'gloss');
        if (glossExample && glossExample.ko) {
          primaryGloss = glossExample.ko;
        }

        // 만약 gloss가 없다면 첫 번째 example의 ko 사용
        if (!primaryGloss && rawMeanings.length > 0 && rawMeanings[0].ko) {
          primaryGloss = rawMeanings[0].ko;
        }
      }

      // 기존 복잡한 구조도 지원 (backward compatibility) - 실제로 meanings 배열 생성 안함
      // if (!primaryGloss && meanings.length > 0 && meanings[0].definitions?.length > 0) {
      //   primaryGloss = meanings[0].definitions[0].ko_def || null;
      // }
      
      return {
        id: v.id,
        lemma: v.lemma,
        pos: v.pos,
        level: v.levelCEFR,
        levelJLPT: v.levelJLPT, // JLPT 레벨 추가
        ko_gloss: primaryGloss,
        ipa: v.dictentry?.ipa ?? null,
        ipaKo: v.dictentry?.ipaKo ?? null,
        audio: v.dictentry?.audioUrl ?? null,
        examples: rawMeanings
      };
    });

    return res.json({ data });
  } catch (e) {
    console.error('GET /vocab/search failed:', e);
    return res.status(500).json({ error: 'search failed' });
  }
});

// Test route to check if this file is loaded
router.get('/vocab-by-pos-test', (req, res) => {
  console.log('🧪 [VOCAB-BY-POS-TEST] Test route hit');
  res.json({ message: 'vocab-by-pos test works!' });
});

// GET /vocab-by-pos - Get vocabularies by part of speech (for idioms and phrasal verbs)
// MUST come before /:id route to avoid route conflicts
router.get('/idioms-phrasal', async (req, res) => {
  console.log('🚀 [VOCAB-BY-POS] Route hit with query:', req.query);
  try {
    const { pos, search } = req.query;
    
    if (!pos) {
      return res.status(400).json({ error: 'pos parameter is required' });
    }
    
    // Map frontend pos parameter to database values
    const posMapping = {
      'idiom': 'idiom',
      'phrasal verb': 'phrasal_verb'
    };

    const dbPos = posMapping[pos] || pos;
    const dbSource = dbPos === 'phrasal_verb' ? 'phrasal_verb_migration' : 'idiom_migration';

    const where = {
      pos: dbPos,
      source: dbSource
    };
    
    // Add search filter if provided
    if (search && search.trim()) {
      where.lemma = { contains: search.trim() };
    }
    
    console.log('DEBUG /vocab-by-pos: Query where:', JSON.stringify(where));
    
    // Get vocabs
    const vocabs = await prisma.vocab.findMany({
      where,
      orderBy: { lemma: 'asc' }
    });
    
    console.log('DEBUG /vocab-by-pos: Found vocabs:', vocabs.length);
    
    // Get dictentries separately
    const vocabIds = vocabs.map(v => v.id);
    const dictentries = await prisma.dictentry.findMany({
      where: { vocabId: { in: vocabIds } },
      select: { vocabId: true, examples: true, ipa: true, ipaKo: true, audioUrl: true, audioLocal: true }
    });
    
    console.log('DEBUG /vocab-by-pos: Found dictentries:', dictentries.length);
    
    // Create a map for quick lookup
    const dictMap = new Map();
    dictentries.forEach(d => {
      // Parse examples if it's a string
      let parsedExamples = d.examples;
      if (typeof d.examples === 'string') {
        try {
          parsedExamples = JSON.parse(d.examples);
        } catch (e) {
          console.warn('Failed to parse examples for vocabId', d.vocabId);
          parsedExamples = [];
        }
      }
      dictMap.set(d.vocabId, { ...d, examples: parsedExamples });
    });

    // VocabTranslation 테이블에서 한국어 번역 가져오기
    const vocabTranslations = await prisma.vocabTranslation.findMany({
      where: {
        vocabId: { in: vocabIds },
        language: { code: 'ko' }
      },
      include: {
        language: true
      }
    });

    // VocabTranslation을 vocabId로 매핑
    const translationMap = new Map();
    vocabTranslations.forEach(t => {
      translationMap.set(t.vocabId, t.translation);
    });

    const items = vocabs.map(v => {
      const dictentry = dictMap.get(v.id);
      const rawMeanings = Array.isArray(dictentry?.examples) ? dictentry.examples : [];

      // Korean gloss 추출 - VocabTranslation 테이블 우선
      let primaryGloss = translationMap.get(v.id) || null;

      // VocabTranslation에 없으면 기존 방식 시도
      if (!primaryGloss) {
        const glossExample = rawMeanings.find(ex => ex.kind === 'gloss');
        if (glossExample && glossExample.ko) {
          primaryGloss = glossExample.ko;
        }
      }
      
      // Extract English example and Korean example
      let englishExample = null;
      let koreanExample = null;
      const exampleEntry = rawMeanings.find(ex => ex.kind === 'example');
      if (exampleEntry) {
        englishExample = exampleEntry.en || null;
        koreanExample = exampleEntry.ko || null;
      }
      
      // Extract usage context
      let usageContext = null;
      const usageEntry = rawMeanings.find(ex => ex.kind === 'usage');
      if (usageEntry) {
        usageContext = usageEntry.ko || null;
      }
      
      return {
        id: v.id,
        lemma: v.lemma,
        pos: v.pos,
        levelCEFR: v.levelCEFR,
        ko_gloss: primaryGloss,
        example: englishExample,
        koExample: koreanExample,
        usage_context_korean: usageContext,
        ipa: dictentry?.ipa ?? null,
        ipaKo: dictentry?.ipaKo ?? null,
        audio: dictentry?.audioUrl ?? null,
        dictentry: {
          audioLocal: dictentry?.audioLocal || null,
          examples: rawMeanings,
          ipa: dictentry?.ipa ?? null,
          ipaKo: dictentry?.ipaKo ?? null
        }
      };
    });

    console.log('DEBUG /vocab-by-pos: First item:', JSON.stringify(items[0], null, 2));
    return res.json({ data: items });
  } catch (e) {
    console.error('GET /vocab-by-pos failed:', e);
    return res.status(500).json({ error: 'vocab-by-pos query failed' });
  }
});

// GET /vocab/japanese-list - Get Japanese vocabulary by JLPT level (MUST BE BEFORE /:id)
router.get('/japanese-list', async (req, res) => {
  try {
    const { level = 'N5', search, q } = req.query;
    const searchTerm = search || q;

    // Get Japanese language
    const japaneseLanguage = await prisma.language.findUnique({
      where: { code: 'ja' }
    });

    if (!japaneseLanguage) {
      return res.status(404).json({ error: 'Japanese language not found' });
    }

    // Build query
    let where = {
      languageId: japaneseLanguage.id,
      levelJLPT: level
    };

    if (searchTerm && searchTerm.trim()) {
      where = {
        AND: [
          { languageId: japaneseLanguage.id },
          { levelJLPT: level },
          {
            OR: [
              { lemma: { contains: searchTerm.trim() } },
              {
                translations: {
                  some: {
                    AND: [
                      { languageId: 2 }, // Korean language ID
                      { translation: { contains: searchTerm.trim() } }
                    ]
                  }
                }
              }
            ]
          }
        ]
      };
    }

    console.log('DEBUG /japanese-list: Query where:', JSON.stringify(where));

    // Get Japanese vocabs
    const vocabs = await prisma.vocab.findMany({
      where,
      include: {
        dictentry: true,
        translations: {
          where: {
            OR: [
              { languageId: 2 }, // Korean
              { languageId: 1 }  // English
            ]
          },
          include: {
            language: true
          }
        }
      },
      orderBy: { lemma: 'asc' }
    });

    console.log('DEBUG /japanese-list: Found vocabs:', vocabs.length);

    // Format response
    const items = vocabs.map(v => {
      const dictentry = v.dictentry;
      const koTranslation = v.translations.find(t => t.language.code === 'ko');
      const enTranslation = v.translations.find(t => t.language.code === 'en');

      // Parse examples from dictentry
      let examples = {};
      if (dictentry?.examples) {
        if (typeof dictentry.examples === 'string') {
          try {
            examples = JSON.parse(dictentry.examples);
          } catch (e) {
            console.warn('Failed to parse examples for vocabId', v.id);
          }
        } else {
          examples = dictentry.examples;
        }
      }

      return {
        id: v.id,
        lemma: v.lemma,
        pos: v.pos,
        levelJLPT: v.levelJLPT,
        kana: dictentry?.ipa || examples.kana || '',
        romaji: dictentry?.ipaKo || examples.romaji || '',
        kanji: examples.kanji || null,
        onyomi: examples.onyomi || null,
        kunyomi: examples.kunyomi || null,
        ko_gloss: koTranslation?.translation || '',
        en_gloss: enTranslation?.translation || '',
        example: examples.example || '',
        exampleKana: examples.exampleKana || '',
        exampleTranslation: examples.exampleTranslation || '',
        audio: dictentry?.audioUrl || null
      };
    });

    res.json({
      ok: true,
      data: items
    });

  } catch (error) {
    console.error('GET /vocab/japanese-list failed:', error);
    res.status(500).json({ error: 'Failed to fetch Japanese vocabulary' });
  }
});

// GET /vocab/:id  ← "/search" 아래에 둬야 함
router.get('/:id', async (req, res) => {
  console.log('🔍 [VOCAB-ID] Route hit with param:', req.params.id);
  const vocabId = Number(req.params.id);
  if (!vocabId || !Number.isFinite(vocabId)) {
    console.log('❌ [VOCAB-ID] Invalid vocab ID:', req.params.id);
    return res.status(400).json({ error: 'Invalid vocab ID' });
  }
  try {
    console.log(`DEBUG /:id: Looking for vocab ${vocabId}`);
    
    // Get vocab without include first
    const vocab = await prisma.vocab.findUnique({
      where: { id: vocabId }
    });
    
    if (!vocab) {
      return res.status(404).json({ error: '단어를 찾을 수 없습니다.' });
    }
    
    console.log(`DEBUG /:id: Found vocab:`, vocab.lemma);
    
    // Get dictentry separately
    const dictentry = await prisma.dictentry.findFirst({
      where: { vocabId: vocabId }
    });
    
    console.log(`DEBUG /:id: Found dictentry:`, !!dictentry);
    if (dictentry) {
      console.log(`DEBUG /:id: Dictentry examples length:`, Array.isArray(dictentry.examples) ? dictentry.examples.length : 'not array');
      console.log(`DEBUG /:id: dictentry.ipa:`, dictentry.ipa);
      console.log(`DEBUG /:id: dictentry.ipaKo:`, dictentry.ipaKo);
      console.log(`DEBUG /:id: dictentry.audioUrl:`, dictentry.audioUrl);
    }
    
    // Parse dictentry examples if it's a string
    if (dictentry && typeof dictentry.examples === 'string') {
      try {
        dictentry.examples = JSON.parse(dictentry.examples);
      } catch (e) {
        console.warn('Failed to parse dictentry examples for vocab', vocabId);
        dictentry.examples = [];
      }
    }

    // VocabTranslation 테이블에서 한국어 번역 가져오기
    const vocabTranslation = await prisma.vocabTranslation.findFirst({
      where: {
        vocabId: vocabId,
        language: { code: 'ko' }
      },
      include: {
        language: true
      }
    });

    // Parse examples from dictentry for Japanese words
    let examples = {};
    if (dictentry?.examples) {
      if (typeof dictentry.examples === 'string') {
        try {
          examples = JSON.parse(dictentry.examples);
        } catch (e) {
          console.warn('Failed to parse examples for vocabId', vocabId);
        }
      } else {
        examples = dictentry.examples;
      }
    }

    // Check if this is a Japanese word (has Japanese language ID or dictentry with kana/ipa)
    const isJapanese = vocab.languageId === 3 || dictentry?.ipa || examples.kana;

    // Combine the results
    const result = {
      ...vocab,
      dictentry: dictentry || null,
      ko_gloss: vocabTranslation?.translation || null
    };

    // Add Japanese-specific fields if this is a Japanese word
    if (isJapanese) {
      result.kana = dictentry?.ipa || examples.kana || '';
      result.romaji = dictentry?.ipaKo || examples.romaji || '';
      result.kanji = examples.kanji || null;
      result.onyomi = examples.onyomi || null;
      result.kunyomi = examples.kunyomi || null;
      result.example = examples.example || '';
      result.koExample = examples.koExample || '';
      result.exampleKana = examples.exampleKana || '';
      result.exampleTranslation = examples.exampleTranslation || '';
    }

    return res.json({ data: result });
  } catch (e) {
    console.error(`GET /vocab/${vocabId} failed:`, e);
    return res.status(500).json({ error: '상세 정보를 불러오는 데 실패했습니다.' });
  }
});

// POST /vocab/:id/bookmark
router.post('/:id/bookmark', async (req, res) => {
  const vocabId = parseInt(req.params.id, 10);
  const userId = req.user.id;
  const folderId = req.body.folderId ? parseInt(req.body.folderId, 10) : null;

  if (isNaN(vocabId)) {
    return res.status(400).json({ error: 'Invalid vocab ID' });
  }

  // 폴더별 독립적인 SRS 카드 검사
  const existing = await prisma.srscard.findFirst({
    where: { 
      userId, 
      itemId: vocabId, 
      itemType: 'vocab',
      folderId: folderId 
    }
  });

  if (existing) {
    return res.status(200).json({ ok: true, id: existing.id, already: true });
  }

  // 폴더별 독립적인 사용자 단어 추가
  const existingUserVocab = await prisma.uservocab.findFirst({
    where: { 
      userId, 
      vocabId,
      folderId: folderId 
    }
  });

  if (!existingUserVocab) {
    await prisma.uservocab.create({
      data: {
        userId,
        vocabId,
        folderId: folderId
      }
    });
  }

  const newCard = await prisma.srscard.create({
    data: {
      userId,
      itemId: vocabId,
      itemType: 'vocab',
      stage: 0,
      nextReviewAt: new Date(),
      folderId: folderId
    }
  });

  return res.status(201).json({ ok: true, id: newCard.id });
});

// GET /vocab/user/:userId/folder/:folderId - 특정 폴더의 사용자 단어 목록
router.get('/user/:userId/folder/:folderId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const folderId = parseInt(req.params.folderId, 10);

    if (isNaN(userId) || isNaN(folderId)) {
      return res.status(400).json({ error: 'Invalid user ID or folder ID' });
    }

    const userVocabs = await prisma.uservocab.findMany({
      where: {
        userId: userId,
        folderId: folderId
      },
      include: {
        vocab: {
          include: {
            dictentry: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const data = userVocabs.map(uv => {
      const v = uv.vocab;
      const dictentry = v.dictentry;
      const rawMeanings = Array.isArray(dictentry?.examples) ? dictentry.examples : [];
      // CEFR 데이터 구조에서 Korean gloss 추출
      let primaryGloss = null;
      
      // CEFR 구조: examples[].ko (gloss kind)
      const glossExample = rawMeanings.find(ex => ex.kind === 'gloss');
      if (glossExample && glossExample.ko) {
        primaryGloss = glossExample.ko;
      }
      
      // 만약 gloss가 없다면 첫 번째 example의 ko 사용
      if (!primaryGloss && rawMeanings.length > 0 && rawMeanings[0].ko) {
        primaryGloss = rawMeanings[0].ko;
      }
      
      // 기존 복잡한 구조도 지원 (backward compatibility) - 실제로 meanings 배열 생성 안함
      // if (!primaryGloss && meanings.length > 0 && meanings[0].definitions?.length > 0) {
      //   primaryGloss = meanings[0].definitions[0].ko_def || null;
      // }
      return {
        id: v.id,
        lemma: v.lemma,
        pos: v.pos,
        levelCEFR: v.levelCEFR,
        ko_gloss: primaryGloss,
        ipa: dictentry?.ipa ?? null,
        ipaKo: dictentry?.ipaKo ?? null,
        audio: dictentry?.audioUrl ?? null,
        examples: rawMeanings,
        addedAt: uv.createdAt
      };
    });

    return res.json({ data });
  } catch (e) {
    console.error('GET /vocab/user/:userId/folder/:folderId failed:', e);
    return res.status(500).json({ error: 'Failed to fetch user vocabulary for folder' });
  }
});

// GET /vocab/user/:userId - 특정 사용자의 모든 폴더별 단어 목록 (옵션: folderId가 없는 단어들 포함)
router.get('/user/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const includeLegacy = req.query.includeLegacy === 'true'; // 기존 folderId가 null인 단어들 포함 여부

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const where = { userId: userId };
    if (!includeLegacy) {
      where.folderId = { not: null };
    }

    const userVocabs = await prisma.uservocab.findMany({
      where: where,
      include: {
        vocab: {
          include: {
            dictentry: true
          }
        },
        folder: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { folderId: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    const data = userVocabs.map(uv => {
      const v = uv.vocab;
      const dictentry = v.dictentry;
      const rawMeanings = Array.isArray(dictentry?.examples) ? dictentry.examples : [];
      // CEFR 데이터 구조에서 Korean gloss 추출
      let primaryGloss = null;
      
      // CEFR 구조: examples[].ko (gloss kind)
      const glossExample = rawMeanings.find(ex => ex.kind === 'gloss');
      if (glossExample && glossExample.ko) {
        primaryGloss = glossExample.ko;
      }
      
      // 만약 gloss가 없다면 첫 번째 example의 ko 사용
      if (!primaryGloss && rawMeanings.length > 0 && rawMeanings[0].ko) {
        primaryGloss = rawMeanings[0].ko;
      }
      
      // 기존 복잡한 구조도 지원 (backward compatibility) - 실제로 meanings 배열 생성 안함
      // if (!primaryGloss && meanings.length > 0 && meanings[0].definitions?.length > 0) {
      //   primaryGloss = meanings[0].definitions[0].ko_def || null;
      // }
      return {
        id: v.id,
        lemma: v.lemma,
        pos: v.pos,
        levelCEFR: v.levelCEFR,
        ko_gloss: primaryGloss,
        ipa: dictentry?.ipa ?? null,
        ipaKo: dictentry?.ipaKo ?? null,
        audio: dictentry?.audioUrl ?? null,
        examples: rawMeanings,
        addedAt: uv.createdAt,
        folderId: uv.folderId,
        folderName: uv.folder?.name || 'Legacy'
      };
    });

    return res.json({ data });
  } catch (e) {
    console.error('GET /vocab/user/:userId failed:', e);
    return res.status(500).json({ error: 'Failed to fetch user vocabulary' });
  }
});



module.exports = router;
