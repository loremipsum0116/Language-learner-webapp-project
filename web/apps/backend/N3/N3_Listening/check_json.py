#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import sys

def check_json_file(filename):
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()

        # JSON 파싱 시도
        data = json.loads(content)
        print(f"✅ JSON 파일이 정상입니다. 총 {len(data)}개 항목")

    except json.JSONDecodeError as e:
        print(f"❌ JSON 오류 발견:")
        print(f"   라인: {e.lineno}")
        print(f"   컬럼: {e.colno}")
        print(f"   위치: {e.pos}")
        print(f"   메시지: {e.msg}")

        # 오류 위치 주변 컨텍스트 표시
        lines = content.split('\n')
        error_line = e.lineno - 1
        start_line = max(0, error_line - 3)
        end_line = min(len(lines), error_line + 4)

        print(f"\n컨텍스트 (라인 {start_line + 1}-{end_line}):")
        for i in range(start_line, end_line):
            prefix = ">>> " if i == error_line else "    "
            print(f"{prefix}{i+1:4d}: {lines[i]}")

        return False

    except Exception as e:
        print(f"❌ 기타 오류: {e}")
        return False

    return True

if __name__ == "__main__":
    filename = "N3_Listening.json"
    check_json_file(filename)