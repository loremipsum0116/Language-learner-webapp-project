#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json

def check_quarter_json(quarter_num, start_pos, end_pos):
    """JSON 파일의 1/4 구간을 검사"""

    with open('N3_Listening.json', 'r', encoding='utf-8') as f:
        content = f.read()

    print(f"\n=== {quarter_num}/4 구간 검사 (위치 {start_pos} ~ {end_pos}) ===")

    # 해당 구간 추출
    quarter_content = content[start_pos:end_pos]

    print(f"구간 크기: {len(quarter_content)} 문자")
    print(f"시작 내용: {repr(quarter_content[:100])}")
    print(f"끝 내용: {repr(quarter_content[-100:])}")

    # 줄 번호 계산
    lines_before = content[:start_pos].count('\n')
    lines_in_quarter = quarter_content.count('\n')
    start_line = lines_before + 1
    end_line = start_line + lines_in_quarter

    print(f"줄 범위: {start_line} ~ {end_line}")

    # JSON 구조 분석
    open_braces = quarter_content.count('{')
    close_braces = quarter_content.count('}')
    open_brackets = quarter_content.count('[')
    close_brackets = quarter_content.count(']')
    quotes = quarter_content.count('"')
    commas = quarter_content.count(',')

    print(f"구조 분석:")
    print(f"  {{ 개수: {open_braces}")
    print(f"  }} 개수: {close_braces}")
    print(f"  [ 개수: {open_brackets}")
    print(f"  ] 개수: {close_brackets}")
    print(f"  \" 개수: {quotes}")
    print(f"  , 개수: {commas}")

    # 중괄호 불일치 검사
    if open_braces != close_braces:
        print(f"⚠️  중괄호 불일치: {{ {open_braces}개, }} {close_braces}개")

    # 대괄호 불일치 검사
    if open_brackets != close_brackets:
        print(f"⚠️  대괄호 불일치: [ {open_brackets}개, ] {close_brackets}개")

    # 따옴표 홀수 개수 검사
    if quotes % 2 != 0:
        print(f"⚠️  따옴표 홀수 개수: {quotes}개")

    # 이 구간에서 완전한 JSON 객체들 찾기
    objects = []
    brace_count = 0
    obj_start = -1

    for i, char in enumerate(quarter_content):
        if char == '{':
            if brace_count == 0:
                obj_start = i
            brace_count += 1
        elif char == '}':
            brace_count -= 1
            if brace_count == 0 and obj_start != -1:
                obj_content = quarter_content[obj_start:i+1]
                objects.append((obj_start + start_pos, obj_content))
                obj_start = -1

    print(f"완전한 객체 수: {len(objects)}")

    # 각 객체 JSON 파싱 테스트
    errors = []
    for pos, obj_content in objects[:5]:  # 처음 5개만 테스트
        try:
            json.loads(obj_content)
            print(f"✅ 위치 {pos}: JSON 파싱 성공")
        except json.JSONDecodeError as e:
            print(f"❌ 위치 {pos}: JSON 파싱 실패 - {e.msg}")
            errors.append((pos, e.msg, obj_content[:200]))

    # 패턴 분석
    print(f"\n패턴 분석:")

    # "id": 패턴 찾기
    import re
    id_patterns = re.findall(r'"id":\s*"N3_L_\d+"', quarter_content)
    print(f"ID 패턴 수: {len(id_patterns)}")
    if id_patterns:
        print(f"첫 번째 ID: {id_patterns[0]}")
        print(f"마지막 ID: {id_patterns[-1]}")

    # 잠재적 문제 패턴 찾기
    problem_patterns = [
        (r'}\s*{', '객체 사이 콤마 누락'),
        (r'"\s*\n\s*"', '따옴표 사이 개행'),
        (r'",\s*}', '마지막 필드 후 불필요한 콤마'),
        (r'{\s*"', '객체 시작'),
        (r'"\s*}', '객체 끝')
    ]

    for pattern, desc in problem_patterns:
        matches = re.findall(pattern, quarter_content)
        if matches:
            print(f"⚠️  {desc}: {len(matches)}개 발견")
            if desc == '객체 사이 콤마 누락' and matches:
                print(f"   예시: {matches[0]}")

    return errors

def main():
    # 파일 전체 크기 확인
    with open('N3_Listening.json', 'r', encoding='utf-8') as f:
        total_size = len(f.read())

    quarter = total_size // 4

    # 각 구간 검사
    quarters = [
        (1, 0, quarter),
        (2, quarter, quarter * 2),
        (3, quarter * 2, quarter * 3),
        (4, quarter * 3, total_size)
    ]

    all_errors = []

    for quarter_num, start, end in quarters:
        errors = check_quarter_json(quarter_num, start, end)
        all_errors.extend(errors)

    print(f"\n=== 전체 요약 ===")
    print(f"총 오류 수: {len(all_errors)}")

    if all_errors:
        print(f"\n주요 오류들:")
        for i, (pos, msg, content) in enumerate(all_errors[:10]):
            print(f"{i+1}. 위치 {pos}: {msg}")
            print(f"   내용: {content}...")

if __name__ == "__main__":
    main()