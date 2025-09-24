#!/usr/bin/env node

/**
 * 일본어 단어 오디오 경로 문제 수정 스크립트
 *
 * 실행 방법:
 * cd web/apps/backend
 * node ../../../fix-japanese-audio-paths.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * audioLocal JSON을 파싱하는 함수
 */
function parseAudioLocal(audioLocal) {
  if (!audioLocal) return null;

  try {
    if (typeof audioLocal === 'string' && audioLocal.startsWith('{')) {
      return JSON.parse(audioLocal);
    } else if (typeof audioLocal === 'object') {
      return audioLocal;
    }
  } catch (e) {
    console.warn('Failed to parse audioLocal:', e);
    return null;
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
 * 올바른 일본어 오디오 경로 생성
 */
function generateCorrectJapanesePaths(vocab) {
  const jlptLevel = (vocab.levelJLPT || 'N5').toLowerCase();

  // ・을 공백으로 변환하여 올바른 폴더명 생성
  let correctFolderName;
  if (vocab.romaji) {
    correctFolderName = vocab.romaji.toLowerCase();
  } else {
    correctFolderName = vocab.lemma.toLowerCase().replace(/・/g, ' ');
  }

  return {
    word: `jlpt/${jlptLevel}/${correctFolderName}/word.mp3`,
    gloss: `jlpt/${jlptLevel}/${correctFolderName}/gloss.mp3`,
    example: `jlpt/${jlptLevel}/${correctFolderName}/example.mp3`
  };
}

/**
 * audioLocal 경로가 수정이 필요한지 확인
 */
function needsPathCorrection(vocab) {
  if (!isJapaneseWord(vocab) || !vocab.lemma.includes('・')) {
    return false;
  }

  const audioData = parseAudioLocal(vocab.dictentry?.audioLocal);
  if (!audioData || !audioData.word) {
    return false;
  }

  // 현재 경로에서 폴더명 추출
  const currentFolderMatch = audioData.word.match(/\/jlpt\/[^/]+\/([^/]+)\//);
  if (!currentFolderMatch) {
    return false;
  }

  const currentFolder = currentFolderMatch[1];
  const expectedFolder = vocab.lemma.toLowerCase().replace(/・/g, ' ');

  // URL 디코딩해서 비교
  const decodedCurrentFolder = decodeURIComponent(currentFolder);

  console.log(`🔍 단어: ${vocab.lemma}`);
  console.log(`   현재 폴더: "${decodedCurrentFolder}"`);
  console.log(`   예상 폴더: "${expectedFolder}"`);
  console.log(`   수정 필요: ${decodedCurrentFolder !== expectedFolder}`);

  return decodedCurrentFolder !== expectedFolder;
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('🔧 일본어 단어 오디오 경로 수정 시작...\n');

  try {
    // ・이 포함된 일본어 단어들 조회
    const problemWords = await prisma.vocab.findMany({
      where: {
        AND: [
          {
            OR: [
              { source: 'jlpt_total' },
              { levelJLPT: { not: null } }
            ]
          },
          {
            lemma: {
              contains: '・'
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

    console.log(`📊 ・이 포함된 일본어 단어 ${problemWords.length}개 발견\n`);

    const wordsToUpdate = [];

    // 수정이 필요한 단어들 필터링
    for (const vocab of problemWords) {
      if (needsPathCorrection(vocab)) {
        wordsToUpdate.push(vocab);
      }
    }

    console.log(`🔧 수정이 필요한 단어: ${wordsToUpdate.length}개\n`);

    if (wordsToUpdate.length === 0) {
      console.log('✅ 수정이 필요한 단어가 없습니다.');
      return;
    }

    // 수정 실행
    let updatedCount = 0;
    const updateResults = [];

    for (const vocab of wordsToUpdate) {
      try {
        // 올바른 경로 생성
        const correctPaths = generateCorrectJapanesePaths(vocab);

        console.log(`🔧 수정 중: ${vocab.lemma} (ID: ${vocab.id})`);
        console.log(`   레벨: ${vocab.levelJLPT}`);
        console.log(`   새 경로: jlpt/${(vocab.levelJLPT || 'N5').toLowerCase()}/${vocab.lemma.toLowerCase().replace(/・/g, ' ')}/`);

        // dictentry 업데이트
        await prisma.dictentry.update({
          where: {
            vocabId: vocab.id
          },
          data: {
            audioLocal: JSON.stringify(correctPaths)
          }
        });

        updatedCount++;
        updateResults.push({
          vocabId: vocab.id,
          lemma: vocab.lemma,
          levelJLPT: vocab.levelJLPT,
          oldPath: parseAudioLocal(vocab.dictentry?.audioLocal)?.word || 'N/A',
          newPath: correctPaths.word,
          success: true
        });

        console.log(`   ✅ 업데이트 완료\n`);

      } catch (error) {
        console.error(`   ❌ 업데이트 실패: ${error.message}\n`);
        updateResults.push({
          vocabId: vocab.id,
          lemma: vocab.lemma,
          levelJLPT: vocab.levelJLPT,
          success: false,
          error: error.message
        });
      }
    }

    // 결과 요약
    console.log('='.repeat(60));
    console.log('📋 수정 결과 요약');
    console.log('='.repeat(60));
    console.log(`총 대상 단어: ${wordsToUpdate.length}개`);
    console.log(`성공적으로 수정: ${updatedCount}개`);
    console.log(`수정 실패: ${wordsToUpdate.length - updatedCount}개`);

    // 상세 결과
    if (updateResults.length > 0) {
      console.log('\n상세 결과:');
      console.log('-'.repeat(40));

      updateResults.forEach(result => {
        const status = result.success ? '✅' : '❌';
        console.log(`${status} ${result.lemma} (${result.levelJLPT})`);
        if (result.success) {
          console.log(`   이전: ${result.oldPath}`);
          console.log(`   이후: ${result.newPath}`);
        } else {
          console.log(`   에러: ${result.error}`);
        }
        console.log('');
      });
    }

    // JSON 파일로 결과 저장
    const fs = require('fs');
    const detailedResults = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTargetWords: wordsToUpdate.length,
        successfulUpdates: updatedCount,
        failedUpdates: wordsToUpdate.length - updatedCount
      },
      updateDetails: updateResults
    };

    fs.writeFileSync('japanese-audio-path-fix-results.json', JSON.stringify(detailedResults, null, 2));
    console.log('\n📄 상세 결과가 japanese-audio-path-fix-results.json 파일에 저장되었습니다.');

    console.log('\n🎉 경로 수정 완료!');

  } catch (error) {
    console.error('❌ 수정 중 오류 발생:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 스크립트 실행
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { generateCorrectJapanesePaths, needsPathCorrection, isJapaneseWord };