const mysql = require('mysql2/promise');
const axios = require('axios');
require('dotenv').config();

// Railway 서버에서 파일 존재 여부 확인
async function checkRailwayFile(path) {
  try {
    const url = `https://clever-elegance-production.up.railway.app${path}`;
    const response = await axios.head(url);
    return response.status === 200 || response.status === 301; // 301도 성공으로 간주
  } catch (error) {
    return false;
  }
}

// 경로에서 올바른 romaji 이름 추출
function getCorrectRomaji(complexPath) {
  // /jlpt/n1/tatsu_zetsu/word.mp3 -> tatsu
  // /jlpt/n1/ken_2/word.mp3 -> ken2 (underscore + 숫자 -> 숫자 직접 붙임)
  // /jlpt/n1/miru_shin/word.mp3 -> miru
  const parts = complexPath.split('/');
  if (parts.length >= 4) {
    const folderName = parts[3];

    // underscore + 숫자 패턴 (ken_2 -> ken2)
    if (/_\d+$/.test(folderName)) {
      return folderName.replace('_', '');
    }

    // underscore + 다른 단어 패턴 (tatsu_zetsu -> tatsu, miru_shin -> miru)
    if (folderName.includes('_')) {
      return folderName.split('_')[0];
    }

    // 기본적으로 그대로 반환
    return folderName;
  }
  return null;
}

async function fixAudioPathMismatch() {
  // MySQL 연결
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'tlagustjr!23',
    database: 'deutsch_learner'
  });

  try {
    console.log('🔍 오디오 경로 불일치 수정 시작...\n');

    // JLPT 관련 dictentry 조회
    const [rows] = await connection.execute(`
      SELECT d.id, d.vocabId, v.lemma, d.audioLocal
      FROM dictentry d
      JOIN vocab v ON d.vocabId = v.id
      WHERE d.audioLocal LIKE '%jlpt%'
      AND v.levelJLPT IS NOT NULL
      ORDER BY v.lemma
    `);

    console.log(`📊 총 ${rows.length}개 항목 확인 중...\n`);

    let fixedCount = 0;
    let checkedCount = 0;

    for (const row of rows) {
      checkedCount++;
      console.log(`🔄 [${checkedCount}/${rows.length}] 처리 중: ${row.lemma}`);

      try {
        const audioLocal = JSON.parse(row.audioLocal);
        let updated = false;
        const newAudioLocal = { ...audioLocal };

        // word, gloss, example 각각 확인
        for (const [type, path] of Object.entries(audioLocal)) {
          if (path && path.includes('/jlpt/')) {
            const correctRomaji = getCorrectRomaji(path);
            if (correctRomaji) {
              // 레벨 추출 (n1, n2 등)
              const levelMatch = path.match(/\/jlpt\/(n\d)\//);
              if (levelMatch) {
                const level = levelMatch[1];
                const correctPath = `/jlpt/jlpt/${level}/${correctRomaji}/${type}.mp3`;

                // Railway 서버에서 올바른 경로 확인
                const exists = await checkRailwayFile(correctPath);
                if (exists) {
                  console.log(`  ✅ ${type}: ${path} -> ${correctPath}`);
                  newAudioLocal[type] = `public${correctPath}`;
                  updated = true;
                } else {
                  console.log(`  ❌ ${type}: 수정 경로에도 파일 없음 ${correctPath}`);
                }
              }
            }
          }
        }

        // 데이터베이스 업데이트
        if (updated) {
          await connection.execute(
            'UPDATE dictentry SET audioLocal = ? WHERE id = ?',
            [JSON.stringify(newAudioLocal), row.id]
          );
          fixedCount++;
          console.log(`  💾 데이터베이스 업데이트 완료`);
        }

      } catch (error) {
        console.error(`  ❌ 처리 중 오류: ${error.message}`);
      }

      console.log(); // 빈 줄 추가
    }

    console.log('='.repeat(50));
    console.log('📊 최종 결과:');
    console.log(`  📋 확인한 항목: ${checkedCount}개`);
    console.log(`  ✅ 수정된 항목: ${fixedCount}개`);

  } finally {
    await connection.end();
  }
}

// 실행
fixAudioPathMismatch()
  .then(() => {
    console.log('\n🎉 오디오 경로 불일치 수정 완료!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  });