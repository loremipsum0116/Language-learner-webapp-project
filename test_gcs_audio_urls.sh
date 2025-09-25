#!/bin/bash

# GCS 오디오 파일 존재 여부 검증 스크립트
# 공백이 있는 일본어 단어들의 다양한 폴더명 패턴을 테스트

echo "=== GCS 오디오 파일 검증 시작 ==="
echo "시작 시간: $(date)"
echo ""

# 결과 파일 초기화
timestamp=$(date +"%Y%m%d_%H%M%S")
result_file="gcs_audio_test_results_${timestamp}.txt"
summary_file="gcs_audio_test_summary_${timestamp}.txt"

echo "=== GCS 오디오 파일 검증 결과 ===" > "$result_file"
echo "시작 시간: $(date)" >> "$result_file"
echo "" >> "$result_file"

# 통계 변수
total_tested=0
total_success=0
total_failed=0
total_timeout=0

# 테스트할 단어들
words=("あいさつ する" "びっくり する" "チェック する" "ごらん に なる" "けんか する")

test_audio_url() {
    local url="$1"
    local timeout=10

    # HEAD 요청으로 파일 존재 여부 확인
    if curl -f -s --max-time "$timeout" -I "$url" > /dev/null 2>&1; then
        echo "OK"
    elif [ $? -eq 28 ]; then
        echo "TIMEOUT"
    else
        echo "FAILED"
    fi
}

generate_patterns() {
    local word="$1"

    # 기본 변환: ・를 공백으로
    local base_word=$(echo "$word" | tr '・' ' ' | tr '[:upper:]' '[:lower:]')

    # 여러 패턴 생성
    declare -A patterns=(
        ["original"]="$word"
        ["spaces"]="$base_word"
        ["no_spaces"]=$(echo "$base_word" | sed 's/ //g')
        ["underscores"]=$(echo "$base_word" | sed 's/ /_/g')
    )

    echo "${patterns[@]}" | tr ' ' '\n'
}

test_word() {
    local word="$1"
    local level="n4"

    echo "🔄 테스트 중: $word"
    echo ""
    echo "--- $word ---" >> "$result_file"

    # 패턴별 테스트
    local base_word=$(echo "$word" | tr '・' ' ' | tr '[:upper:]' '[:lower:]')

    # 1. 원본
    test_pattern "$word" "$word" "original" "$level"

    # 2. 공백 유지
    test_pattern "$word" "$base_word" "spaces" "$level"

    # 3. 공백 제거
    local no_spaces=$(echo "$base_word" | sed 's/ //g')
    test_pattern "$word" "$no_spaces" "no_spaces" "$level"

    # 4. 언더스코어
    local underscores=$(echo "$base_word" | sed 's/ /_/g')
    test_pattern "$word" "$underscores" "underscores" "$level"

    echo ""
}

test_pattern() {
    local original_word="$1"
    local folder_name="$2"
    local pattern_name="$3"
    local level="$4"

    echo "  $pattern_name ($folder_name):" >> "$result_file"

    for audio_type in "word" "gloss" "example"; do
        local url="https://storage.googleapis.com/language-learner-audio/jlpt/$level/$folder_name/$audio_type.mp3"
        local result=$(test_audio_url "$url")

        # 통계 업데이트
        ((total_tested++))
        case "$result" in
            "OK")
                echo "✅ $original_word ($pattern_name): $audio_type.mp3 OK"
                echo "    $audio_type: ✅ OK" >> "$result_file"
                ((total_success++))
                ;;
            "TIMEOUT")
                echo "⏱️ $original_word ($pattern_name): $audio_type.mp3 TIMEOUT"
                echo "    $audio_type: ⏱️ TIMEOUT" >> "$result_file"
                ((total_timeout++))
                ;;
            *)
                echo "❌ $original_word ($pattern_name): $audio_type.mp3 FAILED"
                echo "    $audio_type: ❌ FAILED" >> "$result_file"
                ((total_failed++))
                ;;
        esac

        echo "      URL: $url" >> "$result_file"

        # API 제한을 위한 대기
        sleep 0.2
    done
}

# 메인 실행
for word in "${words[@]}"; do
    test_word "$word"
done

# 최종 결과
echo ""
echo "=== 최종 검증 결과 ==="
echo "완료 시간: $(date)"
echo "총 검증: ${total_tested}개"
echo "성공: ${total_success}개 ($(echo "scale=1; $total_success*100/$total_tested" | bc -l)%)"
echo "실패: ${total_failed}개 ($(echo "scale=1; $total_failed*100/$total_tested" | bc -l)%)"
echo "타임아웃: ${total_timeout}개 ($(echo "scale=1; $total_timeout*100/$total_tested" | bc -l)%)"

# 요약 파일 생성
{
    echo "=== 최종 검증 결과 ==="
    echo "완료 시간: $(date)"
    echo "총 검증: ${total_tested}개"
    echo "성공: ${total_success}개 ($(echo "scale=1; $total_success*100/$total_tested" | bc -l)%)"
    echo "실패: ${total_failed}개 ($(echo "scale=1; $total_failed*100/$total_tested" | bc -l)%)"
    echo "타임아웃: ${total_timeout}개 ($(echo "scale=1; $total_timeout*100/$total_tested" | bc -l)%)"
    echo ""
    echo "결과 파일: $result_file"
} > "$summary_file"

echo ""
echo "결과 파일 생성:"
echo "- $result_file"
echo "- $summary_file"