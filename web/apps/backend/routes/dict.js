// server/routes/dict.js
const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');
const auth = require('../middleware/auth');
const { ok, fail } = require('../lib/resp');
const { convertLocalPathToGcsUrl } = require('../lib/gcsUrls');

// 인증 미들웨어 적용 - 서버 레벨에서 처리되므로 여기서는 불필요
// router.use(auth);

/* GET /dict/search?q=query */
router.get('/search', async (req, res, next) => {
  try {
    console.log('[DICT SEARCH] Request received:', req.query);
    const startTime = Date.now();
    const q = (req.query.q || '').trim();
    
    if (!q) {
      return fail(res, 400, 'Search query (q) is required');
    }

    // 검색 로직: 영단어와 한국어 뜻 모두 지원
    const searchResults = await searchDictionary(q);
    
    const latency = Date.now() - startTime;
    
    return res.json({
      data: {
        entries: searchResults,
        query: q,
        count: searchResults.length
      },
      _latencyMs: latency
    });
    
  } catch (error) {
    console.error('[DICT SEARCH] Error:', error);
    next(error);
  }
});

/**
 * 사전 검색 함수
 * 영단어(lemma)와 한국어 뜻 모두 검색 지원 (영어 단어만)
 */
async function searchDictionary(query) {
  const results = [];
  const queryLower = query.toLowerCase();

  try {
    // 1. 영단어 검색 (lemma 기준) - 영어만 (languageId: 1)
    const queryLowerCase = query.toLowerCase();
    const queryUpperCase = query.toUpperCase();
    const queryCapitalized = query.charAt(0).toUpperCase() + query.slice(1).toLowerCase();

    const vocabsByLemma = await prisma.vocab.findMany({
      where: {
        AND: [
          { languageId: 1 }, // 영어만
          {
            OR: [
              // 정확한 매칭 - 다양한 대소문자 조합
              { lemma: { equals: query } },
              { lemma: { equals: queryLowerCase } },
              { lemma: { equals: queryUpperCase } },
              { lemma: { equals: queryCapitalized } },
              // 시작 문자 매칭
              { lemma: { startsWith: query } },
              { lemma: { startsWith: queryLowerCase } },
              { lemma: { startsWith: queryUpperCase } },
              { lemma: { startsWith: queryCapitalized } },
              // 부분 매칭
              { lemma: { contains: query } },
              { lemma: { contains: queryLowerCase } },
              { lemma: { contains: queryUpperCase } },
              { lemma: { contains: queryCapitalized } }
            ]
          }
        ]
      },
      include: {
        dictentry: true,
        translations: {
          where: { languageId: 2 } // 한국어 번역 포함
        }
      },
      take: 20 // 중복 제거 전이므로 더 많이 가져오기
    });

    // 2. 한국어 검색: VocabTranslation 테이블에서 검색
    let vocabsByKorean = [];

    // 한국어가 포함된 쿼리인지 확인 (한글 문자 포함)
    const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(query);

    if (hasKorean && query.length >= 1) { // 한국어 검색
      try {
        // VocabTranslation 테이블에서 한국어 번역 검색 (영어 단어만)
        vocabsByKorean = await prisma.vocab.findMany({
          where: {
            AND: [
              { languageId: 1 }, // 영어 단어만
              {
                translations: {
                  some: {
                    translation: {
                      contains: query
                    },
                    languageId: 2 // 한국어 언어 ID
                  }
                }
              }
            ]
          },
          include: {
            dictentry: true,
            translations: {
              where: {
                languageId: 2 // 한국어만 포함
              }
            }
          },
          take: 10 // 상위 10개
        });

      } catch (koreanSearchError) {
        console.warn('[DICT SEARCH] Korean search failed:', koreanSearchError.message);
        vocabsByKorean = [];
      }
    }

    // 결과 통합 및 중복 제거
    const allVocabs = [...vocabsByLemma, ...vocabsByKorean];
    const uniqueVocabs = allVocabs.filter((vocab, index, self) => 
      index === self.findIndex(v => v.id === vocab.id)
    );

    // 검색 우선순위: 영어 검색 시 lemma 유사도 기준, 한국어 검색 시 번역 유사도 기준
    uniqueVocabs.sort((a, b) => {
      const aLemma = a.lemma.toLowerCase();
      const bLemma = b.lemma.toLowerCase();

      if (hasKorean) {
        // 한국어 검색: 번역 정확도 기준으로 정렬
        const aTranslationScore = getKoreanTranslationScore(a, query);
        const bTranslationScore = getKoreanTranslationScore(b, query);

        if (aTranslationScore !== bTranslationScore) {
          return bTranslationScore - aTranslationScore; // 높은 점수가 먼저
        }

        // 점수가 같으면 CEFR 레벨 우선순위
        const aLevel = getLevelPriority(a.levelCEFR);
        const bLevel = getLevelPriority(b.levelCEFR);
        if (aLevel !== bLevel) return aLevel - bLevel;
      } else {
        // 영어 검색: lemma 유사도 기준으로 정렬
        const aLemmaScore = getEnglishLemmaScore(aLemma, queryLower);
        const bLemmaScore = getEnglishLemmaScore(bLemma, queryLower);

        if (aLemmaScore !== bLemmaScore) {
          return bLemmaScore - aLemmaScore; // 높은 점수가 먼저
        }

        // 점수가 같으면 CEFR 레벨 우선순위
        const aLevel = getLevelPriority(a.levelCEFR);
        const bLevel = getLevelPriority(b.levelCEFR);
        if (aLevel !== bLevel) return aLevel - bLevel;
      }

      // 모든 조건이 같으면 알파벳 순서
      return aLemma.localeCompare(bLemma);
    });

    // 응답 형식으로 변환
    for (const vocab of uniqueVocabs.slice(0, 10)) {
      const entry = formatDictEntry(vocab);
      if (entry) {
        results.push(entry);
      }
    }

  } catch (error) {
    console.error('[DICT SEARCH] Database error:', error);
    throw error;
  }

  return results;
}

/**
 * CEFR 레벨 우선순위 계산 (낮은 값일수록 높은 우선순위)
 */
function getLevelPriority(level) {
  if (!level) return 999; // 레벨 없음은 가장 낮은 우선순위

  const levelMap = {
    'A1': 1,
    'A2': 2,
    'B1': 3,
    'B2': 4,
    'C1': 5,
    'C2': 6
  };

  return levelMap[level] || 999;
}

/**
 * 영어 lemma 유사도 점수 계산
 * 정확한 매칭 > 시작 문자 매칭 > 포함 검색 순으로 점수 부여
 */
function getEnglishLemmaScore(lemma, query) {
  if (lemma === query) return 100; // 정확한 매칭
  if (lemma.startsWith(query)) return 80; // 시작 문자 매칭
  if (lemma.includes(query)) return 60; // 포함 검색
  return 0; // 매칭 없음
}

/**
 * 한국어 번역 유사도 점수 계산
 * 정확한 번역 매칭 > 시작 문자 매칭 > 포함 검색 순으로 점수 부여
 */
function getKoreanTranslationScore(vocab, query) {
  if (!vocab.translations || !Array.isArray(vocab.translations)) return 0;

  let maxScore = 0;

  for (const translation of vocab.translations) {
    const translationText = translation.translation;
    if (!translationText) continue;

    if (translationText === query) {
      maxScore = Math.max(maxScore, 100); // 정확한 번역 매칭
    } else if (translationText.startsWith(query)) {
      maxScore = Math.max(maxScore, 80); // 시작 문자 매칭
    } else if (translationText.includes(query)) {
      maxScore = Math.max(maxScore, 60); // 포함 검색
    }
  }

  return maxScore;
}

/**
 * Vocab + DictEntry를 프론트엔드 형식으로 변환
 */
function formatDictEntry(vocab) {
  try {
    const entry = {
      lemma: vocab.lemma,
      pos: vocab.pos || 'unknown',
      ipa: null,
      audio: null,
      license: null,
      attribution: null,
      examples: []
    };


    // DictEntry 정보 추가
    if (vocab.dictentry) {
      entry.ipa = vocab.dictentry.ipa;
      entry.license = vocab.dictentry.license;
      entry.attribution = vocab.dictentry.attribution;
      
      // 오디오 URL 처리
      if (vocab.dictentry.audioLocal) {
        // audioLocal이 JSON 객체인 경우 word 경로 추출
        try {
          const audioData = typeof vocab.dictentry.audioLocal === 'string'
            ? JSON.parse(vocab.dictentry.audioLocal)
            : vocab.dictentry.audioLocal;

          if (audioData && audioData.word) {
            // starter/apple/word.mp3 또는 idiom/apple_of_my_eye.mp3 형태
            entry.audio = audioData.word.startsWith('/') ? audioData.word : `/${audioData.word}`;
          } else if (typeof vocab.dictentry.audioLocal === 'string') {
            // 문자열인 경우 그대로 사용 (예: "idiom/apple_of_my_eye.mp3")
            entry.audio = vocab.dictentry.audioLocal.startsWith('/') ? vocab.dictentry.audioLocal : `/${vocab.dictentry.audioLocal}`;
          }
        } catch (e) {
          // JSON 파싱 실패 시 문자열로 처리
          if (typeof vocab.dictentry.audioLocal === 'string') {
            entry.audio = vocab.dictentry.audioLocal.startsWith('/') ? vocab.dictentry.audioLocal : `/${vocab.dictentry.audioLocal}`;
          }
        }
      } else if (vocab.dictentry.audioUrl) {
        entry.audio = convertLocalPathToGcsUrl(vocab.dictentry.audioUrl);
      }

      // Examples 처리 - VocabTranslation과 dictentry 모두 확인
      const allExamples = [];

      // 1. VocabTranslation에서 한국어 번역 추가 (한국어 검색 결과인 경우)
      if (vocab.translations && Array.isArray(vocab.translations)) {
        vocab.translations.forEach(translation => {
          if (translation.translation) {
            allExamples.push({
              de: '', // 영어 정의는 없을 수 있음
              ko: translation.translation,
              cefr: vocab.levelCEFR || 'A1',
              type: 'gloss',
              kind: 'gloss'
            });
          }
        });
      }

      // 2. dictentry.examples에서 정의와 예문 추가
      if (vocab.dictentry.examples && Array.isArray(vocab.dictentry.examples)) {
        vocab.dictentry.examples.forEach(posData => {
          if (posData.definitions && Array.isArray(posData.definitions)) {
            posData.definitions.forEach(def => {
              // 한국어 뜻 추가
              if (def.ko_def) {
                allExamples.push({
                  de: def.def || '',
                  ko: def.ko_def || '',
                  cefr: vocab.levelCEFR || 'A1',
                  type: 'definition'
                });
              }

              // 예문 추가
              if (def.examples && Array.isArray(def.examples)) {
                def.examples.forEach(ex => {
                  if (ex.de && ex.ko) {
                    allExamples.push({
                      de: ex.de,
                      ko: ex.ko,
                      cefr: vocab.levelCEFR || 'A1',
                      type: 'example'
                    });
                  }
                });
              }
            });
          }
        });
      }

      // 우선순위: gloss > definition > example
      const glosses = allExamples.filter(ex => ex.type === 'gloss');
      const definitions = allExamples.filter(ex => ex.type === 'definition');
      const examples = allExamples.filter(ex => ex.type === 'example');

      entry.examples = [
        ...glosses.slice(0, 1),
        ...definitions.slice(0, 1),
        ...examples.slice(0, 1)
      ].filter(Boolean);
    }

    return entry;
    
  } catch (error) {
    console.error('[DICT FORMAT] Error formatting entry for vocab:', vocab.id, error);
    return null;
  }
}

module.exports = router;
