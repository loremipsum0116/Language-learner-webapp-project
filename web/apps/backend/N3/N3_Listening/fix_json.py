#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import re

def fix_json_file():
    with open('N3_Listening.json', 'r', encoding='utf-8') as f:
        content = f.read()

    print(f"원본 파일 크기: {len(content)} 문자")

    # BOM 제거
    if content.startswith('\ufeff'):
        content = content[1:]
        print("BOM 제거됨")

    # JSON 파싱 시도
    try:
        data = json.loads(content)
        print(f"✅ JSON이 이미 정상입니다. {len(data)}개 항목")
        return
    except json.JSONDecodeError as e:
        print(f"❌ JSON 오류: {e}")
        print(f"라인 {e.lineno}, 컬럼 {e.colno}, 위치 {e.pos}")

    # 일반적인 JSON 오류 수정 시도
    fixes_made = []

    # 1. 중복 콤마 제거
    before_len = len(content)
    content = re.sub(r',\s*,', ',', content)
    if len(content) != before_len:
        fixes_made.append("중복 콤마 제거")

    # 2. 객체 사이 누락된 콤마 추가
    # } { 패턴을 }, { 로 변경
    before_len = len(content)
    content = re.sub(r'}\s*\n\s*{', '},\n        {', content)
    if len(content) != before_len:
        fixes_made.append("누락된 콤마 추가")

    # 3. 마지막 객체의 불필요한 콤마 제거
    content = re.sub(r',(\s*\])', r'\1', content)

    # 4. 따옴표 문제 수정
    # 잘못된 따옴표 패턴 찾기
    content = re.sub(r'([^\\])"([^",:}[\]]*)"([^:,}[\]])', r'\1"\2"\3', content)

    if fixes_made:
        print(f"수정 사항: {', '.join(fixes_made)}")

    # 다시 파싱 시도
    try:
        data = json.loads(content)
        print(f"✅ 수정 후 JSON 파싱 성공! {len(data)}개 항목")

        # 수정된 파일 저장
        with open('N3_Listening_fixed.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)

        print("✅ N3_Listening_fixed.json 파일로 저장되었습니다.")

        # 원본 파일 백업 후 교체
        import shutil
        shutil.copy('N3_Listening.json', 'N3_Listening_backup.json')
        shutil.copy('N3_Listening_fixed.json', 'N3_Listening.json')
        print("✅ 원본 파일이 수정되었습니다. (백업: N3_Listening_backup.json)")

    except json.JSONDecodeError as e:
        print(f"❌ 수정 후에도 JSON 오류가 남아있습니다: {e}")
        print("수동으로 확인이 필요합니다.")

        # 오류 위치 주변 컨텍스트 표시
        lines = content.split('\n')
        error_line = e.lineno - 1
        start_line = max(0, error_line - 5)
        end_line = min(len(lines), error_line + 6)

        print(f"\n오류 위치 컨텍스트 (라인 {start_line + 1}-{end_line}):")
        for i in range(start_line, end_line):
            prefix = ">>> " if i == error_line else "    "
            print(f"{prefix}{i+1:4d}: {lines[i]}")

if __name__ == "__main__":
    fix_json_file()