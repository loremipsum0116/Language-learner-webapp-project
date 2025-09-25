#!/bin/bash

# 누락된 일본어 오디오 파일을 GCS에 업로드하는 스크립트
# 사용법: ./upload-missing-to-gcs.sh

echo "🚀 누락된 일본어 오디오 파일 GCS 업로드 시작..."

# GCS 버킷 경로
BUCKET="gs://language-learner-audio/public/jlpt"

# 로컬 소스 경로
SOURCE_DIR="/Users/simhyunseok/Desktop/Node_PJ/language-learner-web-project/succeed-seeding-file/jlpt/jlpt"

# 실패한 폴더들 배열 (jap_wrong_routes_realtime.txt 분석 결과)
declare -a FAILED_FOLDERS=(
  "n1/ippai"
  "n1/shimai"
  "n1/kiru"
  "n1/sou"
  "n1/kiri"
  "n1/taihen"
)

# 각 폴더 업로드
for folder in "${FAILED_FOLDERS[@]}"; do
  echo ""
  echo "📁 처리 중: $folder"

  # 로컬 경로 확인
  LOCAL_PATH="$SOURCE_DIR/$folder"

  if [ -d "$LOCAL_PATH" ]; then
    echo "  ✅ 로컬 폴더 존재: $LOCAL_PATH"

    # GCS에 업로드 (폴더 전체)
    echo "  📤 GCS 업로드 중..."
    gsutil -m cp -r "$LOCAL_PATH" "$BUCKET/${folder%/*}/"

    if [ $? -eq 0 ]; then
      echo "  ✅ 업로드 성공!"
    else
      echo "  ❌ 업로드 실패: $folder"
    fi
  else
    echo "  ❌ 로컬 폴더 없음: $LOCAL_PATH"
  fi
done

echo ""
echo "🎉 업로드 작업 완료!"
echo ""
echo "📊 업로드 확인 명령어:"
echo "gsutil ls gs://language-learner-audio/public/jlpt/n1/ippai/"
echo "gsutil ls gs://language-learner-audio/public/jlpt/n1/shimai/"
echo "gsutil ls gs://language-learner-audio/public/jlpt/n1/kiru/"
echo "gsutil ls gs://language-learner-audio/public/jlpt/n1/sou/"
echo "gsutil ls gs://language-learner-audio/public/jlpt/n1/kiri/"
echo "gsutil ls gs://language-learner-audio/public/jlpt/n1/taihen/"