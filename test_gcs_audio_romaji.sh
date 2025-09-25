#!/bin/bash

# GCS 오디오 파일 존재 여부 검증 스크립트 (로마자 버전)
# 공백이 있는 일본어 단어들의 로마자 폴더명 패턴을 테스트

echo "=== GCS 오디오 파일 검증 시작 (로마자) ==="
echo "시작 시간: $(date)"
echo ""

# 결과 파일 초기화
timestamp=$(date +"%Y%m%d_%H%M%S")
result_file="gcs_audio_romaji_results_${timestamp}.txt"

echo "=== GCS 오디오 파일 검증 결과 (로마자) ===" > "$result_file"
echo "시작 시간: $(date)" >> "$result_file"
echo "" >> "$result_file"

# 통계 변수
total_tested=0
total_success=0
total_failed=0

test_audio_url() {
    local url="$1"
    local timeout=10

    if curl -f -s --max-time "$timeout" -I "$url" > /dev/null 2>&1; then
        echo "OK"
    else
        echo "FAILED"
    fi
}

test_romaji_pattern() {
    local japanese_word="$1"
    local romaji_with_spaces="$2"
    local romaji_no_spaces="$3"
    local level="n4"

    echo "🔄 테스트 중: $japanese_word"
    echo "--- $japanese_word ---" >> "$result_file"

    # 공백 포함 버전 테스트
    echo "  공백 포함 ($romaji_with_spaces):" >> "$result_file"
    for audio_type in "word" "gloss" "example"; do
        local url="https://storage.googleapis.com/language-learner-audio/jlpt/$level/$romaji_with_spaces/$audio_type.mp3"
        local result=$(test_audio_url "$url")

        ((total_tested++))
        if [ "$result" = "OK" ]; then
            echo "✅ $japanese_word (spaces): $audio_type.mp3 OK"
            echo "    $audio_type: ✅ OK" >> "$result_file"
            ((total_success++))
        else
            echo "❌ $japanese_word (spaces): $audio_type.mp3 FAILED"
            echo "    $audio_type: ❌ FAILED" >> "$result_file"
            ((total_failed++))
        fi
        echo "      URL: $url" >> "$result_file"
        sleep 0.2
    done

    # 공백 제거 버전 테스트
    echo "  공백 제거 ($romaji_no_spaces):" >> "$result_file"
    for audio_type in "word" "gloss" "example"; do
        local url="https://storage.googleapis.com/language-learner-audio/jlpt/$level/$romaji_no_spaces/$audio_type.mp3"
        local result=$(test_audio_url "$url")

        ((total_tested++))
        if [ "$result" = "OK" ]; then
            echo "✅ $japanese_word (no_spaces): $audio_type.mp3 OK"
            echo "    $audio_type: ✅ OK" >> "$result_file"
            ((total_success++))
        else
            echo "❌ $japanese_word (no_spaces): $audio_type.mp3 FAILED"
            echo "    $audio_type: ❌ FAILED" >> "$result_file"
            ((total_failed++))
        fi
        echo "      URL: $url" >> "$result_file"
        sleep 0.2
    done

    echo ""
}

# 실제 GCS에 저장된 로마자 폴더명으로 테스트
test_romaji_pattern "あいさつ する" "aisatsu suru" "aisatsusuru"
test_romaji_pattern "びっくり する" "bikkuri suru" "bikkurisuru"
test_romaji_pattern "チェック する" "chekku suru" "chekkusuru"
test_romaji_pattern "ごらん に なる" "goran ni naru" "goranninaru"
test_romaji_pattern "けんか する" "kenka suru" "kenkasuru"

# 최종 결과
echo ""
echo "=== 최종 검증 결과 ==="
echo "완료 시간: $(date)"
echo "총 검증: ${total_tested}개"
echo "성공: ${total_success}개 ($(echo "scale=1; $total_success*100/$total_tested" | bc -l)%)"
echo "실패: ${total_failed}개 ($(echo "scale=1; $total_failed*100/$total_tested" | bc -l)%)"

# 결과 요약
{
    echo ""
    echo "=== 최종 검증 결과 ==="
    echo "완료 시간: $(date)"
    echo "총 검증: ${total_tested}개"
    echo "성공: ${total_success}개"
    echo "실패: ${total_failed}개"
} >> "$result_file"

echo ""
echo "결과 파일 생성: $result_file"