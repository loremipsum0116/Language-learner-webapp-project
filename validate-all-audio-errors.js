#!/usr/bin/env node

/**
 * 모든 일본어 단어의 오디오 파일 (word.mp3, example.mp3, gloss.mp3) 검증 스크립트
 *
 * 실행 방법:
 * cd web/apps/backend
 * node ../../../validate-all-audio-errors.js
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

// GCS 베이스 URL
const GCS_BASE_URL = 'https://storage.googleapis.com/language-learner-audio';

/**
 * audioLocal JSON을 파싱하여 GCS URL로 변환
 */
function parseAudioLocal(audioLocal) {
  if (!audioLocal) return null;

  let audioData = null;

  try {
    // JSON 문자열인지 확인
    if (typeof audioLocal === 'string' && audioLocal.startsWith('{')) {
      audioData = JSON.parse(audioLocal);
    } else if (typeof audioLocal === 'string') {
      // 단순 경로 문자열인 경우 - 적절한 경로 생성
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
    // Fallback: 단순 경로로 처리
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
 * 일본어 단어 감지 함수
 */
function isJapaneseWord(vocab) {
  return vocab.source === 'jlpt_total' ||
         vocab.levelJLPT ||
         (vocab.dictentry?.audioLocal && vocab.dictentry.audioLocal.includes('jlpt/'));
}

/**
 * 일본어 단어에 대한 폴백 경로 생성
 */
function generateJapaneseFallbackPath(vocab, audioType) {
  const jlptLevel = (vocab.levelJLPT || 'N5').toLowerCase();

  let folderName;
  if (vocab.romaji) {
    folderName = vocab.romaji.toLowerCase();
  } else {
    // ・를 공백으로 변환하여 실제 폴더 구조와 일치시킴
    folderName = vocab.lemma.toLowerCase().replace(/・/g, ' ');
  }

  return `${GCS_BASE_URL}/jlpt/${jlptLevel}/${encodeURIComponent(folderName)}/${audioType}.mp3`;
}

/**
 * URL이 접근 가능한지 확인 (HEAD 요청)
 */
async function checkUrlExists(url, timeout = 5000) {
  try {
    const response = await axios.head(url, {
      timeout: timeout,
      validateStatus: (status) => status < 400 // 200-399는 성공으로 간주
    });
    return {
      exists: true,
      status: response.status,
      error: null
    };
  } catch (error) {
    return {
      exists: false,
      status: error.response?.status || null,
      error: error.message
    };
  }
}

/**
 * 단일 단어의 모든 오디오 파일 검증
 */
async function validateVocabAudio(vocab) {
  const results = {
    vocabId: vocab.id,
    lemma: vocab.lemma,
    source: vocab.source,
    levelJLPT: vocab.levelJLPT,
    isJapanese: isJapaneseWord(vocab),
    audioLocal: vocab.dictentry?.audioLocal,
    errors: [],
    paths: {},
    fallbackPaths: {}
  };

  // audioLocal 파싱
  const audioData = parseAudioLocal(vocab.dictentry?.audioLocal);

  const audioTypes = ['word', 'gloss', 'example'];

  for (const audioType of audioTypes) {
    let primaryPath = null;
    let fallbackPath = null;

    // 1. audioLocal에서 경로 추출
    if (audioData && audioData[audioType]) {
      primaryPath = audioData[audioType];

      // 일본어 단어에서 ・ 문제 수정
      if (results.isJapanese && vocab.lemma.includes('・')) {
        const currentFolderInPath = primaryPath.match(/\/jlpt\/[^/]+\/([^/]+)\//)?.[1];
        const expectedFolder = encodeURIComponent(vocab.lemma.toLowerCase().replace(/・/g, ' '));

        if (currentFolderInPath && currentFolderInPath !== expectedFolder) {
          // 경로 수정
          const jlptLevel = (vocab.levelJLPT || 'N5').toLowerCase();
          const correctFolderName = vocab.lemma.toLowerCase().replace(/・/g, ' ');
          primaryPath = `${GCS_BASE_URL}/jlpt/${jlptLevel}/${encodeURIComponent(correctFolderName)}/${audioType}.mp3`;
        }
      }
    }

    // 2. 일본어 단어에 대한 폴백 경로 생성
    if (results.isJapanese) {
      fallbackPath = generateJapaneseFallbackPath(vocab, audioType);
    }

    // 경로 기록
    results.paths[audioType] = primaryPath;
    results.fallbackPaths[audioType] = fallbackPath;

    // 3. URL 존재 여부 확인
    let urlExists = false;
    let checkResult = null;

    if (primaryPath) {
      checkResult = await checkUrlExists(primaryPath);
      if (checkResult.exists) {
        urlExists = true;
      }
    }

    // Primary path가 실패하고 fallback이 있으면 fallback 확인
    if (!urlExists && fallbackPath && fallbackPath !== primaryPath) {
      const fallbackResult = await checkUrlExists(fallbackPath);
      if (fallbackResult.exists) {
        urlExists = true;
        checkResult = fallbackResult;
      }
    }

    // 에러가 있으면 기록
    if (!urlExists) {
      results.errors.push({
        audioType: audioType,
        primaryPath: primaryPath,
        fallbackPath: fallbackPath,
        primaryError: checkResult?.error || 'No primary path',
        primaryStatus: checkResult?.status || null,
        fallbackError: fallbackPath ? 'Not checked or failed' : 'No fallback path'
      });
    }
  }

  return results;
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('🚀 일본어 단어 오디오 파일 전면 검증 시작...\n');

  try {
    // 모든 일본어 단어 조회
    const japaneseVocabs = await prisma.vocab.findMany({
      where: {
        OR: [
          { source: 'jlpt_total' },
          { levelJLPT: { not: null } },
          {
            dictentry: {
              audioLocal: {
                contains: 'jlpt/'
              }
            }
          }
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

    console.log(`📊 총 ${japaneseVocabs.length}개의 일본어 단어를 발견했습니다.\n`);

    const errorWords = [];
    const successWords = [];
    const totalWords = japaneseVocabs.length;
    let processedWords = 0;

    // 각 단어별로 검증 실행
    for (const vocab of japaneseVocabs) {
      processedWords++;

      console.log(`[${processedWords}/${totalWords}] 검증 중: ${vocab.lemma} (${vocab.levelJLPT || 'Unknown'})`);

      const result = await validateVocabAudio(vocab);

      if (result.errors.length > 0) {
        errorWords.push(result);
        console.log(`❌ ${result.errors.length}개 오디오 파일 에러`);
      } else {
        successWords.push(result);
        console.log(`✅ 모든 오디오 파일 정상`);
      }

      // 진행상황 출력 (100개마다)
      if (processedWords % 100 === 0) {
        console.log(`\n📈 진행상황: ${processedWords}/${totalWords} (${Math.round(processedWords/totalWords*100)}%)`);
        console.log(`✅ 성공: ${successWords.length}개, ❌ 에러: ${errorWords.length}개\n`);
      }
    }

    // 최종 결과 정리
    console.log('\n' + '='.repeat(60));
    console.log('📋 최종 검증 결과');
    console.log('='.repeat(60));
    console.log(`총 검증 단어 수: ${totalWords}개`);
    console.log(`✅ 모든 오디오 정상: ${successWords.length}개 (${Math.round(successWords.length/totalWords*100)}%)`);
    console.log(`❌ 오디오 에러 발생: ${errorWords.length}개 (${Math.round(errorWords.length/totalWords*100)}%)`);

    if (errorWords.length > 0) {
      console.log('\n' + '='.repeat(60));
      console.log('❌ 오디오 에러가 발생한 단어들');
      console.log('='.repeat(60));

      // 레벨별로 그룹화
      const errorsByLevel = {};
      errorWords.forEach(word => {
        const level = word.levelJLPT || 'Unknown';
        if (!errorsByLevel[level]) {
          errorsByLevel[level] = [];
        }
        errorsByLevel[level].push(word);
      });

      // 레벨별 에러 출력
      for (const [level, words] of Object.entries(errorsByLevel)) {
        console.log(`\n📚 ${level} 레벨 (${words.length}개 단어):`);
        console.log('-'.repeat(40));

        words.forEach(word => {
          console.log(`🔸 ${word.lemma} (ID: ${word.vocabId})`);

          word.errors.forEach(error => {
            console.log(`   ${error.audioType}.mp3: ${error.primaryError}`);
            if (error.primaryPath) {
              console.log(`   → ${error.primaryPath}`);
            }
            if (error.fallbackPath && error.fallbackPath !== error.primaryPath) {
              console.log(`   → Fallback: ${error.fallbackPath}`);
            }
          });
          console.log('');
        });
      }
    }

    // 에러 유형별 통계
    if (errorWords.length > 0) {
      console.log('\n' + '='.repeat(60));
      console.log('📊 에러 유형별 통계');
      console.log('='.repeat(60));

      const errorTypeStats = {
        word: 0,
        gloss: 0,
        example: 0
      };

      errorWords.forEach(word => {
        word.errors.forEach(error => {
          errorTypeStats[error.audioType]++;
        });
      });

      console.log(`word.mp3 에러: ${errorTypeStats.word}개`);
      console.log(`gloss.mp3 에러: ${errorTypeStats.gloss}개`);
      console.log(`example.mp3 에러: ${errorTypeStats.example}개`);
    }

    // JSON 파일로 상세 결과 저장
    const fs = require('fs');
    const detailedResults = {
      timestamp: new Date().toISOString(),
      summary: {
        totalWords: totalWords,
        successfulWords: successWords.length,
        errorWords: errorWords.length,
        successRate: Math.round(successWords.length/totalWords*100)
      },
      errorDetails: errorWords,
      successfulWords: successWords.map(w => ({
        vocabId: w.vocabId,
        lemma: w.lemma,
        levelJLPT: w.levelJLPT
      }))
    };

    fs.writeFileSync('japanese-audio-validation-results.json', JSON.stringify(detailedResults, null, 2));
    console.log('\n📄 상세 결과가 japanese-audio-validation-results.json 파일에 저장되었습니다.');

    console.log('\n🎉 검증 완료!');

  } catch (error) {
    console.error('❌ 검증 중 오류 발생:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 스크립트 실행
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { validateVocabAudio, parseAudioLocal, isJapaneseWord };