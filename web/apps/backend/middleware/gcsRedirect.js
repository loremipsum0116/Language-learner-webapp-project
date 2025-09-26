// GCS 리다이렉트 미들웨어
// 로컬 오디오 파일 요청을 Google Cloud Storage URL로 리다이렉트

const GCS_BASE_URL = process.env.GCS_BASE_URL || 'https://storage.googleapis.com/language-learner-audio';

/**
 * GCS로 오디오 파일 리다이렉트하는 미들웨어 생성
 * @param {string} basePath - 리다이렉트할 기본 경로 (예: 'starter', 'A1/audio')
 */
function createGcsRedirect(basePath) {
  return (req, res, next) => {
    // .mp3 파일 요청인 경우 GCS로 리다이렉트
    if (req.path.endsWith('.mp3')) {
      const gcsUrl = `${GCS_BASE_URL}/${basePath}${req.path}`;
      console.log(`[GCS Redirect] ${req.originalUrl} -> ${gcsUrl}`);

      // 301 영구 리다이렉트로 GCS URL로 전송
      return res.redirect(301, gcsUrl);
    }

    // mp3가 아닌 경우 다음 미들웨어로
    next();
  };
}

/**
 * 모든 오디오 경로를 GCS로 리다이렉트하는 범용 미들웨어
 */
function gcsAudioRedirect(req, res, next) {
  // 오디오 파일 요청인지 확인
  if (req.path.endsWith('.mp3')) {
    // URL 경로에서 첫 번째 슬래시 제거
    const relativePath = req.originalUrl.startsWith('/')
      ? req.originalUrl.substring(1)
      : req.originalUrl;

    const gcsUrl = `${GCS_BASE_URL}/${relativePath}`;
    console.log(`[GCS Audio Redirect] ${req.originalUrl} -> ${gcsUrl}`);

    // 301 영구 리다이렉트
    return res.redirect(301, gcsUrl);
  }

  next();
}

/**
 * 리스닝 오디오를 위한 특별 리다이렉트
 */
function gcsListeningRedirect(level) {
  return (req, res, next) => {
    if (req.path.endsWith('.mp3')) {
      const gcsUrl = `${GCS_BASE_URL}/${level}/${level}_Listening/${level}_Listening_mix${req.path}`;
      console.log(`[GCS Listening Redirect] ${req.originalUrl} -> ${gcsUrl}`);
      return res.redirect(301, gcsUrl);
    }
    next();
  };
}

/**
 * JLPT 오디오를 위한 특별 리다이렉트
 * /jlpt/N5/obentou/word.mp3 -> /jlpt/jlpt/n5/obentou/word.mp3
 */
function gcsJlptRedirect(req, res, next) {
  if (req.path.endsWith('.mp3')) {
    // /jlpt/N5/obentou/word.mp3 형태의 경로 파싱
    const pathParts = req.path.split('/');
    if (pathParts.length >= 4 && pathParts[1] === 'jlpt') {
      // pathParts[2]는 N5, N4 등의 레벨
      const level = pathParts[2].toLowerCase(); // N5 -> n5
      const remainingPath = pathParts.slice(3).join('/'); // obentou/word.mp3
      const gcsPath = `jlpt/jlpt/${level}/${remainingPath}`;
      const gcsUrl = `${GCS_BASE_URL}/${gcsPath}`;

      console.log(`[GCS JLPT Redirect] ${req.originalUrl} -> ${gcsUrl}`);
      return res.redirect(301, gcsUrl);
    }
  }
  next();
}

module.exports = {
  createGcsRedirect,
  gcsAudioRedirect,
  gcsListeningRedirect,
  gcsJlptRedirect,
  GCS_BASE_URL
};