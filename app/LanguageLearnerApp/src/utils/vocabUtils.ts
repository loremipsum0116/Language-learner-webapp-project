/**
 * 어휘 관련 유틸리티 함수들
 */

export interface VocabTranslation {
  languageId?: number;
  translation?: string;
  language?: {
    code: string;
  };
}

export interface DictEntry {
  examples?: any;
}

export interface VocabItem {
  vocabTranslations?: VocabTranslation[];
  dictentry?: DictEntry;
}

/**
 * 어휘의 한국어 뜻을 가져오는 공통 함수
 * @param vocab 어휘 객체
 * @returns 한국어 뜻 문자열
 */
export const getVocabMeaning = (vocab: VocabItem | null | undefined): string => {
  if (!vocab) return '뜻 정보 없음';

  let koGloss = '뜻 정보 없음';

  // 1. vocabTranslations 배열에서 한국어 번역 찾기 (일본어용)
  if (vocab.vocabTranslations && Array.isArray(vocab.vocabTranslations)) {
    for (const translation of vocab.vocabTranslations) {
      // 한국어 번역 찾기 (language code 'ko' 또는 id 2)
      if ((translation.language?.code === 'ko' || translation.languageId === 2) && translation.translation) {
        koGloss = translation.translation;
        break;
      }
    }
    if (koGloss !== '뜻 정보 없음') return koGloss;
  }

  // 2. 기존 dictentry.examples 방식 (영어용 호환)
  try {
    if (vocab.dictentry?.examples) {
      const examples = Array.isArray(vocab.dictentry.examples)
        ? vocab.dictentry.examples
        : JSON.parse(vocab.dictentry.examples);

      for (const ex of examples) {
        if (ex?.definitions && Array.isArray(ex.definitions)) {
          for (const def of ex.definitions) {
            if (def?.ko_def) {
              koGloss = def.ko_def;
              break;
            }
            if (def?.ko) {
              koGloss = def.ko;
              break;
            }
            if (def?.koGloss) {
              koGloss = def.koGloss;
              break;
            }
          }
          if (koGloss !== '뜻 정보 없음') break;
        }
        if (ex?.koGloss) {
          koGloss = ex.koGloss;
          break;
        }
        if (ex?.kind === 'gloss' && ex?.ko) {
          koGloss = ex.ko;
          break;
        }
      }
    }
  } catch (e) {
    console.warn('Failed to parse examples:', e);
  }

  return koGloss;
};