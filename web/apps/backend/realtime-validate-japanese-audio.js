#!/usr/bin/env node

/**
 * 실시간 일본어 오디오 경로 검증 스크립트
 * - 문제 파일 발견 시 즉시 txt 파일에 기록
 * - 배치별 진행상황 실시간 업데이트
 */

const { PrismaClient } = require('@prisma/client');
const https = require('https');
const fs = require('fs');

const prisma = new PrismaClient();

// 올바른 GCS 베이스 URL (public 경로 포함)
const GCS_BASE_URL = 'https://storage.googleapis.com/language-learner-audio/public';

// 실시간 기록 파일들
const WRONG_ROUTES_FILE = 'jap_wrong_routes_realtime.txt';
const PROGRESS_FILE = 'validation_progress.txt';

// 파일 초기화
fs.writeFileSync(WRONG_ROUTES_FILE, `=== 일본어 단어 잘못된 오디오 경로 목록 (실시간) ===\n시작 시간: ${new Date().toLocaleString('ko-KR')}\n\n`);
fs.writeFileSync(PROGRESS_FILE, `검증 시작: ${new Date().toLocaleString('ko-KR')}\n`);

// 실시간 로그 함수
function logWrongRoute(vocabId, lemma, levelJLPT, audioType, failedPath, status, error, method) {
  const logEntry = `🔴 ${lemma} (${levelJLPT}) - ID: ${vocabId}\n`;
  const logDetails = `  - ${audioType}: ${failedPath}\n    방법: ${method}\n    상태: ${status || error}\n    시간: ${new Date().toLocaleString('ko-KR')}\n\n`;

  fs.appendFileSync(WRONG_ROUTES_FILE, logEntry + logDetails);
  console.log(`❌ [실시간 기록] ${lemma} (${audioType}): ${status || error}`);
}

function logProgress(current, total, successCount, failCount) {
  const progress = `진행상황: ${current}/${total} (${(current/total*100).toFixed(1)}%) | 성공: ${successCount} | 실패: ${failCount} | ${new Date().toLocaleString('ko-KR')}\n`;
  fs.appendFileSync(PROGRESS_FILE, progress);
}

function parseAudioLocal(audioLocal) {
  if (!audioLocal) return null;

  let audioData = null;

  try {
    if (typeof audioLocal === 'string' && audioLocal.startsWith('{')) {
      audioData = JSON.parse(audioLocal);
    } else if (typeof audioLocal === 'string') {
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
    const basePath = audioLocal.replace(/\/(word|gloss|example)\.mp3$/, '');
    audioData = {
      word: `${basePath}/word.mp3`,
      gloss: `${basePath}/gloss.mp3`,
      example: `${basePath}/example.mp3`
    };
  }

  if (audioData && typeof audioData === 'object') {
    const convertToGcsUrl = (path) => {
      if (!path) return path;
      if (path.startsWith('https://storage.googleapis.com/')) return path;
      const cleanPath = path.startsWith('/') ? path.substring(1) : path;
      return `${GCS_BASE_URL}/${cleanPath}`;
    };

    return {
      word: convertToGcsUrl(audioData.word),
      gloss: convertToGcsUrl(audioData.gloss),
      example: convertToGcsUrl(audioData.example)
    };
  }

  return null;
}

function generateAudioPaths(vocab) {
  const isJapanese = vocab.levelJLPT || vocab.source === 'jlpt' || vocab.source === 'jlpt_total' ||
                     (vocab.audioLocal && vocab.audioLocal.includes('jlpt/'));

  if (!isJapanese) return null;

  // 1. audioLocal 우선 사용
  if (vocab.audioLocal) {
    const audioData = parseAudioLocal(vocab.audioLocal);
    if (audioData?.word) {
      return {
        method: 'audioLocal_parsed',
        word: audioData.word,
        gloss: audioData.gloss,
        example: audioData.example
      };
    }
  }

  // 2. lemma 기반 경로 생성 (fallback)
  const jlptLevel = (vocab.levelJLPT || 'N5').toLowerCase();
  let folderName;

  if (vocab.romaji) {
    folderName = vocab.romaji.toLowerCase();
  } else {
    folderName = vocab.lemma.toLowerCase().replace(/・/g, ' ');
  }

  const encodedFolderName = encodeURIComponent(folderName);

  return {
    method: 'lemma_based_fallback',
    word: `${GCS_BASE_URL}/jlpt/${jlptLevel}/${encodedFolderName}/word.mp3`,
    gloss: `${GCS_BASE_URL}/jlpt/${jlptLevel}/${encodedFolderName}/gloss.mp3`,
    example: `${GCS_BASE_URL}/jlpt/${jlptLevel}/${encodedFolderName}/example.mp3`
  };
}

function checkFileExists(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'HEAD' }, (res) => {
      resolve({
        exists: res.statusCode === 200,
        status: res.statusCode
      });
    });

    req.on('error', (err) => {
      resolve({
        exists: false,
        error: err.message
      });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({
        exists: false,
        error: 'timeout'
      });
    });

    req.end();
  });
}

async function realtimeValidateJapaneseAudio() {
  console.log('🔍 실시간 일본어 오디오 경로 검증 시작...');

  let totalProcessed = 0;
  let totalSuccess = 0;
  let totalFailed = 0;

  try {
    const rows = await prisma.vocab.findMany({
      where: {
        OR: [
          { source: 'jlpt_total' },
          { levelJLPT: { not: null } }
        ]
      },
      include: {
        dictentry: {
          select: {
            audioLocal: true,
            audioUrl: true
          }
        }
      },
      orderBy: [
        { levelJLPT: 'asc' },
        { lemma: 'asc' }
      ]
    });

    console.log(`📊 총 ${rows.length}개의 일본어 단어를 검증합니다...`);

    const BATCH_SIZE = 20;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      console.log(`🔄 처리 중: ${i + 1}-${Math.min(i + BATCH_SIZE, rows.length)} / ${rows.length}`);

      for (const row of batch) {
        const vocab = {
          ...row,
          audioLocal: row.dictentry?.audioLocal,
          audioUrl: row.dictentry?.audioUrl
        };

        const paths = generateAudioPaths(vocab);
        if (paths) {
          // word.mp3 검증
          const wordCheck = await checkFileExists(paths.word);
          totalProcessed++;

          if (wordCheck.exists) {
            totalSuccess++;
            console.log(`  ✅ ${vocab.lemma}: word.mp3 OK`);
          } else {
            totalFailed++;
            console.log(`  ❌ ${vocab.lemma}: word.mp3 FAILED (${wordCheck.status || wordCheck.error})`);
            logWrongRoute(
              vocab.id, vocab.lemma, vocab.levelJLPT,
              'word', paths.word, wordCheck.status, wordCheck.error, paths.method
            );
          }

          // gloss.mp3 검증
          if (paths.gloss) {
            const glossCheck = await checkFileExists(paths.gloss);
            totalProcessed++;

            if (glossCheck.exists) {
              totalSuccess++;
              console.log(`  ✅ ${vocab.lemma}: gloss.mp3 OK`);
            } else {
              totalFailed++;
              console.log(`  ❌ ${vocab.lemma}: gloss.mp3 FAILED (${glossCheck.status || glossCheck.error})`);
              logWrongRoute(
                vocab.id, vocab.lemma, vocab.levelJLPT,
                'gloss', paths.gloss, glossCheck.status, glossCheck.error, paths.method
              );
            }
          }

          // example.mp3 검증
          if (paths.example) {
            const exampleCheck = await checkFileExists(paths.example);
            totalProcessed++;

            if (exampleCheck.exists) {
              totalSuccess++;
              console.log(`  ✅ ${vocab.lemma}: example.mp3 OK`);
            } else {
              totalFailed++;
              console.log(`  ❌ ${vocab.lemma}: example.mp3 FAILED (${exampleCheck.status || exampleCheck.error})`);
              logWrongRoute(
                vocab.id, vocab.lemma, vocab.levelJLPT,
                'example', paths.example, exampleCheck.status, exampleCheck.error, paths.method
              );
            }
          }

          // 진행상황 실시간 업데이트 (매 10개마다)
          if (totalProcessed % 30 === 0) {
            logProgress(totalProcessed, rows.length * 3, totalSuccess, totalFailed);
          }
        }
      }
    }

    // 최종 결과
    const finalSummary = `\n=== 최종 검증 결과 ===\n완료 시간: ${new Date().toLocaleString('ko-KR')}\n총 검증: ${totalProcessed}개\n성공: ${totalSuccess}개 (${(totalSuccess/totalProcessed*100).toFixed(1)}%)\n실패: ${totalFailed}개 (${(totalFailed/totalProcessed*100).toFixed(1)}%)\n`;

    fs.appendFileSync(WRONG_ROUTES_FILE, finalSummary);
    fs.appendFileSync(PROGRESS_FILE, finalSummary);

    console.log(finalSummary);

  } finally {
    await prisma.$disconnect();
  }
}

realtimeValidateJapaneseAudio().catch(console.error);