#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json

def find_json_error():
    with open('N3_Listening.json', 'r', encoding='utf-8') as f:
        content = f.read()

    # 전체 길이
    total_length = len(content)
    print(f"전체 파일 길이: {total_length} 문자")

    # 이진 탐색으로 오류 위치 찾기
    left, right = 0, total_length
    last_good_pos = 0

    while left < right:
        mid = (left + right) // 2

        # 가장 가까운 완전한 JSON 객체 끝까지 자르기
        test_content = content[:mid]

        # 마지막 }]를 찾아서 거기까지만 자르기
        last_bracket = test_content.rfind('}')
        if last_bracket == -1:
            left = mid + 1
            continue

        # } 다음의 ] 찾기
        closing_bracket = test_content.find(']', last_bracket)
        if closing_bracket == -1:
            # ]가 없으면 }] 패턴으로 완성
            test_content = test_content[:last_bracket+1] + ']'
        else:
            test_content = test_content[:closing_bracket+1]

        try:
            json.loads(test_content)
            last_good_pos = mid
            left = mid + 1
            print(f"✅ 위치 {mid}까지는 정상")
        except json.JSONDecodeError as e:
            right = mid
            print(f"❌ 위치 {mid}에서 오류: {e.msg}")

    print(f"\n마지막 정상 위치: {last_good_pos}")

    # 오류 발생 지점 확인
    error_start = last_good_pos
    for i in range(error_start, min(error_start + 1000, total_length)):
        try:
            test_content = content[:i]
            # 임시로 닫기
            if not test_content.strip().endswith(']'):
                # 마지막 }, 찾아서 ] 추가
                last_brace = test_content.rfind('}')
                if last_brace != -1:
                    test_content = test_content[:last_brace+1] + ']'

            json.loads(test_content)
        except json.JSONDecodeError as e:
            print(f"\n첫 번째 오류 위치: {i}")
            print(f"오류 메시지: {e.msg}")

            # 주변 컨텍스트 표시
            lines = content.split('\n')
            char_count = 0
            for line_num, line in enumerate(lines):
                if char_count + len(line) >= i:
                    print(f"\n오류 라인 {line_num + 1}:")
                    start_line = max(0, line_num - 3)
                    end_line = min(len(lines), line_num + 4)
                    for j in range(start_line, end_line):
                        prefix = ">>> " if j == line_num else "    "
                        print(f"{prefix}{j+1:4d}: {lines[j]}")
                    break
                char_count += len(line) + 1  # +1 for newline
            break

if __name__ == "__main__":
    find_json_error()