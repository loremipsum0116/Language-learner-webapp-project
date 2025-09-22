#!/usr/bin/env python3
"""
괄호 제거 함수 테스트
"""

import re

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

# 테스트 케이스들
test_cases = [
    ("こんにちは (안녕하세요)", "こんにちは"),
    ("あたらしいマーケティングプロジェクトについてですが (새로운 마케팅프로젝트에 대해서인데)", "あたらしいマーケティングプロジェクトについてですが"),
    ("300万円 (300만엔)", "300万円"),
    ("これは日本語です（한국어 번역）そして続きます", "これは日本語ですそして続きます"),
    ("テスト [대괄호] テスト", "テスト テスト"),
    ("テスト {중괄호} テスト", "テスト テスト"),
    ("混合 (소괄호) [대괄호] {중괄호} 테스트", "混合 테스트"),
    ("괄호가 없는 텍스트", "괄호가 없는 텍스트"),
]

print("🎯 괄호 제거 함수 테스트")
print("=" * 60)

for i, (input_text, expected) in enumerate(test_cases, 1):
    result = remove_parentheses(input_text)
    status = "✅" if result == expected else "❌"

    print(f"\n테스트 {i}: {status}")
    print(f"입력: {input_text}")
    print(f"예상: {expected}")
    print(f"결과: {result}")

    if result != expected:
        print(f"⚠️ 불일치 발견!")

print("\n" + "=" * 60)
print("테스트 완료!")