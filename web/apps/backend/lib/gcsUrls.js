// Google Cloud Storage URL 생성 유틸리티

const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'language-learner-audio';
const GCS_BASE_URL = `https://storage.googleapis.com/${GCS_BUCKET_NAME}`;

/**
 * GCS URL 생성 함수들
 */

// 오디오 파일 URL 생성
function getAudioUrl(filename) {
  if (!filename) return null;
  // 확장자가 없다면 .mp3 추가
  const audioFile = filename.endsWith('.mp3') ? filename : `${filename}.mp3`;
  return `${GCS_BASE_URL}/audio/${audioFile}`;
}

// 비디오 파일 URL 생성
function getVideoUrl(filename) {
  if (!filename) return null;
  const videoFile = filename.endsWith('.mp4') ? filename : `${filename}.mp4`;
  return `${GCS_BASE_URL}/video/${videoFile}`;
}

// JLPT 레벨별 오디오 URL
function getJlptAudioUrl(level, filename) {
  if (!filename || !level) return null;
  const audioFile = filename.endsWith('.mp3') ? filename : `${filename}.mp3`;
  return `${GCS_BASE_URL}/jlpt/${level}/${audioFile}`;
}

// CEFR 레벨별 오디오 URL
function getCefrAudioUrl(level, filename) {
  if (!filename || !level) return null;
  const audioFile = filename.endsWith('.mp3') ? filename : `${filename}.mp3`;
  return `${GCS_BASE_URL}/cefr/${level}/${audioFile}`;
}

// 일반적인 미디어 URL 생성
function getMediaUrl(type, filename) {
  if (!filename || !type) return null;
  return `${GCS_BASE_URL}/${type}/${filename}`;
}

// 기존 로컬 경로를 GCS URL로 변환
function convertLocalPathToGcsUrl(localPath) {
  if (!localPath) return null;

  // 슬래시로 시작하는 경우 제거
  const cleanPath = localPath.startsWith('/') ? localPath.substring(1) : localPath;

  // 직접 GCS URL로 변환 (폴더 구조 그대로 유지)
  return `${GCS_BASE_URL}/${cleanPath}`;
}

module.exports = {
  GCS_BASE_URL,
  GCS_BUCKET_NAME,
  getAudioUrl,
  getVideoUrl,
  getJlptAudioUrl,
  getCefrAudioUrl,
  getMediaUrl,
  convertLocalPathToGcsUrl
};