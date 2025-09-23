#!/usr/bin/env node

// Google Cloud Storage 업로드 스크립트
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

// GCS 설정
const storage = new Storage({
  projectId: 'your-project-id', // 실제 프로젝트 ID로 변경
  keyFilename: './gcs-service-account.json' // 서비스 계정 키 파일
});

const BUCKET_NAME = 'language-learner-audio';
const bucket = storage.bucket(BUCKET_NAME);

// 업로드할 폴더들
const UPLOAD_FOLDERS = [
  'web/apps/backend/public/audio',
  'web/apps/backend/public/video',
  // 추가 미디어 폴더들
];

async function uploadFile(localFilePath, destinationPath) {
  try {
    await bucket.upload(localFilePath, {
      destination: destinationPath,
      metadata: {
        cacheControl: 'public, max-age=31536000', // 1년 캐시
      },
    });
    console.log(`✅ ${localFilePath} uploaded to ${destinationPath}`);
  } catch (error) {
    console.error(`❌ Error uploading ${localFilePath}:`, error);
  }
}

async function uploadDirectory(dirPath, gcsFolderPrefix = '') {
  if (!fs.existsSync(dirPath)) {
    console.log(`⚠️  Directory ${dirPath} does not exist, skipping...`);
    return;
  }

  const files = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dirPath, file.name);
    const gcsPath = path.join(gcsFolderPrefix, file.name).replace(/\\/g, '/');

    if (file.isDirectory()) {
      await uploadDirectory(fullPath, gcsPath);
    } else if (file.isFile()) {
      // 미디어 파일만 업로드
      const ext = path.extname(file.name).toLowerCase();
      if (['.mp3', '.wav', '.mp4', '.webm', '.ogg'].includes(ext)) {
        await uploadFile(fullPath, gcsPath);
      }
    }
  }
}

async function main() {
  console.log('🚀 Starting upload to Google Cloud Storage...');
  console.log(`📦 Bucket: ${BUCKET_NAME}`);

  for (const folder of UPLOAD_FOLDERS) {
    console.log(`\n📁 Processing folder: ${folder}`);
    await uploadDirectory(folder);
  }

  console.log('\n✅ Upload complete!');
  console.log(`🌐 Your files are now available at:`);
  console.log(`https://storage.googleapis.com/${BUCKET_NAME}/[file-path]`);
}

// 실행
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { uploadFile, uploadDirectory };