const mysql = require('mysql2/promise');
const axios = require('axios');
require('dotenv').config();

// 특정 문제 항목들의 매핑
const problemMappings = {
  'tatsu_zetsu': 'tatsu',  // 絶つ
  'miru_shin': 'miru',     // 診る
  'tsukuru_zou': 'tsukuru', // 造る (하나는 이미 올바름)
  'ken_2': 'ken2',         // 권 (없지만 있을 수 있음)
};

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

async function fixSpecificAudioPaths() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'tlagustjr!23',
    database: 'deutsch_learner'
  });

  try {
    console.log('🔍 특정 문제 오디오 경로 수정 시작...\n');

    // 문제가 있는 모든 항목 조회
    const [rows] = await connection.execute(`
      SELECT d.id, d.vocabId, v.lemma, d.audioLocal
      FROM dictentry d
      JOIN vocab v ON d.vocabId = v.id
      WHERE d.audioLocal LIKE '%tatsu_zetsu%'
         OR d.audioLocal LIKE '%miru_shin%'
         OR d.audioLocal LIKE '%tsukuru_zou%'
         OR d.audioLocal LIKE '%ken_2%'
    `);

    console.log(`📊 수정할 항목: ${rows.length}개\n`);

    let fixedCount = 0;

    for (const row of rows) {
      console.log(`🔄 처리 중: ${row.lemma}`);

      try {
        const audioLocal = JSON.parse(row.audioLocal);
        let updated = false;
        const newAudioLocal = { ...audioLocal };

        for (const [type, path] of Object.entries(audioLocal)) {
          if (path && path.includes('/jlpt/')) {
            let newPath = path;
            let needsCheck = false;

            // 각 문제 패턴 확인 및 수정
            for (const [oldPattern, newPattern] of Object.entries(problemMappings)) {
              if (path.includes(`/${oldPattern}/`)) {
                newPath = path.replace(`/${oldPattern}/`, `/${newPattern}/`);
                needsCheck = true;
                break;
              }
            }

            if (needsCheck) {
              // Railway 서버에서 수정된 경로 확인
              const testPath = newPath.replace('public', '');
              const exists = await checkRailwayFile(testPath);

              if (exists) {
                console.log(`  ✅ ${type}: ${path} -> ${newPath}`);
                newAudioLocal[type] = newPath;
                updated = true;
              } else {
                console.log(`  ❌ ${type}: 수정 경로에도 파일 없음 ${testPath}`);
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

      } catch (error) {
        console.error(`  ❌ 에러: ${error.message}`);
      }

      console.log();
    }

    console.log('='.repeat(50));
    console.log('📊 최종 결과:');
    console.log(`  ✅ 수정된 항목: ${fixedCount}개`);

  } finally {
    await connection.end();
  }
}

fixSpecificAudioPaths()
  .then(() => {
    console.log('\n🎉 특정 문제 항목 수정 완료!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  });