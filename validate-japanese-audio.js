#!/usr/bin/env node

/**
 * 일본어 단어 오디오 경로 검증 및 수정 스크립트
 *
 * 기능:
 * 1. 데이터베이스에서 모든 일본어 단어 조회
 * 2. 각 단어의 audioLocal 경로 검증
 * 3. GCS 및 로컬 파일 존재 여부 확인
 * 4. 잘못된 경로 식별 및 수정 제안
 * 5. 통계 및 보고서 생성
 */

const { PrismaClient } = require('@prisma/client');
const https = require('https');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// GCS 베이스 URL
const GCS_BASE = 'https://storage.googleapis.com/language-learner-audio';

// 결과 저장용 객체
const results = {
  totalWords: 0,
  validAudio: 0,
  invalidAudio: 0,
  missingAudio: 0,
  pathMismatches: 0,
  fixableErrors: 0,
  errors: [],
  successes: [],
  fixes: []
};

/**
 * URL이 유효한지 체크 (HEAD 요청)
 */
function checkUrlExists(url) {
  return new Promise((resolve) => {
    const request = https.request(url, { method: 'HEAD' }, (response) => {
      resolve(response.statusCode === 200);
    });

    request.on('error', () => {
      resolve(false);
    });

    request.setTimeout(5000, () => {
      request.destroy();
      resolve(false);
    });

    request.end();
  });
}

/**
 * audioLocal JSON 파싱
 */
function parseAudioLocal(audioLocal) {
  if (!audioLocal) return null;

  try {
    if (typeof audioLocal === 'string' && audioLocal.startsWith('{')) {
      return JSON.parse(audioLocal);
    } else if (typeof audioLocal === 'string') {
      const basePath = audioLocal.replace(/\/(word|gloss|example)\.mp3$/, '');
      return {
        word: `${basePath}/word.mp3`,
        gloss: `${basePath}/gloss.mp3`,
        example: `${basePath}/example.mp3`
      };
    } else if (typeof audioLocal === 'object') {
      return audioLocal;
    }
  } catch (e) {
    console.warn('Failed to parse audioLocal:', e, audioLocal);
  }

  return null;
}

/**
 * GCS URL 생성
 */
function createGcsUrl(path) {
  if (!path) return null;
  if (path.startsWith('https://')) return path;
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  return `${GCS_BASE}/${cleanPath}`;
}

/**
 * 올바른 폴더명 생성 (・ → 공백)
 */
function getCorrectFolderName(lemma) {
  return lemma.toLowerCase().replace(/・/g, ' ');
}

/**
 * 단일 일본어 단어 검증
 */
async function validateJapaneseWord(vocab) {
  const result = {
    id: vocab.id,
    lemma: vocab.lemma,
    levelJLPT: vocab.levelJLPT,
    audioLocal: vocab.dictentry?.audioLocal,
    status: 'unknown',
    issues: [],
    suggestedFixes: [],
    urlTests: {}
  };

  console.log(`\n🔍 검증 중: ${vocab.lemma} (${vocab.levelJLPT})`);

  // audioLocal 파싱
  const audioData = parseAudioLocal(vocab.dictentry?.audioLocal);
  if (!audioData) {
    result.status = 'missing_audiolocal';
    result.issues.push('audioLocal 데이터가 없음');
    results.missingAudio++;
    return result;
  }

  // 각 오디오 타입별 검증
  const audioTypes = ['word', 'gloss', 'example'];
  let allValid = true;
  let hasFixableIssue = false;

  for (const type of audioTypes) {
    const audioUrl = audioData[type];
    if (!audioUrl) {
      result.issues.push(`${type} 오디오 URL이 없음`);
      continue;
    }

    // GCS URL로 변환
    const gcsUrl = createGcsUrl(audioUrl);
    console.log(`  ${type}: ${gcsUrl}`);

    // URL 유효성 검사
    const isValid = await checkUrlExists(gcsUrl);
    result.urlTests[type] = {
      url: gcsUrl,
      valid: isValid
    };

    if (!isValid) {
      allValid = false;
      result.issues.push(`${type} 오디오 파일이 존재하지 않음: ${gcsUrl}`);

      // 수정 가능한지 확인 (・ 포함 단어)
      if (vocab.lemma.includes('・')) {
        const correctFolder = getCorrectFolderName(vocab.lemma);
        const level = vocab.levelJLPT.toLowerCase();
        const suggestedUrl = `${GCS_BASE}/jlpt/${level}/${encodeURIComponent(correctFolder)}/${type}.mp3`;

        console.log(`  🔧 제안 경로: ${suggestedUrl}`);

        // 제안된 경로가 유효한지 확인
        const suggestedValid = await checkUrlExists(suggestedUrl);
        if (suggestedValid) {
          hasFixableIssue = true;
          result.suggestedFixes.push({
            type,
            currentUrl: gcsUrl,
            suggestedUrl,
            reason: '・ → 공백 변환 필요'
          });
          console.log(`  ✅ 제안 경로 유효함!`);
        } else {
          console.log(`  ❌ 제안 경로도 무효함`);
        }
      }
    } else {
      console.log(`  ✅ 유효함`);
    }
  }

  // 결과 분류
  if (allValid) {
    result.status = 'valid';
    results.validAudio++;
  } else if (hasFixableIssue) {
    result.status = 'fixable';
    results.fixableErrors++;
  } else {
    result.status = 'invalid';
    results.invalidAudio++;
  }

  return result;
}

/**
 * 메인 검증 함수
 */
async function validateAllJapaneseWords() {
  console.log('🚀 일본어 단어 오디오 경로 검증을 시작합니다...\n');

  try {
    // 일본어 단어 조회
    const japaneseWords = await prisma.vocab.findMany({
      where: {
        OR: [
          { levelJLPT: { not: null } },
          { source: 'jlpt' },
          { source: 'jlpt_total' },
          { source: 'jlpt_vocabs' }
        ]
      },
      include: {
        dictentry: true
      },
      orderBy: [
        { levelJLPT: 'asc' },
        { lemma: 'asc' }
      ]
    });

    results.totalWords = japaneseWords.length;
    console.log(`📊 총 ${results.totalWords}개의 일본어 단어를 찾았습니다.\n`);

    // 각 단어 검증
    for (let i = 0; i < japaneseWords.length; i++) {
      const vocab = japaneseWords[i];
      console.log(`[${i + 1}/${results.totalWords}]`);

      const result = await validateJapaneseWord(vocab);

      if (result.status === 'valid') {
        results.successes.push(result);
      } else {
        results.errors.push(result);
      }

      if (result.suggestedFixes.length > 0) {
        results.fixes.push(result);
      }

      // 진행 상황 표시 (매 50개마다)
      if ((i + 1) % 50 === 0) {
        console.log(`\n📊 중간 집계 (${i + 1}/${results.totalWords}):`);
        console.log(`  ✅ 유효: ${results.validAudio}`);
        console.log(`  🔧 수정가능: ${results.fixableErrors}`);
        console.log(`  ❌ 무효: ${results.invalidAudio}`);
        console.log(`  📭 누락: ${results.missingAudio}\n`);
      }
    }

  } catch (error) {
    console.error('❌ 검증 중 오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 결과 보고서 생성
 */
function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📋 일본어 오디오 경로 검증 결과 보고서');
  console.log('='.repeat(60));

  console.log('\n📊 전체 통계:');
  console.log(`  총 단어 수: ${results.totalWords}`);
  console.log(`  ✅ 정상 작동: ${results.validAudio} (${(results.validAudio/results.totalWords*100).toFixed(1)}%)`);
  console.log(`  🔧 수정 가능: ${results.fixableErrors} (${(results.fixableErrors/results.totalWords*100).toFixed(1)}%)`);
  console.log(`  ❌ 문제 있음: ${results.invalidAudio} (${(results.invalidAudio/results.totalWords*100).toFixed(1)}%)`);
  console.log(`  📭 데이터 누락: ${results.missingAudio} (${(results.missingAudio/results.totalWords*100).toFixed(1)}%)`);

  if (results.fixes.length > 0) {
    console.log('\n🔧 수정 가능한 단어들:');
    results.fixes.forEach(fix => {
      console.log(`\n  📝 ${fix.lemma} (${fix.levelJLPT}):`);
      fix.suggestedFixes.forEach(suggestion => {
        console.log(`    ${suggestion.type}: ${suggestion.reason}`);
        console.log(`      현재: ${suggestion.currentUrl}`);
        console.log(`      제안: ${suggestion.suggestedUrl}`);
      });
    });
  }

  // 상위 문제 단어들
  if (results.errors.length > 0) {
    console.log('\n❌ 문제가 있는 단어들 (상위 10개):');
    results.errors.slice(0, 10).forEach(error => {
      console.log(`  📝 ${error.lemma} (${error.levelJLPT}): ${error.issues.join(', ')}`);
    });
  }

  // 보고서를 파일로 저장
  const reportPath = path.join(__dirname, 'japanese-audio-validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 상세 보고서가 저장되었습니다: ${reportPath}`);

  console.log('\n' + '='.repeat(60));
}

// 스크립트 실행
if (require.main === module) {
  validateAllJapaneseWords()
    .then(() => {
      generateReport();
    })
    .catch(console.error);
}

module.exports = {
  validateAllJapaneseWords,
  validateJapaneseWord,
  results
};