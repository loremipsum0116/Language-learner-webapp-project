const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

// MongoDB 연결
const MONGODB_URI = 'mongodb+srv://user:1111@cluster0.nxbef.mongodb.net/deutsch_learner';
mongoose.connect(MONGODB_URI);

// 리포트 파일 읽기
const reportPath = path.join(__dirname, 'jlpt-audio-fix-report.json');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

// Vocab 스키마 정의
const vocabSchema = new mongoose.Schema({
  lemma: String,
  reading: String,
  sense: Array,
  wordType: String,
  level: String,
  romaji: String,
  glosses: Array,
  audioLocal: {
    word: String,
    gloss: String,
    example: String
  },
  audioRemote: {
    word: String,
    gloss: String,
    example: String
  },
  examples: Array
}, {
  collection: 'vocab',
  strict: false
});

const Vocab = mongoose.model('Vocab', vocabSchema);

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

  for (const [lemma, items] of Object.entries(wordGroups)) {
    console.log(`\n🔄 처리 중: ${lemma}`);

    try {
      const vocab = await Vocab.findOne({ lemma: lemma });

      if (!vocab) {
        console.log(`  ❌ 데이터베이스에서 찾을 수 없음`);
        continue;
      }

      let updated = false;
      const updates = {};

      for (const item of items) {
        const gcsUrl = await getGCSPath(item.originalPath);

        if (gcsUrl) {
          // audioRemote 필드 업데이트
          if (!updates.audioRemote) {
            updates.audioRemote = vocab.audioRemote || {};
          }
          updates.audioRemote[item.audioType] = gcsUrl;

          // audioLocal 필드도 GCS URL로 업데이트 (로컬 파일이 없으므로)
          if (!updates.audioLocal) {
            updates.audioLocal = vocab.audioLocal || {};
          }
          updates.audioLocal[item.audioType] = gcsUrl;

          updated = true;
          updatedCount++;
        } else {
          console.log(`  ❌ GCS에서도 찾을 수 없음: ${item.audioType}`);
          notFoundCount++;
        }
      }

      if (updated) {
        await Vocab.updateOne(
          { _id: vocab._id },
          { $set: updates }
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
    notFoundInGCS: notFoundCount
  };

  fs.writeFileSync(
    path.join(__dirname, 'gcs-update-report.json'),
    JSON.stringify(updateReport, null, 2)
  );

  console.log('\n📄 리포트 저장됨: gcs-update-report.json');
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