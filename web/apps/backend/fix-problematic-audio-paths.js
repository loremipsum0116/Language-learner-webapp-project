const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

// 원래 문제 리포트 읽기
const reportPath = path.join(__dirname, 'jlpt-audio-fix-report.json');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

// Railway 서버에서 파일 존재 여부 확인
async function checkRailwayFile(path) {
  try {
    const url = `https://clever-elegance-production.up.railway.app${path}`;
    const response = await axios.head(url);
    return response.status === 200 || response.status === 301;
  } catch (error) {
    return false;
  }
}

// 경로 수정 패턴들
function getFixedPath(originalPath) {
  let fixedPath = originalPath;

  // 1. 대문자 레벨을 소문자로 변경 (N1 -> n1, N2 -> n2 등)
  fixedPath = fixedPath.replace(/\/jlpt\/N(\d)\//g, '/jlpt/n$1/');

  // 2. underscore + 숫자 패턴 (ken_2 -> ken2)
  fixedPath = fixedPath.replace(/\/([a-z]+)_(\d+)\//g, '/$1$2/');

  // 3. underscore + 다른 단어 패턴 (tatsu_zetsu -> tatsu, miru_shin -> miru)
  fixedPath = fixedPath.replace(/\/([a-z]+)_[a-z]+\//g, '/$1/');

  // 특수문자는 프론트엔드에서 별도 처리하므로 건드리지 않음

  return fixedPath;
}

async function fixProblematicAudioPaths() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'tlagustjr!23',
    database: 'deutsch_learner'
  });

  try {
    console.log('🔍 문제가 있는 오디오 경로 수정 시작...\n');

    // 문제가 있는 단어들만 추출 (중복 제거)
    const problematicWords = [...new Set(report.problematicPaths.map(item => item.lemma))];
    console.log(`📊 수정할 단어: ${problematicWords.length}개\n`);

    let fixedCount = 0;
    let notFoundCount = 0;

    for (const lemma of problematicWords) {
      console.log(`🔄 처리 중: ${lemma}`);

      try {
        // 해당 단어의 dictentry 조회
        const [rows] = await connection.execute(
          'SELECT d.id, d.audioLocal FROM dictentry d JOIN vocab v ON d.vocabId = v.id WHERE v.lemma = ?',
          [lemma]
        );

        for (const row of rows) {
          const audioLocal = JSON.parse(row.audioLocal);
          let updated = false;
          const newAudioLocal = { ...audioLocal };

          for (const [type, path] of Object.entries(audioLocal)) {
            if (path && path.includes('/jlpt/')) {
              const fixedPath = getFixedPath(path);

              if (fixedPath !== path) {
                // Railway 서버에서 수정된 경로 확인
                const testPath = fixedPath.replace('public', '');
                const exists = await checkRailwayFile(testPath);

                if (exists) {
                  console.log(`  ✅ ${type}: ${path} -> ${fixedPath}`);
                  newAudioLocal[type] = fixedPath;
                  updated = true;
                } else {
                  console.log(`  ❌ ${type}: 수정 경로에도 파일 없음 ${testPath}`);
                  notFoundCount++;
                }
              }
            }
          }

          if (updated) {
            await connection.execute(
              'UPDATE dictentry SET audioLocal = ? WHERE id = ?',
              [JSON.stringify(newAudioLocal), row.id]
            );
            console.log(`  💾 데이터베이스 업데이트 완료`);
            fixedCount++;
          }
        }

      } catch (error) {
        console.error(`  ❌ 에러: ${error.message}`);
      }

      console.log();
    }

    console.log('='.repeat(50));
    console.log('📊 최종 결과:');
    console.log(`  ✅ 수정된 항목: ${fixedCount}개`);
    console.log(`  ❌ 파일 없음: ${notFoundCount}개`);

    // 결과 리포트 저장
    const resultReport = {
      timestamp: new Date().toISOString(),
      processedWords: problematicWords.length,
      fixedCount: fixedCount,
      notFoundCount: notFoundCount
    };

    fs.writeFileSync(
      path.join(__dirname, 'audio-path-fix-result.json'),
      JSON.stringify(resultReport, null, 2)
    );

    console.log('\n📄 결과 리포트 저장됨: audio-path-fix-result.json');

  } finally {
    await connection.end();
  }
}

fixProblematicAudioPaths()
  .then(() => {
    console.log('\n🎉 문제 있는 오디오 경로 수정 완료!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  });