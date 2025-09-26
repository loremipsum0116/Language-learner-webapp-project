const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

// 리포트 파일 읽기
const reportPath = path.join(__dirname, 'jlpt-audio-fix-report.json');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

// GCS URL 패턴
const GCS_BASE_URL = 'https://storage.googleapis.com/languagepractice-audio/';

async function checkGCSFile(filePath) {
  try {
    const url = GCS_BASE_URL + filePath;
    const response = await axios.head(url);
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

async function getGCSPath(originalPath) {
  // 다양한 경로 패턴 시도
  const patterns = [
    // 원래 경로에서 public/ 제거
    originalPath.replace('public/', ''),
    // jlpt/jlpt 패턴
    originalPath.replace('public/', 'jlpt/'),
    // 직접 경로
    originalPath.replace('public/jlpt/', ''),
    // jlpt 폴더 안에
    'jlpt/' + originalPath.replace('public/jlpt/', ''),
  ];

  for (const pattern of patterns) {
    const exists = await checkGCSFile(pattern);
    if (exists) {
      console.log(`  ✅ GCS에서 찾음: ${pattern}`);
      return GCS_BASE_URL + pattern;
    }
  }

  return null;
}

async function updateToGCSAudio() {
  // MySQL 연결
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'tlagustjr!23',
    database: 'deutsch_learner'
  });

  try {
    console.log('🔍 GCS 오디오 URL로 업데이트 시작...\n');

    const problematicPaths = report.problematicPaths;
    console.log(`📊 처리할 문제 경로: ${problematicPaths.length}개\n`);

    // 단어별로 그룹화
    const wordGroups = {};
    for (const item of problematicPaths) {
      if (!wordGroups[item.lemma]) {
        wordGroups[item.lemma] = [];
      }
      wordGroups[item.lemma].push(item);
    }

    let updatedCount = 0;
    let notFoundCount = 0;
    const notFoundItems = [];

    for (const [lemma, items] of Object.entries(wordGroups)) {
      console.log(`\n🔄 처리 중: ${lemma}`);

      try {
        // vocab 테이블에서 해당 단어 찾기
        const [rows] = await connection.execute(
          'SELECT * FROM vocab WHERE lemma = ? LIMIT 1',
          [lemma]
        );

        if (rows.length === 0) {
          console.log(`  ❌ 데이터베이스에서 찾을 수 없음`);
          continue;
        }

        const vocab = rows[0];
        let audioLocal = {};
        let audioRemote = {};

        // 기존 JSON 파싱
        try {
          if (vocab.audioLocal) audioLocal = JSON.parse(vocab.audioLocal);
        } catch (e) {}

        try {
          if (vocab.audioRemote) audioRemote = JSON.parse(vocab.audioRemote);
        } catch (e) {}

        let updated = false;

        for (const item of items) {
          const gcsUrl = await getGCSPath(item.originalPath);

          if (gcsUrl) {
            // audioRemote 필드 업데이트
            audioRemote[item.audioType] = gcsUrl;
            // audioLocal도 GCS URL로 업데이트 (로컬 파일이 없으므로)
            audioLocal[item.audioType] = gcsUrl;

            updated = true;
            updatedCount++;
          } else {
            console.log(`  ❌ GCS에서도 찾을 수 없음: ${item.audioType}`);
            notFoundCount++;
            notFoundItems.push({
              lemma: lemma,
              audioType: item.audioType,
              originalPath: item.originalPath
            });
          }
        }

        if (updated) {
          await connection.execute(
            'UPDATE vocab SET audioLocal = ?, audioRemote = ? WHERE id = ?',
            [JSON.stringify(audioLocal), JSON.stringify(audioRemote), vocab.id]
          );
          console.log(`  ✅ 데이터베이스 업데이트 완료`);
        }

      } catch (error) {
        console.error(`  ❌ 에러: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 최종 결과:');
    console.log(`  ✅ GCS URL로 업데이트: ${updatedCount}개`);
    console.log(`  ❌ GCS에서도 찾을 수 없음: ${notFoundCount}개`);

    // 업데이트 결과 저장
    const updateReport = {
      timestamp: new Date().toISOString(),
      totalProblematic: problematicPaths.length,
      updatedToGCS: updatedCount,
      notFoundInGCS: notFoundCount,
      notFoundDetails: notFoundItems.slice(0, 50) // 처음 50개만 저장
    };

    fs.writeFileSync(
      path.join(__dirname, 'gcs-update-report.json'),
      JSON.stringify(updateReport, null, 2)
    );

    console.log('\n📄 리포트 저장됨: gcs-update-report.json');

  } finally {
    await connection.end();
  }
}

// 실행
updateToGCSAudio()
  .then(() => {
    console.log('\n🎉 GCS 오디오 URL 업데이트 완료!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  });