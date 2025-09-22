#!/usr/bin/env python3
"""
N1-N5의 모든 make_jlpt_audio.py 파일에서
Q voice(질문/해설)를 Aoede에서 Kore로 변경
"""

import os
import re

def replace_aoede_with_kore(file_path):
    """Aoede voice를 Kore voice로 변경"""

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 이미 수정되었는지 확인
    if 'Chirp3-HD-Kore' in content:
        print(f"  ⏭️  이미 수정됨: {file_path}")
        return False

    # Aoede를 Kore로 변경
    original_content = content
    content = re.sub(
        r'Chirp3-HD-Aoede',
        r'Chirp3-HD-Kore',
        content
    )

    # 변경사항이 있는지 확인
    if content == original_content:
        print(f"  ⚠️  Aoede voice를 찾을 수 없음: {file_path}")
        return False

    # 파일 저장
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"  ✅ 수정 완료: Aoede → Kore")
    return True

def main():
    base_dir = r"C:\Users\sst70\OneDrive\바탕 화면\Language-learner\web\apps\backend"

    # N1-N5 폴더들
    levels = ['N1', 'N2', 'N3', 'N4', 'N5']

    print("🎯 Q voice(질문/해설)를 Aoede에서 Kore로 변경")
    print("=" * 50)

    updated_count = 0
    for level in levels:
        file_path = os.path.join(base_dir, level, f"{level}_Listening", "make_jlpt_audio.py")

        if os.path.exists(file_path):
            print(f"\n📁 {level} 처리 중...")
            if replace_aoede_with_kore(file_path):
                updated_count += 1
        else:
            print(f"\n❌ 파일을 찾을 수 없음: {file_path}")

    print("\n" + "=" * 50)
    print(f"✅ 작업 완료: {updated_count}개 파일 업데이트됨")

if __name__ == "__main__":
    main()