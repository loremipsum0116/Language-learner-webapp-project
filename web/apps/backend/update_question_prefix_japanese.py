#!/usr/bin/env python3
"""
N1-N5의 모든 make_jlpt_audio.py 파일에서
영어 질문 프리픽스를 일본어로 변경
"""

import os
import re

def update_question_prefix(file_path):
    """질문 프리픽스를 일본어로 변경"""

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 이미 수정되었는지 확인
    if 'もんだいばんごういち' in content or '問題番号1' in content:
        print(f"  ⏭️  이미 수정됨: {file_path}")
        return False

    # 단일 질문 프리픽스 변경: "Question number one." -> "もんだいばんごういち。"
    content = re.sub(
        r'default="Question number one\."',
        r'default="もんだいばんごういち。"',
        content
    )

    # 다수 질문 프리픽스 포맷 변경: "Question number {n}." -> "もんだいばんごう{n}。"
    content = re.sub(
        r'default="Question number \{n\}\."',
        r'default="もんだいばんごう{n}。"',
        content
    )

    # 일본어 숫자 변환 함수 추가 (synthesize 함수 앞에)
    if 'def japanese_number' not in content:
        japanese_number_func = '''
def japanese_number(n: int) -> str:
    """숫자를 일본어로 변환
    1 -> いち, 2 -> に, 3 -> さん, ..."""
    japanese_nums = {
        1: "いち", 2: "に", 3: "さん", 4: "よん", 5: "ご",
        6: "ろく", 7: "なな", 8: "はち", 9: "きゅう", 10: "じゅう",
        11: "じゅういち", 12: "じゅうに", 13: "じゅうさん", 14: "じゅうよん", 15: "じゅうご",
        16: "じゅうろく", 17: "じゅうなな", 18: "じゅうはち", 19: "じゅうきゅう", 20: "にじゅう"
    }
    if n in japanese_nums:
        return japanese_nums[n]
    else:
        # 21以上은 기본적으로 "にじゅういち" 형태로 구성
        if n <= 99:
            tens = n // 10
            ones = n % 10
            tens_word = japanese_nums.get(tens, str(tens)) + "じゅう" if tens > 1 else "じゅう"
            if ones == 0:
                return tens_word.replace("いちじゅう", "じゅう")
            ones_word = japanese_nums.get(ones, str(ones))
            return tens_word + ones_word
        else:
            return str(n)  # 100 이상은 그대로 숫자 사용

'''
        # synthesize 함수 찾기
        synthesize_pos = content.find('def synthesize(')
        if synthesize_pos > 0:
            # synthesize 함수 바로 앞에 japanese_number 함수 추가
            content = content[:synthesize_pos] + japanese_number_func + content[synthesize_pos:]

    # format 사용 부분을 찾아서 수정
    # args.prefix_format.format(n=i) 부분을 찾아서 일본어 숫자로 변환하도록 수정

    # 단일 질문의 경우 처리 (もんだいばんごういち를 사용)
    # 이미 제대로 되어 있음

    # 다수 질문의 경우 처리
    # args.prefix_format.format(n=i) -> args.prefix_format.format(n=japanese_number(i))
    content = re.sub(
        r'args\.prefix_format\.format\(n=i\)',
        r'args.prefix_format.replace("{n}", japanese_number(i))',
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

    print("🎯 make_jlpt_audio.py 질문 프리픽스를 일본어로 업데이트")
    print("=" * 50)

    updated_count = 0
    for level in levels:
        file_path = os.path.join(base_dir, level, f"{level}_Listening", "make_jlpt_audio.py")

        if os.path.exists(file_path):
            print(f"\n📁 {level} 처리 중...")
            if update_question_prefix(file_path):
                updated_count += 1
        else:
            print(f"\n❌ 파일을 찾을 수 없음: {file_path}")

    print("\n" + "=" * 50)
    print(f"✅ 작업 완료: {updated_count}개 파일 업데이트됨")

if __name__ == "__main__":
    main()