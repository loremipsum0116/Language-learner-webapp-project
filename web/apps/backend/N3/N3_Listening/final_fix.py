#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json

def final_fix():
    """최종 수정 - 이진 탐색으로 정확한 오류 위치 찾기"""

    with open('N3_Listening.json', 'r', encoding='utf-8') as f:
        content = f.read()

    print("=== 이진 탐색으로 오류 위치 찾기 ===")

    def test_json_segment(start, end):
        """특정 구간의 JSON이 유효한지 테스트"""
        segment = content[start:end]

        # 배열 시작/끝 추가
        if not segment.strip().startswith('['):
            segment = '[' + segment
        if not segment.strip().endswith(']'):
            # 마지막 완전한 객체 찾기
            last_brace = segment.rfind('}')
            if last_brace != -1:
                segment = segment[:last_brace+1] + ']'

        try:
            json.loads(segment)
            return True
        except:
            return False

    # 이진 탐색
    left, right = 0, len(content)
    error_start = 0

    while left < right:
        mid = (left + right) // 2

        if test_json_segment(0, mid):
            left = mid + 1
            error_start = mid
        else:
            right = mid

    print(f"오류 시작 위치: {error_start}")

    # 오류 위치 주변 확인
    lines_before = content[:error_start].count('\n')
    error_line = lines_before + 1

    print(f"오류 발생 라인 근처: {error_line}")

    # 해당 라인 주변 확인
    lines = content.split('\n')
    start_line = max(0, error_line - 5)
    end_line = min(len(lines), error_line + 5)

    print(f"\n오류 주변 컨텍스트 (라인 {start_line+1}-{end_line}):")
    for i in range(start_line, end_line):
        prefix = ">>> " if i == error_line - 1 else "    "
        print(f"{prefix}{i+1:4d}: {lines[i]}")

    # 특정 구간에서 JSON 파싱 시도
    error_segment = content[max(0, error_start-500):error_start+500]
    print(f"\n오류 구간 (500자 전후):")
    print(repr(error_segment))

    # 실제 JSON 파싱해서 정확한 오류 메시지 얻기
    try:
        json.loads(content)
    except json.JSONDecodeError as e:
        print(f"\n정확한 JSON 오류:")
        print(f"라인: {e.lineno}, 컬럼: {e.colno}")
        print(f"메시지: {e.msg}")
        print(f"위치: {e.pos}")

        # 해당 위치 주변 문자들
        if e.pos < len(content):
            start = max(0, e.pos - 50)
            end = min(len(content), e.pos + 50)
            context = content[start:end]
            print(f"오류 위치 컨텍스트:")
            print(repr(context))

            # 오류 위치 표시
            marker_pos = e.pos - start
            print("오류 위치 표시:")
            print(context[:marker_pos] + "<<<HERE>>>" + context[marker_pos:])

if __name__ == "__main__":
    final_fix()