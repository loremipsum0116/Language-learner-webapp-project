#!/usr/bin/env node

/**
 * 일본어 단어 오디오 경로 검증 스크립트
 *
 * 이 스크립트는:
 * 1. 데이터베이스에서 모든 일본어 단어를 조회
 * 2. VocabList.jsx와 VocabDetailModal.jsx의 로직을 시뮬레이트
 * 3. 각 단어의 word.mp3, gloss.mp3, example.mp3 경로 생성
 * 4. 실제 GCS에 파일이 존재하는지 확인
 * 5. 문제가 있는 단어들을 분류하여 리포트 생성
 */

const { PrismaClient } = require('@prisma/client');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Prisma 클라이언트 초기화
const prisma = new PrismaClient();

// GCS 베이스 URL - 올바른 경로 발견! public/ 경로 추가
const GCS_BASE_URL = 'https://storage.googleapis.com/language-learner-audio/public';

/**
 * VocabDetailModal.jsx와 동일한 parseAudioLocal 함수
 */
function parseAudioLocal(audioLocal) {
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

/**
 * VocabList.jsx의 일본어 오디오 경로 생성 로직 시뮬레이션
 */
function generateVocabListAudioPath(vocab) {
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

  // 2. audioUrl fallback
  if (vocab.audioUrl) {
    const baseUrl = vocab.audioUrl.replace('/word.mp3', '');
    return {
      method: 'audioUrl_fallback',
      word: `${GCS_BASE_URL}/${baseUrl}/word.mp3`,
      gloss: `${GCS_BASE_URL}/${baseUrl}/gloss.mp3`,
      example: `${GCS_BASE_URL}/${baseUrl}/example.mp3`
    };
  }

  // 3. lemma 기반 경로 생성 (최종 fallback)
  const jlptLevel = (vocab.levelJLPT || 'N5').toLowerCase();
  let folderName;

  if (vocab.romaji) {
    folderName = vocab.romaji.toLowerCase();
  } else {
    // Convert Japanese punctuation ・ to space for folder matching
    folderName = vocab.lemma.toLowerCase().replace(/・/g, ' ');
  }

  return {
    method: 'lemma_based_fallback',
    word: `${GCS_BASE_URL}/jlpt/${jlptLevel}/${encodeURIComponent(folderName)}/word.mp3`,
    gloss: `${GCS_BASE_URL}/jlpt/${jlptLevel}/${encodeURIComponent(folderName)}/gloss.mp3`,
    example: `${GCS_BASE_URL}/jlpt/${jlptLevel}/${encodeURIComponent(folderName)}/example.mp3`
  };
}

/**
 * VocabDetailModal.jsx의 일본어 오디오 경로 생성 로직 시뮬레이션 (gloss 전용)
 */
function generateModalGlossPath(vocab) {
  const isJapanese = vocab.levelJLPT || vocab.source === 'jlpt' || vocab.source === 'jlpt_total' ||
                     (vocab.audioLocal && vocab.audioLocal.includes('jlpt/'));

  if (!isJapanese) return null;

  // audioLocal 데이터 우선 사용
  const audioData = parseAudioLocal(vocab.audioLocal);
  if (audioData?.gloss) {
    // Check if the lemma contains ・ (needs space conversion) and path seems incorrect
    const needsSpaceConversion = vocab.lemma.includes('・');
    const currentFolderInPath = audioData.gloss.match(/\/jlpt\/[^/]+\/([^/]+)\//)?.[1];
    const expectedFolder = encodeURIComponent(vocab.lemma.toLowerCase().replace(/・/g, ' '));

    if (needsSpaceConversion && currentFolderInPath && currentFolderInPath !== expectedFolder) {
      // Fix the path by replacing incorrect folder name with correct one
      const jlptLevel = (vocab.levelJLPT || 'N5').toLowerCase();
      const correctFolderName = vocab.lemma.toLowerCase().replace(/・/g, ' ');
      return {
        method: 'audioLocal_fixed',
        original: audioData.gloss,
        corrected: `${GCS_BASE_URL}/jlpt/${jlptLevel}/${encodeURIComponent(correctFolderName)}/gloss.mp3`
      };
    } else {
      return {
        method: 'audioLocal_direct',
        path: audioData.gloss
      };
    }
  }

  // Fallback 로직들...
  if (vocab.audioUrl) {
    const baseUrl = vocab.audioUrl.replace('/word.mp3', '/gloss.mp3');
    return {
      method: 'audioUrl_fallback',
      path: `/${baseUrl}`
    };
  }

  // Final fallback
  const jlptLevel = (vocab.levelJLPT || 'N5').toLowerCase();
  let folderName;
  if (vocab.romaji) {
    folderName = vocab.romaji.toLowerCase();
  } else {
    folderName = vocab.lemma.toLowerCase().replace(/・/g, ' ');
  }

  return {
    method: 'final_fallback',
    path: `${GCS_BASE_URL}/jlpt/${jlptLevel}/${encodeURIComponent(folderName)}/gloss.mp3`
  };
}

/**
 * VocabDetailModal.jsx의 일본어 오디오 경로 생성 로직 시뮬레이션 (example 전용)
 */
function generateModalExamplePath(vocab) {
  const isJapanese = vocab.levelJLPT || vocab.source === 'jlpt' || vocab.source === 'jlpt_total' ||
                     (vocab.audioLocal && vocab.audioLocal.includes('jlpt/'));

  if (!isJapanese) return null;

  // audioLocal 데이터 우선 사용
  const audioData = parseAudioLocal(vocab.audioLocal);
  if (audioData?.example) {
    // Check if the lemma contains ・ (needs space conversion) and path seems incorrect
    const needsSpaceConversion = vocab.lemma.includes('・');
    const currentFolderInPath = audioData.example.match(/\/jlpt\/[^/]+\/([^/]+)\//)?.[1];
    const expectedFolder = encodeURIComponent(vocab.lemma.toLowerCase().replace(/・/g, ' '));

    if (needsSpaceConversion && currentFolderInPath && currentFolderInPath !== expectedFolder) {
      // Fix the path by replacing incorrect folder name with correct one
      const jlptLevel = (vocab.levelJLPT || 'N5').toLowerCase();
      const correctFolderName = vocab.lemma.toLowerCase().replace(/・/g, ' ');
      return {
        method: 'audioLocal_fixed',
        original: audioData.example,
        corrected: `${GCS_BASE_URL}/jlpt/${jlptLevel}/${encodeURIComponent(correctFolderName)}/example.mp3`
      };
    } else {
      return {
        method: 'audioLocal_direct',
        path: audioData.example
      };
    }
  }

  // Fallback 로직들...
  if (vocab.audioUrl) {
    const baseUrl = vocab.audioUrl.replace('/word.mp3', '/example.mp3');
    return {
      method: 'audioUrl_fallback',
      path: `/${baseUrl}`
    };
  }

  // Final fallback
  const jlptLevel = (vocab.levelJLPT || 'N5').toLowerCase();
  let folderName;
  if (vocab.romaji) {
    folderName = vocab.romaji.toLowerCase();
  } else {
    folderName = vocab.lemma.toLowerCase().replace(/・/g, ' ');
  }

  return {
    method: 'final_fallback',
    path: `${GCS_BASE_URL}/jlpt/${jlptLevel}/${encodeURIComponent(folderName)}/example.mp3`
  };
}

/**
 * HTTP HEAD 요청으로 파일 존재 여부 확인
 */
function checkFileExists(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'HEAD' }, (res) => {
      resolve({
        exists: res.statusCode === 200,
        status: res.statusCode,
        headers: res.headers
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

/**
 * 메인 검증 함수
 */
async function validateJapaneseAudioPaths() {
  console.log('🔍 일본어 단어 오디오 경로 검증 시작...');

  try {
    // 모든 일본어 단어 조회
    const rows = await prisma.vocab.findMany({
      where: {
        OR: [
          { source: 'jlpt_total' },
          { levelJLPT: { not: null } },
          { dictentry: { audioLocal: { contains: 'jlpt' } } }
        ]
      },
      include: {
        dictentry: {
          select: {
            audioLocal: true,
            audioUrl: true,
            ipa: true,
            ipaKo: true
          }
        }
      },
      orderBy: [
        { levelJLPT: 'asc' },
        { lemma: 'asc' }
      ]
    });

    console.log(`📊 총 ${rows.length}개의 일본어 단어를 검증합니다...`);

    const results = {
      total: rows.length,
      processed: 0,
      vocabListPaths: { success: 0, failed: 0, details: [] },
      modalGlossPaths: { success: 0, failed: 0, details: [] },
      modalExamplePaths: { success: 0, failed: 0, details: [] },
      summary: {
        totalChecked: 0,
        filesExist: 0,
        filesMissing: 0,
        errors: 0
      }
    };

    // 배치 처리 (한 번에 10개씩)
    const BATCH_SIZE = 10;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      console.log(`🔄 처리 중: ${i + 1}-${Math.min(i + BATCH_SIZE, rows.length)} / ${rows.length}`);

      for (const vocab of batch) {
        results.processed++;

        // 1. VocabList 오디오 경로 확인
        const vocabListPaths = generateVocabListAudioPath(vocab);
        if (vocabListPaths) {
          const wordCheck = await checkFileExists(vocabListPaths.word);
          const pathResult = {
            id: vocab.id,
            lemma: vocab.lemma,
            levelJLPT: vocab.levelJLPT,
            method: vocabListPaths.method,
            wordPath: vocabListPaths.word,
            wordExists: wordCheck.exists,
            wordStatus: wordCheck.status,
            wordError: wordCheck.error
          };

          results.vocabListPaths.details.push(pathResult);
          if (wordCheck.exists) {
            results.vocabListPaths.success++;
          } else {
            results.vocabListPaths.failed++;
          }
          results.summary.totalChecked++;
          if (wordCheck.exists) results.summary.filesExist++;
          else results.summary.filesMissing++;
          if (wordCheck.error) results.summary.errors++;
        }

        // 2. VocabDetailModal gloss 경로 확인
        const modalGlossPath = generateModalGlossPath(vocab);
        if (modalGlossPath) {
          const pathToCheck = modalGlossPath.corrected || modalGlossPath.path;
          const glossCheck = await checkFileExists(pathToCheck);
          const pathResult = {
            id: vocab.id,
            lemma: vocab.lemma,
            levelJLPT: vocab.levelJLPT,
            method: modalGlossPath.method,
            glossPath: pathToCheck,
            originalPath: modalGlossPath.original,
            glossExists: glossCheck.exists,
            glossStatus: glossCheck.status,
            glossError: glossCheck.error
          };

          results.modalGlossPaths.details.push(pathResult);
          if (glossCheck.exists) {
            results.modalGlossPaths.success++;
          } else {
            results.modalGlossPaths.failed++;
          }
          results.summary.totalChecked++;
          if (glossCheck.exists) results.summary.filesExist++;
          else results.summary.filesMissing++;
          if (glossCheck.error) results.summary.errors++;
        }

        // 3. VocabDetailModal example 경로 확인
        const modalExamplePath = generateModalExamplePath(vocab);
        if (modalExamplePath) {
          const pathToCheck = modalExamplePath.corrected || modalExamplePath.path;
          const exampleCheck = await checkFileExists(pathToCheck);
          const pathResult = {
            id: vocab.id,
            lemma: vocab.lemma,
            levelJLPT: vocab.levelJLPT,
            method: modalExamplePath.method,
            examplePath: pathToCheck,
            originalPath: modalExamplePath.original,
            exampleExists: exampleCheck.exists,
            exampleStatus: exampleCheck.status,
            exampleError: exampleCheck.error
          };

          results.modalExamplePaths.details.push(pathResult);
          if (exampleCheck.exists) {
            results.modalExamplePaths.success++;
          } else {
            results.modalExamplePaths.failed++;
          }
          results.summary.totalChecked++;
          if (exampleCheck.exists) results.summary.filesExist++;
          else results.summary.filesMissing++;
          if (exampleCheck.error) results.summary.errors++;
        }
      }
    }

    // 결과 리포트 생성
    const reportContent = generateReport(results);

    // 파일에 저장
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFileName = `japanese-audio-validation-report-${timestamp}.json`;
    const summaryFileName = `japanese-audio-validation-summary-${timestamp}.txt`;
    const wrongRoutesFileName = `jap_wrong_routes.txt`;

    fs.writeFileSync(reportFileName, JSON.stringify(results, null, 2));
    fs.writeFileSync(summaryFileName, reportContent);

    // 잘못된 경로들만 별도 파일에 저장
    const wrongRoutesContent = generateWrongRoutesReport(results);
    fs.writeFileSync(wrongRoutesFileName, wrongRoutesContent);

    console.log(`\n📄 상세 리포트가 저장되었습니다: ${reportFileName}`);
    console.log(`📄 요약 리포트가 저장되었습니다: ${summaryFileName}`);
    console.log(`📄 잘못된 경로 리포트가 저장되었습니다: ${wrongRoutesFileName}`);
    console.log(reportContent);

  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 잘못된 경로들만 모은 리포트 생성 함수
 */
function generateWrongRoutesReport(results) {
  const wrongRoutes = [];

  // VocabList word.mp3 실패 경로들
  results.vocabListPaths.details.forEach(detail => {
    if (!detail.wordExists) {
      wrongRoutes.push({
        type: 'VocabList_word',
        lemma: detail.lemma,
        levelJLPT: detail.levelJLPT,
        id: detail.id,
        method: detail.method,
        failedPath: detail.wordPath,
        status: detail.wordStatus,
        error: detail.wordError
      });
    }
  });

  // VocabDetailModal gloss.mp3 실패 경로들
  results.modalGlossPaths.details.forEach(detail => {
    if (!detail.glossExists) {
      wrongRoutes.push({
        type: 'VocabDetailModal_gloss',
        lemma: detail.lemma,
        levelJLPT: detail.levelJLPT,
        id: detail.id,
        method: detail.method,
        failedPath: detail.glossPath,
        originalPath: detail.originalPath,
        status: detail.glossStatus,
        error: detail.glossError
      });
    }
  });

  // VocabDetailModal example.mp3 실패 경로들
  results.modalExamplePaths.details.forEach(detail => {
    if (!detail.exampleExists) {
      wrongRoutes.push({
        type: 'VocabDetailModal_example',
        lemma: detail.lemma,
        levelJLPT: detail.levelJLPT,
        id: detail.id,
        method: detail.method,
        failedPath: detail.examplePath,
        originalPath: detail.originalPath,
        status: detail.exampleStatus,
        error: detail.exampleError
      });
    }
  });

  // 잘못된 경로들을 정렬 (단어별로 그룹화)
  wrongRoutes.sort((a, b) => {
    if (a.lemma !== b.lemma) return a.lemma.localeCompare(b.lemma);
    if (a.levelJLPT !== b.levelJLPT) return a.levelJLPT.localeCompare(b.levelJLPT);
    return a.type.localeCompare(b.type);
  });

  let content = `=== 일본어 단어 잘못된 오디오 경로 목록 ===\n`;
  content += `생성 시간: ${new Date().toLocaleString('ko-KR')}\n`;
  content += `총 잘못된 경로: ${wrongRoutes.length}개\n\n`;

  // 단어별로 그룹화해서 출력
  const groupedByWord = {};
  wrongRoutes.forEach(route => {
    const key = `${route.lemma} (${route.levelJLPT})`;
    if (!groupedByWord[key]) {
      groupedByWord[key] = [];
    }
    groupedByWord[key].push(route);
  });

  Object.entries(groupedByWord).forEach(([wordKey, routes]) => {
    content += `\n🔴 ${wordKey} (ID: ${routes[0].id}):\n`;
    routes.forEach(route => {
      content += `  - ${route.type}: ${route.failedPath}\n`;
      content += `    방법: ${route.method}\n`;
      if (route.originalPath) {
        content += `    원본경로: ${route.originalPath}\n`;
      }
      content += `    상태: ${route.status || route.error}\n`;
    });
  });

  // 통계 추가
  content += `\n\n=== 통계 ===\n`;
  const typeStats = {};
  wrongRoutes.forEach(route => {
    typeStats[route.type] = (typeStats[route.type] || 0) + 1;
  });

  Object.entries(typeStats).forEach(([type, count]) => {
    content += `${type}: ${count}개\n`;
  });

  const methodStats = {};
  wrongRoutes.forEach(route => {
    methodStats[route.method] = (methodStats[route.method] || 0) + 1;
  });

  content += `\n경로 생성 방법별 실패:\n`;
  Object.entries(methodStats).forEach(([method, count]) => {
    content += `${method}: ${count}개\n`;
  });

  return content;
}

/**
 * 리포트 생성 함수
 */
function generateReport(results) {
  const report = `
=== 일본어 단어 오디오 경로 검증 리포트 ===
검증 시간: ${new Date().toLocaleString('ko-KR')}

📊 전체 통계:
- 검증된 일본어 단어: ${results.total}개
- 총 파일 검사 수: ${results.summary.totalChecked}개
- 존재하는 파일: ${results.summary.filesExist}개 (${(results.summary.filesExist / results.summary.totalChecked * 100).toFixed(1)}%)
- 누락된 파일: ${results.summary.filesMissing}개 (${(results.summary.filesMissing / results.summary.totalChecked * 100).toFixed(1)}%)
- 에러 발생: ${results.summary.errors}개

🎯 VocabList word.mp3 경로 검증:
- 성공: ${results.vocabListPaths.success}개
- 실패: ${results.vocabListPaths.failed}개
- 성공률: ${(results.vocabListPaths.success / (results.vocabListPaths.success + results.vocabListPaths.failed) * 100).toFixed(1)}%

🎯 VocabDetailModal gloss.mp3 경로 검증:
- 성공: ${results.modalGlossPaths.success}개
- 실패: ${results.modalGlossPaths.failed}개
- 성공률: ${(results.modalGlossPaths.success / (results.modalGlossPaths.success + results.modalGlossPaths.failed) * 100).toFixed(1)}%

🎯 VocabDetailModal example.mp3 경로 검증:
- 성공: ${results.modalExamplePaths.success}개
- 실패: ${results.modalExamplePaths.failed}개
- 성공률: ${(results.modalExamplePaths.success / (results.modalExamplePaths.success + results.modalExamplePaths.failed) * 100).toFixed(1)}%

❌ 문제가 있는 주요 단어들:

VocabList word.mp3 실패 상위 20개:
${results.vocabListPaths.details
  .filter(d => !d.wordExists)
  .slice(0, 20)
  .map(d => `- ${d.lemma} (${d.levelJLPT}): ${d.wordPath} [${d.wordStatus || d.wordError}]`)
  .join('\n')}

VocabDetailModal gloss.mp3 실패 상위 20개:
${results.modalGlossPaths.details
  .filter(d => !d.glossExists)
  .slice(0, 20)
  .map(d => `- ${d.lemma} (${d.levelJLPT}): ${d.glossPath} [${d.glossStatus || d.glossError}]`)
  .join('\n')}

VocabDetailModal example.mp3 실패 상위 20개:
${results.modalExamplePaths.details
  .filter(d => !d.exampleExists)
  .slice(0, 20)
  .map(d => `- ${d.lemma} (${d.levelJLPT}): ${d.examplePath} [${d.exampleStatus || d.exampleError}]`)
  .join('\n')}

✅ 추천 해결 방안:
1. 실패한 파일들의 실제 GCS 경로 확인
2. 데이터베이스 audioLocal 필드 수정
3. 프론트엔드 경로 생성 로직 개선
4. 누락된 오디오 파일 업로드

상세한 데이터는 JSON 파일을 확인하세요.
`;

  return report;
}

// 스크립트 실행
if (require.main === module) {
  validateJapaneseAudioPaths().catch(console.error);
}

module.exports = {
  validateJapaneseAudioPaths,
  parseAudioLocal,
  generateVocabListAudioPath,
  generateModalGlossPath,
  generateModalExamplePath,
  checkFileExists
};