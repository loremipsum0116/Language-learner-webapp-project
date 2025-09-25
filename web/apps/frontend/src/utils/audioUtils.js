// 오디오 관련 유틸리티 함수들

// GCS 베이스 URL - public 경로 포함 수정
const GCS_BASE_URL = 'https://storage.googleapis.com/language-learner-audio/public';
const GCS_BASE_URL_ENGLISH = 'https://storage.googleapis.com/language-learner-audio';

/**
 * audioLocal 데이터를 파싱하고 GCS URL로 변환하는 함수
 * @param {string|object} audioLocal - 데이터베이스의 audioLocal 값
 * @returns {object|null} - {word, gloss, example} GCS URL 객체 또는 null
 */
export function parseAudioLocal(audioLocal) {
  if (!audioLocal) return null;

  let audioData = null;

  try {
    // Check if it's already a valid JSON string
    if (typeof audioLocal === 'string' && audioLocal.startsWith('{')) {
      audioData = JSON.parse(audioLocal);
    } else if (typeof audioLocal === 'string') {
      // It's a simple path string, not JSON - create proper paths
      const basePath = audioLocal.replace(/\/(word|gloss|example)\.mp3$/, '');
      audioData = {
        word: `${basePath}/word.mp3`,
        gloss: `${basePath}/gloss.mp3`,
        example: `${basePath}/example.mp3`
      };
    } else if (typeof audioLocal === 'object') {
      audioData = audioLocal;
    }
  } catch (e) {
    console.warn('Failed to parse audioLocal:', e, audioLocal);
    // Fallback: treat as simple path - create proper paths
    const basePath = audioLocal.replace(/\/(word|gloss|example)\.mp3$/, '');
    audioData = {
      word: `${basePath}/word.mp3`,
      gloss: `${basePath}/gloss.mp3`,
      example: `${basePath}/example.mp3`
    };
  }

  // 모든 경로를 GCS URL로 변환
  if (audioData && typeof audioData === 'object') {
    const convertToGcsUrl = (path) => {
      if (!path) return path;
      // 이미 GCS URL인 경우 그대로 반환
      if (path.startsWith('https://storage.googleapis.com/')) return path;
      // 슬래시로 시작하는 경우 제거
      const cleanPath = path.startsWith('/') ? path.substring(1) : path;

      // Check if it's Japanese (jlpt) or English/Idiom audio
      // Japanese audio needs /public/ prefix, English and idioms don't
      const isJapanese = cleanPath.startsWith('jlpt/');

      // For Japanese audio, ensure JLPT levels are lowercase (N5 -> n5)
      let finalPath = cleanPath;
      if (isJapanese) {
        finalPath = cleanPath.replace(/jlpt\/N(\d)/g, 'jlpt/n$1');
      }

      const baseUrl = isJapanese ? GCS_BASE_URL : GCS_BASE_URL_ENGLISH;
      return `${baseUrl}/${finalPath}`;
    };

    return {
      word: convertToGcsUrl(audioData.word),
      gloss: convertToGcsUrl(audioData.gloss),
      example: convertToGcsUrl(audioData.example)
    };
  }

  return null;
}

/**
 * GCS URL 직접 생성 함수
 * @param {string} path - 상대 경로
 * @returns {string} - 완전한 GCS URL
 */
export function createGcsUrl(path) {
  if (!path) return null;
  // 이미 GCS URL인 경우 그대로 반환
  if (path.startsWith('https://storage.googleapis.com/')) return path;
  // 슬래시로 시작하는 경우 제거
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  return `${GCS_BASE_URL}/${cleanPath}`;
}

export { GCS_BASE_URL, GCS_BASE_URL_ENGLISH };