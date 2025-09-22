#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json

def find_exact_json_error():
    """정확한 JSON 오류 위치를 찾아내기"""

    with open('N3_Listening.json', 'r', encoding='utf-8') as f:
        content = f.read()

    print("=== 정확한 JSON 오류 찾기 ===")

    # 줄별로 누적해서 JSON 파싱 시도
    lines = content.split('\n')
    accumulated = ""

    for i, line in enumerate(lines):
        accumulated += line + '\n'

        # 50줄마다 체크
        if (i + 1) % 50 == 0 or i == len(lines) - 1:
            # 임시로 JSON 완성
            temp_content = accumulated.strip()

            # 배열과 객체를 임시로 닫기
            if not temp_content.endswith(']'):
                # 마지막 완전한 객체를 찾아서 배열 닫기
                last_complete_obj = temp_content.rfind('}')
                if last_complete_obj != -1:
                    # 해당 위치 뒤에 배열 닫기 추가
                    temp_content = temp_content[:last_complete_obj+1] + '\n]'

            try:
                json.loads(temp_content)
                # print(f"✅ 라인 {i+1}까지 정상")
            except json.JSONDecodeError as e:
                print(f"❌ 라인 {i+1}에서 첫 번째 오류 발생!")
                print(f"   오류: {e.msg}")
                print(f"   JSON 오류 라인: {e.lineno}")
                print(f"   JSON 오류 컬럼: {e.colno}")

                # 실제 파일에서 해당 라인 찾기
                actual_line = i + 1 - 50 + e.lineno
                print(f"   실제 파일 라인: {actual_line}")

                # 주변 컨텍스트 표시
                start = max(0, actual_line - 5)
                end = min(len(lines), actual_line + 5)

                print(f"\n문제 위치 주변 (라인 {start+1}-{end}):")
                for j in range(start, end):
                    prefix = ">>> " if j == actual_line - 1 else "    "
                    print(f"{prefix}{j+1:4d}: {lines[j]}")

                # 해당 라인의 문자 단위 분석
                problem_line = lines[actual_line - 1] if actual_line <= len(lines) else ""
                print(f"\n문제 라인 상세:")
                print(f"라인 내용: {repr(problem_line)}")
                print(f"라인 길이: {len(problem_line)}")

                return actual_line, e.msg, problem_line

    print("✅ 모든 라인 검사 완료 - 오류를 찾지 못했습니다.")
    return None, None, None

def analyze_specific_line(line_num):
    """특정 라인 주변을 상세 분석"""

    with open('N3_Listening.json', 'r', encoding='utf-8') as f:
        lines = f.readlines()

    print(f"\n=== 라인 {line_num} 상세 분석 ===")

    if line_num > len(lines):
        print("라인 번호가 파일 범위를 벗어났습니다.")
        return

    target_line = lines[line_num - 1].rstrip('\n')
    print(f"대상 라인: {target_line}")

    # 따옴표 개수 확인
    quote_count = target_line.count('"')
    print(f"따옴표 개수: {quote_count}")

    if quote_count % 2 != 0:
        print("⚠️  따옴표 개수가 홀수입니다!")

        # 따옴표 위치 표시
        positions = []
        for i, char in enumerate(target_line):
            if char == '"':
                positions.append(i)

        print(f"따옴표 위치: {positions}")

        # 각 따옴표 주변 확인
        for i, pos in enumerate(positions):
            context = target_line[max(0, pos-10):pos+10]
            print(f"  {i+1}번째 따옴표: {repr(context)}")

    # JSON 필드 패턴 확인
    import re
    json_patterns = [
        r'"id":\s*"[^"]*"',
        r'"topic":\s*"[^"]*"',
        r'"script":\s*".*"',
        r'"question":\s*"[^"]*"',
        r'"answer":\s*"[^"]*"'
    ]

    for pattern in json_patterns:
        if re.search(pattern, target_line):
            print(f"✅ 패턴 매치: {pattern}")

if __name__ == "__main__":
    error_line, error_msg, problem_content = find_exact_json_error()

    if error_line:
        analyze_specific_line(error_line)