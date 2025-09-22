#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import re

def fix_first_quarter():
    """첫 번째 1/4 구간의 문제를 찾아서 수정"""

    with open('N3_Listening.json', 'r', encoding='utf-8') as f:
        content = f.read()

    quarter = len(content) // 4
    first_quarter = content[:quarter]

    print("=== 첫 번째 1/4 구간 상세 분석 ===")

    # 따옴표 위치별 분석
    quote_positions = []
    for i, char in enumerate(first_quarter):
        if char == '"':
            quote_positions.append(i)

    print(f"따옴표 총 개수: {len(quote_positions)}")

    # 홀수 개수이므로 마지막 따옴표 확인
    if len(quote_positions) % 2 == 1:
        last_quote_pos = quote_positions[-1]
        print(f"마지막 따옴표 위치: {last_quote_pos}")
        print(f"마지막 따옴표 주변: {repr(first_quarter[last_quote_pos-50:last_quote_pos+50])}")

    # 중괄호 불일치 위치 찾기
    brace_count = 0
    problem_positions = []

    for i, char in enumerate(first_quarter):
        if char == '{':
            brace_count += 1
        elif char == '}':
            brace_count -= 1

        # 음수가 되면 } 가 더 많다는 의미
        if brace_count < 0:
            problem_positions.append(i)

    print(f"최종 중괄호 카운트: {brace_count}")
    print(f"중괄호 문제 위치: {problem_positions}")

    # 마지막 몇 줄 확인 (1/4 구간 끝)
    lines = first_quarter.split('\n')
    print(f"\n첫 번째 1/4 구간 마지막 10줄:")
    for i, line in enumerate(lines[-10:], len(lines)-9):
        print(f"{i:4d}: {line}")

    # 잠재적 수정 시도
    print(f"\n=== 자동 수정 시도 ===")

    fixed_content = first_quarter
    fixes_applied = []

    # 1. 끝에 누락된 } 추가 (brace_count > 0 이면)
    if brace_count > 0:
        # 마지막 완전한 객체 뒤에 } 추가
        lines = fixed_content.split('\n')

        # 마지막에서부터 "answer": 라인 찾기
        for i in range(len(lines)-1, -1, -1):
            if '"answer":' in lines[i]:
                # 이 라인 다음에 } 가 있는지 확인
                if i+1 < len(lines) and '}' not in lines[i+1]:
                    lines.insert(i+1, '        }')
                    fixes_applied.append(f"라인 {i+1} 뒤에 }} 추가")
                break

        fixed_content = '\n'.join(lines)

    # 2. 따옴표 문제 수정 시도
    # 홀수 개수의 따옴표가 있으면 마지막 부분 확인
    if len(quote_positions) % 2 == 1:
        # 마지막 따옴표가 문자열 끝에 제대로 있는지 확인
        last_quote = quote_positions[-1]
        context = fixed_content[last_quote-20:last_quote+20]
        print(f"마지막 따옴표 컨텍스트: {repr(context)}")

    # 수정된 내용으로 다시 검사
    if fixes_applied:
        print(f"적용된 수정사항: {fixes_applied}")

        # 수정된 내용 저장
        with open('N3_Listening_quarter1_fixed.json', 'w', encoding='utf-8') as f:
            f.write('[' + fixed_content)  # 배열 시작 추가

        print("quarter1 수정 파일이 생성되었습니다.")

    return fixed_content, fixes_applied

if __name__ == "__main__":
    fix_first_quarter()