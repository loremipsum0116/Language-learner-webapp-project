#!/usr/bin/env node

/**
 * 프로덕션 DB로 일본어 오디오 경로 수정 마이그레이션 스크립트
 *
 * 로컬에서 검증된 audioLocal 필드 수정사항을 프로덕션 DB에 적용
 * Railway MySQL 데이터베이스에 연결하여 동일한 수정 적용
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

// 프로덕션 DB URL - Railway 환경변수에서 가져오기
const DATABASE_URL = process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;

console.log('🚀 프로덕션 DB 마이그레이션 준비...');
console.log('📊 연결할 DB:', DATABASE_URL ? DATABASE_URL.replace(/:[^@]+@/, ':***@') : '환경변수 없음');

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL 환경변수가 설정되지 않았습니다.');
  console.log('💡 실행 방법:');
  console.log('   DATABASE_URL_PRODUCTION="mysql://user:pass@host:port/db" node migrate-to-production.js');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL
    }
  }
});

// 마이그레이션 로그 파일
const LOG_FILE = 'production-migration-log.txt';
fs.writeFileSync(LOG_FILE, `=== 프로덕션 DB 마이그레이션 로그 ===\n시작: ${new Date().toLocaleString('ko-KR')}\n\n`);

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
 * audioLocal 경로 수정 함수 (로컬과 동일)
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
 * 프로덕션 DB 마이그레이션 함수
 */
async function migrateToProduction() {
  console.log('🔧 프로덕션 DB 일본어 오디오 마이그레이션 시작...');

  let totalProcessed = 0;
  let totalFixed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  try {
    // DB 연결 테스트
    console.log('🔍 프로덕션 DB 연결 테스트...');
    await prisma.$connect();

    const testQuery = await prisma.vocab.count();
    console.log(`✅ DB 연결 성공! 총 vocab 레코드: ${testQuery}개`);

    // 모든 일본어 단어 조회
    console.log('📋 일본어 단어 조회 중...');
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

    // 안전을 위해 작은 배치로 처리
    const BATCH_SIZE = 50;

    for (let i = 0; i < dictentries.length; i += BATCH_SIZE) {
      const batch = dictentries.slice(i, i + BATCH_SIZE);
      console.log(`\n🔄 배치 처리: ${i + 1}-${Math.min(i + BATCH_SIZE, dictentries.length)} / ${dictentries.length}`);

      for (const entry of batch) {
        totalProcessed++;

        if (!entry.audioLocal) {
          totalSkipped++;
          continue;
        }

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
          // 프로덕션 데이터베이스 업데이트
          try {
            await prisma.dictentry.update({
              where: { id: entry.id },
              data: { audioLocal: fixedJson }
            });

            totalFixed++;
            const logEntry = `✅ ${entry.vocab?.lemma} (${entry.vocab?.levelJLPT}): 프로덕션 수정 완료\n`;
            fs.appendFileSync(LOG_FILE, logEntry);
            console.log(`  ✅ ${entry.vocab?.lemma}: 프로덕션 수정 완료`);
          } catch (error) {
            totalFailed++;
            const errorLog = `❌ ${entry.vocab?.lemma}: 프로덕션 수정 실패 - ${error.message}\n`;
            fs.appendFileSync(LOG_FILE, errorLog);
            console.error(`  ❌ ${entry.vocab?.lemma}: 프로덕션 수정 실패 - ${error.message}`);
          }
        } else {
          totalSkipped++;
        }

        // 5초마다 진행상황 출력
        if (totalProcessed % 50 === 0) {
          const progress = `[진행상황] ${totalProcessed}/${dictentries.length} | 수정: ${totalFixed} | 건너뜀: ${totalSkipped} | 실패: ${totalFailed}`;
          console.log(progress);
          fs.appendFileSync(LOG_FILE, progress + '\n');
        }
      }

      // 배치 사이 짧은 대기 (DB 부하 방지)
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 최종 결과
    const summary = `
=== 프로덕션 마이그레이션 완료 ===
완료 시간: ${new Date().toLocaleString('ko-KR')}
총 처리: ${totalProcessed}개
수정됨: ${totalFixed}개
건너뜀: ${totalSkipped}개 (변경사항 없음)
실패: ${totalFailed}개

🎉 프로덕션 환경 일본어 오디오 경로 수정 완료!
`;

    fs.appendFileSync(LOG_FILE, summary);
    console.log(summary);

    // 검증: 수정된 레코드 확인
    if (totalFixed > 0) {
      console.log('\n🔍 수정 결과 검증 중...');
      const updatedCount = await prisma.dictentry.count({
        where: {
          audioLocal: { contains: 'public/jlpt/' }
        }
      });
      console.log(`✅ public/jlpt/ 경로를 포함한 레코드: ${updatedCount}개`);
      fs.appendFileSync(LOG_FILE, `검증: public/jlpt/ 경로 레코드 ${updatedCount}개 확인\n`);
    }

  } catch (error) {
    console.error('❌ 프로덕션 마이그레이션 실패:', error);
    fs.appendFileSync(LOG_FILE, `❌ 마이그레이션 실패: ${error.message}\n`);
    throw error;
  } finally {
    await prisma.$disconnect();
    console.log('🔌 프로덕션 DB 연결 해제 완료');
  }
}

// 스크립트 실행
if (require.main === module) {
  // 실행 전 확인
  console.log('\n⚠️  프로덕션 환경 마이그레이션 주의사항:');
  console.log('1. 이 스크립트는 프로덕션 데이터베이스를 직접 수정합니다');
  console.log('2. 실행 전 데이터베이스 백업을 권장합니다');
  console.log('3. Railway 환경에서 DATABASE_URL이 올바르게 설정되어야 합니다');
  console.log('\n5초 후 시작합니다... (Ctrl+C로 중단 가능)');

  setTimeout(() => {
    migrateToProduction().catch(console.error);
  }, 5000);
}

module.exports = { migrateToProduction, fixAudioLocalPath };