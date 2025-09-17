// japanese-quiz.js - 일본어 SRS 퀴즈 전용 타입 정의

/**
 * 일본어 퀴즈 타입 열거형
 */
export const JapaneseQuizTypes = {
  // 일본어 단어를 보고 한국어 뜻을 맞추는 퀴즈 (4지선다)
  JP_WORD_TO_KO_MEANING: 'jp_word_to_ko_meaning',

  // 한국어 뜻을 보고 일본어 단어를 맞추는 퀴즈 (4지선다)
  KO_MEANING_TO_JP_WORD: 'ko_meaning_to_jp_word',

  // 예문의 빈칸에 일본어 단어 입력 (한자/로마자 모두 정답 처리)
  JP_FILL_IN_BLANK: 'jp_fill_in_blank',

  // 일본어 오디오를 듣고 일본어 단어를 맞추는 퀴즈 (4지선다) - 2025-09-17 수정
  JP_WORD_TO_ROMAJI: 'jp_word_to_romaji',

  // 혼합형 퀴즈 (위 4가지 타입이 랜덤하게 출제)
  JP_MIXED: 'jp_mixed'
};

/**
 * 언어 타입 열거형
 */
export const LanguageTypes = {
  ENGLISH: 'en',
  JAPANESE: 'ja'
};

/**
 * 일본어 퀴즈 아이템 타입 정의
 * @typedef {Object} JapaneseQuizItem
 * @property {number} cardId - SRS 카드 ID
 * @property {number} vocabId - 단어 ID (JLPT 단어 테이블 기준)
 * @property {string} question - 문제 텍스트 (일본어 단어 또는 한국어 뜻)
 * @property {string} answer - 정답
 * @property {string} quizType - 퀴즈 타입 (JapaneseQuizTypes 중 하나)
 * @property {string[]} [options] - 4지선다 선택지 (해당하는 퀴즈 타입에서만)
 * @property {Object} [pron] - 발음 정보
 * @property {string} [pron.romaji] - 로마자 발음
 * @property {string} [pron.hiragana] - 히라가나 발음
 * @property {string} [contextSentence] - 예문 (빈칸 퀴즈용)
 * @property {string} [contextBlank] - 빈칸이 포함된 예문
 * @property {string[]} [acceptableAnswers] - 허용되는 정답들 (한자/로마자)
 * @property {Object} vocab - 단어의 상세 정보
 * @property {string} language - 언어 타입 ('ja' for Japanese)
 */

/**
 * 일본어 단어 데이터 구조
 * @typedef {Object} JapaneseVocab
 * @property {number} id - 단어 ID
 * @property {string} kanji - 한자 표기
 * @property {string} hiragana - 히라가나 표기
 * @property {string} romaji - 로마자 표기
 * @property {string} meaning - 한국어 뜻
 * @property {string} jlptLevel - JLPT 급수 (N1, N2, N3, N4, N5)
 * @property {string} pos - 품사
 * @property {Array} examples - 예문 목록
 */

/**
 * 퀴즈 생성 옵션
 * @typedef {Object} JapaneseQuizOptions
 * @property {string} quizType - 생성할 퀴즈 타입
 * @property {number} count - 생성할 문제 수
 * @property {string[]} [jlptLevels] - 포함할 JLPT 급수들
 * @property {boolean} [randomOrder] - 문제 순서 랜덤화 여부
 */

/**
 * 퀴즈 응답 데이터
 * @typedef {Object} JapaneseQuizResponse
 * @property {boolean} correct - 정답 여부
 * @property {string} userAnswer - 사용자 답변
 * @property {string} correctAnswer - 정답
 * @property {string} explanation - 설명 (선택적)
 * @property {number} timeSpent - 소요 시간 (초)
 */

/**
 * 일본어 퀴즈가 지원되는지 확인하는 함수
 * @param {string} language - 언어 코드
 * @returns {boolean} 일본어 퀴즈 지원 여부
 */
export function isJapaneseQuizSupported(language) {
  return language === LanguageTypes.JAPANESE;
}

/**
 * 퀴즈 타입이 4지선다인지 확인하는 함수
 * @param {string} quizType - 퀴즈 타입
 * @returns {boolean} 4지선다 여부
 */
export function isMultipleChoiceQuiz(quizType) {
  return [
    JapaneseQuizTypes.JP_WORD_TO_KO_MEANING,
    JapaneseQuizTypes.KO_MEANING_TO_JP_WORD,
    JapaneseQuizTypes.JP_WORD_TO_ROMAJI
  ].includes(quizType);
}

/**
 * 퀴즈 타입이 입력형인지 확인하는 함수
 * @param {string} quizType - 퀴즈 타입
 * @returns {boolean} 입력형 여부
 */
export function isInputQuiz(quizType) {
  return quizType === JapaneseQuizTypes.JP_FILL_IN_BLANK;
}

/**
 * 퀴즈 타입별 설명 반환
 * @param {string} quizType - 퀴즈 타입
 * @returns {string} 퀴즈 타입 설명
 */
export function getQuizTypeDescription(quizType) {
  const descriptions = {
    [JapaneseQuizTypes.JP_WORD_TO_KO_MEANING]: '일본어 단어를 보고 한국어 뜻을 맞추세요',
    [JapaneseQuizTypes.KO_MEANING_TO_JP_WORD]: '한국어 뜻을 보고 일본어 단어를 맞추세요',
    [JapaneseQuizTypes.JP_FILL_IN_BLANK]: '예문의 빈칸에 알맞은 일본어 단어를 입력하세요',
    [JapaneseQuizTypes.JP_WORD_TO_ROMAJI]: '일본어 오디오를 듣고 알맞은 일본어 단어를 선택하세요',
    [JapaneseQuizTypes.JP_MIXED]: '다양한 유형의 일본어 퀴즈가 랜덤하게 출제됩니다'
  };

  return descriptions[quizType] || '알 수 없는 퀴즈 타입입니다';
}

export default {
  JapaneseQuizTypes,
  LanguageTypes,
  isJapaneseQuizSupported,
  isMultipleChoiceQuiz,
  isInputQuiz,
  getQuizTypeDescription
};