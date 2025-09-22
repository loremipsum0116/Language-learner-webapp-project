#!/usr/bin/env python3
"""
N1-N5의 모든 make_jlpt_audio.py 파일을 수정하여
괄호 및 괄호 내부 텍스트를 제거하는 기능을 추가합니다.
"""

import os
import re

def update_make_jlpt_audio(file_path):
    """make_jlpt_audio.py 파일을 수정하여 괄호 제거 함수 추가"""

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 이미 수정되었는지 확인
    if 'remove_parentheses' in content:
        print(f"  ⏭️  이미 수정됨: {file_path}")
        return False

    # sanitize_filename 함수 다음에 remove_parentheses 함수 추가
    insert_position = content.find('def sanitize_filename')
    if insert_position == -1:
        print(f"  ❌ sanitize_filename 함수를 찾을 수 없음: {file_path}")
        return False

    # sanitize_filename 함수의 끝 찾기
    next_def_position = content.find('\ndef ', insert_position + 1)
    if next_def_position == -1:
        next_def_position = len(content)

    # 새로운 함수 추가
    new_function = '''

def remove_parentheses(text: str) -> str:
    """괄호(소괄호, 중괄호, 대괄호 포함) 및 그 내부 텍스트 제거
    예: "こんにちは (안녕하세요)" -> "こんにちは"
    """
    if not text:
        return text
    # 모든 종류의 괄호와 내부 내용 제거 (소괄호, 대괄호, 중괄호)
    # 중첩된 괄호도 처리
    result = re.sub(r'[（(][^）)]*[）)]', '', text)  # 전각/반각 소괄호
    result = re.sub(r'[［\[][^］\]]*[］\]]', '', result)  # 전각/반각 대괄호
    result = re.sub(r'[｛\{][^｝\}]*[｝\}]', '', result)  # 전각/반각 중괄호
    # 여러 공백을 하나로 정리
    result = re.sub(r'\s+', ' ', result)
    return result.strip()
'''

    # 함수를 적절한 위치에 삽입
    content = content[:next_def_position] + new_function + content[next_def_position:]

    # synthesize 함수 수정 - 텍스트 전처리 추가
    synthesize_pattern = r'(def synthesize\([^)]+\)[^:]*:\s*\n(?:[^\n]*\n)*?)(\s+if not text:)'

    def synthesize_replacement(match):
        func_header = match.group(1)
        rest = match.group(2)
        return func_header + '    # 괄호 및 괄호 내부 텍스트 제거\n    text = remove_parentheses(text)\n' + rest

    content = re.sub(synthesize_pattern, synthesize_replacement, content)

    # parse_script_ordered 함수에서도 텍스트 처리 추가
    # "text = tokens[i + 1].strip()" 부분을 찾아서 수정
    content = re.sub(
        r'(text = tokens\[i \+ 1\]\.strip\(\))',
        r'\1\n        text = remove_parentheses(text)',
        content
    )

    # "return [("A", s)]" 부분도 수정 (나레이션 처리)
    content = re.sub(
        r'(return \[\("A", s\)\])',
        r'return [("A", remove_parentheses(s))]',
        content
    )

    # normalize_questions 함수에서도 처리 추가
    # "return [s] if s else []" 부분 수정
    content = re.sub(
        r'(return \[s\] if s else \[\])',
        r'return [remove_parentheses(s)] if s else []',
        content
    )

    # 리스트 comprehension에서도 처리
    content = re.sub(
        r'(return \[str\(x\)\.strip\(\) for x in .+ if str\(x\)\.strip\(\)\])',
        lambda m: m.group(1).replace('str(x).strip()', 'remove_parentheses(str(x).strip())'),
        content
    )

    # _pairs_from_dict 함수의 txt 처리
    content = re.sub(
        r'(txt = str\(v\)\.strip\(\))',
        r'txt = remove_parentheses(str(v).strip())',
        content
    )

    # 파일 저장
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"  ✅ 수정 완료: {file_path}")
    return True

def main():
    base_dir = r"C:\Users\sst70\OneDrive\바탕 화면\Language-learner\web\apps\backend"

    # N1-N5 폴더들
    levels = ['N1', 'N2', 'N3', 'N4', 'N5']

    print("🎯 make_jlpt_audio.py 파일 업데이트 시작")
    print("=" * 50)

    updated_count = 0
    for level in levels:
        file_path = os.path.join(base_dir, level, f"{level}_Listening", "make_jlpt_audio.py")

        if os.path.exists(file_path):
            print(f"\n📁 {level} 처리 중...")
            if update_make_jlpt_audio(file_path):
                updated_count += 1
        else:
            print(f"\n❌ 파일을 찾을 수 없음: {file_path}")

    print("\n" + "=" * 50)
    print(f"✅ 작업 완료: {updated_count}개 파일 업데이트됨")

if __name__ == "__main__":
    main()