const { PrismaClient } = require('@prisma/client');
const https = require('https');
const path = require('path');

const prisma = new PrismaClient();

// GCS에서 실제 파일 존재 여부 확인
async function checkFileExists(url) {
  return new Promise((resolve) => {
    https.get(url, { method: 'HEAD' }, (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => {
      resolve(false);
    });
  });
}

// 올바른 JLPT 오디오 경로 생성
function generateCorrectJlptPath(originalPath) {
  // /jlpt/N5/obentou/word.mp3 -> /jlpt/jlpt/n5/obentou/word.mp3
  const pathParts = originalPath.split('/');

  if (pathParts.length >= 4 && pathParts[1] === 'jlpt') {
    const level = pathParts[2].toLowerCase(); // N5 -> n5
    const remainingPath = pathParts.slice(3).join('/'); // obentou/word.mp3
    return `/jlpt/jlpt/${level}/${remainingPath}`;
  }

  return originalPath;
}

async function fixJlptAudioPaths() {
  console.log('🔍 JLPT 오디오 경로 문제 진단 및 수정 시작...\n');

  try {
    // 1. dictentry 테이블에서 audioLocal이 있고 JLPT 관련 항목들 찾기
    console.log('📊 JLPT audioLocal이 있는 항목들 조회 중...');
    const jlptAudioEntries = await prisma.dictentry.findMany({
      where: {
        AND: [
          { audioLocal: { not: null } },
          {
            vocab: {
              levelJLPT: { not: null }
            }
          }
        ]
      },
      include: {
        vocab: {
          select: {
            id: true,
            lemma: true,
            levelJLPT: true
          }
        }
      }
    });

    console.log(`📈 총 ${jlptAudioEntries.length}개의 JLPT audioLocal 항목 발견\n`);

    let fixedCount = 0;
    let problematicPaths = [];
    const batchSize = 50;
    const GCS_BASE_URL = 'https://storage.googleapis.com/language-learner-audio';

    for (let i = 0; i < jlptAudioEntries.length; i += batchSize) {
      const batch = jlptAudioEntries.slice(i, i + batchSize);
      console.log(`🔄 처리 중: ${i + 1} - ${Math.min(i + batchSize, jlptAudioEntries.length)} / ${jlptAudioEntries.length}`);

      for (const entry of batch) {
        if (!entry.audioLocal) continue;

        let audioLocal;
        try {
          audioLocal = typeof entry.audioLocal === 'string'
            ? JSON.parse(entry.audioLocal)
            : entry.audioLocal;
        } catch (e) {
          console.error(`JSON 파싱 실패: ${entry.vocab.lemma}`);
          continue;
        }

        let needsUpdate = false;
        const updatedAudio = { ...audioLocal };

        // word, gloss, example 오디오 경로 확인 및 수정
        for (const audioType of ['word', 'gloss', 'example']) {
          const audioPath = audioLocal[audioType];

          if (audioPath && audioPath.includes('public/jlpt/')) {
            // 현재 경로로 파일 존재 확인
            const currentUrl = `${GCS_BASE_URL}/${audioPath}`;
            const currentExists = await checkFileExists(currentUrl);

            if (!currentExists) {
              // 올바른 경로 생성: public/jlpt/n1/xxx -> jlpt/jlpt/n1/xxx
              const correctedPath = audioPath.replace('public/jlpt/', 'jlpt/jlpt/');
              const correctedUrl = `${GCS_BASE_URL}/${correctedPath}`;
              const correctedExists = await checkFileExists(correctedUrl);

              if (correctedExists) {
                console.log(`✅ 수정 필요: ${entry.vocab.lemma} (${audioType})`);
                console.log(`   기존: ${audioPath}`);
                console.log(`   수정: ${correctedPath}`);

                updatedAudio[audioType] = correctedPath;
                needsUpdate = true;
                fixedCount++;
              } else {
                problematicPaths.push({
                  lemma: entry.vocab.lemma,
                  audioType,
                  originalPath: audioPath,
                  correctedPath: correctedPath,
                  issue: 'File not found in both locations'
                });
              }
            }
          }
        }

        // 데이터베이스 업데이트
        if (needsUpdate) {
          await prisma.dictentry.update({
            where: { id: entry.id },
            data: { audioLocal: JSON.stringify(updatedAudio) }
          });
        }
      }

      // 배치 처리 후 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n📊 처리 결과:`);
    console.log(`✅ 수정된 오디오 경로: ${fixedCount}개`);
    console.log(`❌ 문제가 있는 경로: ${problematicPaths.length}개\n`);

    if (problematicPaths.length > 0) {
      console.log('🚨 해결되지 않은 문제들:');
      problematicPaths.slice(0, 10).forEach(item => {
        console.log(`- ${item.lemma} (${item.audioType}): ${item.originalPath}`);
        console.log(`  이유: ${item.issue}\n`);
      });

      if (problematicPaths.length > 10) {
        console.log(`... 그 외 ${problematicPaths.length - 10}개 더 있음\n`);
      }
    }

    // 수정 결과를 파일로 저장
    const fs = require('fs');
    const reportPath = path.join(__dirname, 'jlpt-audio-fix-report.json');
    const report = {
      timestamp: new Date().toISOString(),
      totalEntries: jlptAudioEntries.length,
      fixedCount,
      problematicPaths
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 상세 리포트 저장됨: ${reportPath}`);

    console.log('\n🎉 JLPT 오디오 경로 수정 완료!');

  } catch (error) {
    console.error('❌ 오류 발생:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 스크립트 실행
if (require.main === module) {
  fixJlptAudioPaths()
    .then(() => {
      console.log('✅ 스크립트 실행 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 스크립트 실행 실패:', error);
      process.exit(1);
    });
}

module.exports = { fixJlptAudioPaths };