#!/usr/bin/env node

/**
 * 일본어 오디오 경로 데이터베이스 수정 스크립트
 *
 * 문제 해결:
 * 1. 영어 접미사 제거 (_defeat, _noun, _monk 등)
 * 2. public 경로 추가
 * 3. 실제 GCS 경로와 일치시킴
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

// 수정 로그 파일
const LOG_FILE = 'database-fix-log.txt';
fs.writeFileSync(LOG_FILE, `=== 일본어 오디오 경로 수정 로그 ===\n시작: ${new Date().toLocaleString('ko-KR')}\n\n`);

// 영어 접미사 패턴
const ENGLISH_SUFFIX_PATTERNS = [
  /_defeat$/,
  /_noun$/,
  /_verb$/,
  /_adjective$/,
  /_adverb$/,
  /_monk$/,
  /_suffix$/,
  /_prefix$/,
  /_batsu$/,
  /_particle$/
];

/**
 * audioLocal 경로 수정 함수
 */
function fixAudioLocalPath(audioLocal) {
  if (!audioLocal) return null;

  let audioData = null;

  try {
    // JSON 파싱
    if (typeof audioLocal === 'string' && audioLocal.startsWith('{')) {
      audioData = JSON.parse(audioLocal);
    } else if (typeof audioLocal === 'string') {
      // 단순 경로인 경우
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
    console.error('JSON 파싱 실패:', e);
    return null;
  }

  if (!audioData) return null;

  // 각 경로 수정
  const fixPath = (path) => {
    if (!path) return path;

    // 1. 영어 접미사 제거
    let fixedPath = path;
    ENGLISH_SUFFIX_PATTERNS.forEach(pattern => {
      // jlpt/n1/ippai_defeat/word.mp3 -> jlpt/n1/ippai/word.mp3
      fixedPath = fixedPath.replace(/\/([^/]+)(_[a-z]+)\//g, (match, base, suffix) => {
        if (pattern.test(base + suffix)) {
          console.log(`  수정: ${base}${suffix} → ${base}`);
          return `/${base}/`;
        }
        return match;
      });
    });

    // 2. public 경로 추가 (없으면)
    if (!fixedPath.includes('/public/') && fixedPath.includes('jlpt/')) {
      fixedPath = fixedPath.replace('jlpt/', 'public/jlpt/');
    }

    return fixedPath;
  };

  return {
    word: fixPath(audioData.word),
    gloss: fixPath(audioData.gloss),
    example: fixPath(audioData.example)
  };
}

/**
 * 메인 수정 함수
 */
async function fixJapaneseAudioDatabase() {
  console.log('🔧 일본어 오디오 데이터베이스 수정 시작...');

  let totalProcessed = 0;
  let totalFixed = 0;
  let totalFailed = 0;

  try {
    // 모든 일본어 단어 조회
    const dictentries = await prisma.dictentry.findMany({
      where: {
        OR: [
          { audioLocal: { contains: 'jlpt/' } },
          { vocab: { source: 'jlpt_total' } },
          { vocab: { levelJLPT: { not: null } } }
        ]
      },
      include: {
        vocab: {
          select: {
            id: true,
            lemma: true,
            levelJLPT: true,
            source: true
          }
        }
      }
    });

    console.log(`📊 총 ${dictentries.length}개의 일본어 단어 처리 중...`);

    const BATCH_SIZE = 100;

    for (let i = 0; i < dictentries.length; i += BATCH_SIZE) {
      const batch = dictentries.slice(i, i + BATCH_SIZE);
      console.log(`\n🔄 배치 처리: ${i + 1}-${Math.min(i + BATCH_SIZE, dictentries.length)} / ${dictentries.length}`);

      for (const entry of batch) {
        totalProcessed++;

        if (!entry.audioLocal) continue;

        const original = entry.audioLocal;
        const fixed = fixAudioLocalPath(original);

        if (!fixed) {
          totalFailed++;
          continue;
        }

        // 변경사항이 있는지 확인
        const fixedJson = JSON.stringify(fixed);
        const originalJson = typeof original === 'string' ? original : JSON.stringify(original);

        if (fixedJson !== originalJson) {
          // 데이터베이스 업데이트
          try {
            await prisma.dictentry.update({
              where: { id: entry.id },
              data: { audioLocal: fixedJson }
            });

            totalFixed++;
            const logEntry = `✅ ${entry.vocab?.lemma} (${entry.vocab?.levelJLPT}): 수정 완료\n`;
            fs.appendFileSync(LOG_FILE, logEntry);
            console.log(`  ✅ ${entry.vocab?.lemma}: 수정 완료`);
          } catch (error) {
            totalFailed++;
            console.error(`  ❌ ${entry.vocab?.lemma}: 수정 실패 - ${error.message}`);
          }
        }
      }

      // 진행상황 저장
      if (totalProcessed % 500 === 0) {
        const progress = `진행: ${totalProcessed}/${dictentries.length} | 수정: ${totalFixed} | 실패: ${totalFailed}\n`;
        fs.appendFileSync(LOG_FILE, progress);
      }
    }

    // 최종 결과
    const summary = `
=== 수정 완료 ===
완료 시간: ${new Date().toLocaleString('ko-KR')}
총 처리: ${totalProcessed}개
수정됨: ${totalFixed}개
실패: ${totalFailed}개
변경 없음: ${totalProcessed - totalFixed - totalFailed}개
`;

    fs.appendFileSync(LOG_FILE, summary);
    console.log(summary);

  } finally {
    await prisma.$disconnect();
  }
}

// 스크립트 실행
if (require.main === module) {
  fixJapaneseAudioDatabase().catch(console.error);
}

module.exports = { fixJapaneseAudioDatabase, fixAudioLocalPath };