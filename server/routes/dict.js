// server/routes/dict.js
const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prismaClient');
const auth = require('../middleware/auth');
const { ok, fail } = require('../lib/resp');

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
 * 영단어(lemma)와 한국어 뜻 모두 검색 지원
 */
async function searchDictionary(query) {
  const results = [];
  const queryLower = query.toLowerCase();
  
  try {
    // 1. 영단어 검색 (lemma 기준) - 대소문자 구분하지 않는 검색
    const queryLowerCase = query.toLowerCase();
    const queryUpperCase = query.toUpperCase();
    const queryCapitalized = query.charAt(0).toUpperCase() + query.slice(1).toLowerCase();
    
    const vocabsByLemma = await prisma.vocab.findMany({
      where: {
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
      },
      include: {
        dictentry: true
      },
      take: 20 // 중복 제거 전이므로 더 많이 가져오기
    });

    // 2. 한국어 검색: 우선 모든 사전 정보를 가져와서 메모리에서 필터링
    let vocabsByKorean = [];
    
    // 한국어가 포함된 쿼리인지 확인 (한글 문자 포함)
    const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(query);
    
    if (hasKorean && query.length >= 1) { // 한국어 검색 - 단순화
      try {
        // 모든 dictentry가 있는 단어에서 한국어 검색
        const allVocabsWithDict = await prisma.vocab.findMany({
          where: {
            dictentry: {
              isNot: null
            }
          },
          include: {
            dictentry: true
          },
          take: 30 // 적당한 수로 제한
        });
        
        // 각 단어에서 한국어 검색
        vocabsByKorean = allVocabsWithDict.filter(vocab => {
          if (!vocab.dictentry?.examples || !Array.isArray(vocab.dictentry.examples)) {
            return false;
          }
          
          return vocab.dictentry.examples.some(posData => {
            if (!posData.definitions || !Array.isArray(posData.definitions)) {
              return false;
            }
            
            return posData.definitions.some(def => {
              // ko_def에서 검색 (한국어 뜻)
              if (def.ko_def && def.ko_def.includes(query)) {
                return true;
              }
              
              // 예문의 한국어에서 검색
              if (def.examples && Array.isArray(def.examples)) {
                return def.examples.some(ex => 
                  ex.ko && ex.ko.includes(query)
                );
              }
              
              return false;
            });
          });
        }).slice(0, 5); // 상위 5개만
        
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

    // 정확한 매칭 우선, 그 다음 시작 문자 매칭, 마지막에 포함 검색
    uniqueVocabs.sort((a, b) => {
      const aLemma = a.lemma.toLowerCase();
      const bLemma = b.lemma.toLowerCase();
      
      // 정확한 매칭
      if (aLemma === queryLower) return -1;
      if (bLemma === queryLower) return 1;
      
      // 시작 문자 매칭
      if (aLemma.startsWith(queryLower) && !bLemma.startsWith(queryLower)) return -1;
      if (bLemma.startsWith(queryLower) && !aLemma.startsWith(queryLower)) return 1;
      
      // 알파벳 순서
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
        entry.audio = `/audio/${vocab.dictentry.audioLocal}`;
      } else if (vocab.dictentry.audioUrl) {
        entry.audio = vocab.dictentry.audioUrl;
      }

      // Examples 처리 - 새로운 데이터 구조에 맞게 수정
      if (vocab.dictentry.examples && Array.isArray(vocab.dictentry.examples)) {
        const allExamples = [];
        
        // 각 pos별 정의와 예문 추출
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
        
        // 상위 3개만 선택 (정의 우선, 그 다음 예문)
        const definitions = allExamples.filter(ex => ex.type === 'definition');
        const examples = allExamples.filter(ex => ex.type === 'example');
        entry.examples = [...definitions.slice(0, 1), ...examples.slice(0, 2)];
      }
    }

    return entry;
    
  } catch (error) {
    console.error('[DICT FORMAT] Error formatting entry for vocab:', vocab.id, error);
    return null;
  }
}

module.exports = router;
