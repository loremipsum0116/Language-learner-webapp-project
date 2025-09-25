#!/usr/bin/env python3
"""
GCS 오디오 파일 존재 여부 검증 스크립트
공백이 있는 일본어 단어들의 다양한 폴더명 패턴을 테스트
"""

import requests
import time
from datetime import datetime
import json
import re

def test_audio_url(url, timeout=10):
    """오디오 URL이 접근 가능한지 테스트"""
    try:
        response = requests.head(url, timeout=timeout)
        return response.status_code == 200
    except requests.exceptions.Timeout:
        return "timeout"
    except requests.exceptions.RequestException:
        return False

def generate_folder_patterns(word):
    """일본어 단어에 대해 가능한 폴더명 패턴들 생성"""
    base_word = word.lower().replace('・', ' ')

    patterns = {
        'original': word.lower(),
        'spaces': base_word,
        'no_spaces': base_word.replace(' ', ''),
        'underscores': base_word.replace(' ', '_'),
        'encoded': requests.utils.quote(base_word, safe='')
    }

    return patterns

def test_word_audio_files(word, level='n4'):
    """단어의 word, gloss, example 오디오 파일 테스트"""
    patterns = generate_folder_patterns(word)
    results = {}

    for pattern_name, folder_name in patterns.items():
        results[pattern_name] = {}

        base_url = f"https://storage.googleapis.com/language-learner-audio/jlpt/{level}/{folder_name}"

        for audio_type in ['word', 'gloss', 'example']:
            url = f"{base_url}/{audio_type}.mp3"
            result = test_audio_url(url)
            results[pattern_name][audio_type] = {
                'url': url,
                'status': result
            }

            # 실시간 로그
            status_symbol = "✅" if result is True else ("⏱️" if result == "timeout" else "❌")
            print(f"{status_symbol} {word} ({pattern_name}): {audio_type}.mp3 {'OK' if result is True else ('TIMEOUT' if result == 'timeout' else 'FAILED')}")

            # API 요청 제한을 위한 짧은 대기
            time.sleep(0.1)

    return results

def main():
    """메인 실행 함수"""
    print("=== GCS 오디오 파일 검증 시작 ===")
    print(f"시작 시간: {datetime.now()}")
    print()

    # 공백이 있는 단어들 (N4 기준)
    words_with_spaces = [
        'あいさつ する',
        'びっくり する',
        'チェック する',
        'ごらん に なる',
        'けんか する'
    ]

    all_results = {}
    total_tested = 0
    total_success = 0
    total_failed = 0
    total_timeout = 0

    for i, word in enumerate(words_with_spaces, 1):
        print(f"\n🔄 처리 중: {i}/{len(words_with_spaces)} - {word}")
        print("-" * 50)

        results = test_word_audio_files(word)
        all_results[word] = results

        # 통계 업데이트
        for pattern_name, pattern_results in results.items():
            for audio_type, audio_result in pattern_results.items():
                total_tested += 1
                if audio_result['status'] is True:
                    total_success += 1
                elif audio_result['status'] == 'timeout':
                    total_timeout += 1
                else:
                    total_failed += 1

    # 결과 저장
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # JSON 결과 저장
    with open(f'gcs_audio_test_results_{timestamp}.json', 'w', encoding='utf-8') as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)

    # 사람이 읽기 쉬운 텍스트 결과 생성
    with open(f'gcs_audio_test_summary_{timestamp}.txt', 'w', encoding='utf-8') as f:
        f.write("=== GCS 오디오 파일 검증 결과 ===\n")
        f.write(f"완료 시간: {datetime.now()}\n")
        f.write(f"총 검증: {total_tested}개\n")
        f.write(f"성공: {total_success}개 ({total_success/total_tested*100:.1f}%)\n")
        f.write(f"실패: {total_failed}개 ({total_failed/total_tested*100:.1f}%)\n")
        f.write(f"타임아웃: {total_timeout}개 ({total_timeout/total_tested*100:.1f}%)\n\n")

        # 패턴별 성공률 분석
        pattern_stats = {}
        for word, word_results in all_results.items():
            for pattern_name, pattern_results in word_results.items():
                if pattern_name not in pattern_stats:
                    pattern_stats[pattern_name] = {'success': 0, 'total': 0}

                for audio_type, audio_result in pattern_results.items():
                    pattern_stats[pattern_name]['total'] += 1
                    if audio_result['status'] is True:
                        pattern_stats[pattern_name]['success'] += 1

        f.write("=== 패턴별 성공률 ===\n")
        for pattern_name, stats in pattern_stats.items():
            success_rate = stats['success'] / stats['total'] * 100 if stats['total'] > 0 else 0
            f.write(f"{pattern_name}: {stats['success']}/{stats['total']} ({success_rate:.1f}%)\n")

        f.write("\n=== 상세 결과 ===\n")
        for word, word_results in all_results.items():
            f.write(f"\n--- {word} ---\n")
            for pattern_name, pattern_results in word_results.items():
                f.write(f"  {pattern_name}:\n")
                for audio_type, audio_result in pattern_results.items():
                    status = "✅ OK" if audio_result['status'] is True else ("⏱️ TIMEOUT" if audio_result['status'] == 'timeout' else "❌ FAILED")
                    f.write(f"    {audio_type}: {status}\n")
                    f.write(f"      URL: {audio_result['url']}\n")

    print(f"\n=== 최종 검증 결과 ===")
    print(f"완료 시간: {datetime.now()}")
    print(f"총 검증: {total_tested}개")
    print(f"성공: {total_success}개 ({total_success/total_tested*100:.1f}%)")
    print(f"실패: {total_failed}개 ({total_failed/total_tested*100:.1f}%)")
    print(f"타임아웃: {total_timeout}개 ({total_timeout/total_tested*100:.1f}%)")
    print(f"\n결과 파일 생성:")
    print(f"- gcs_audio_test_results_{timestamp}.json")
    print(f"- gcs_audio_test_summary_{timestamp}.txt")

if __name__ == "__main__":
    main()