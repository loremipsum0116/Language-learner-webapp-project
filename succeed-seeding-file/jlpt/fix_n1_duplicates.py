#!/usr/bin/env python3
"""
N1.json 파일의 중복된 romaji를 처리하여 N1_fixed.json을 생성하는 스크립트
N2, N3, N4, N5와 동일한 방식으로 처리
"""

import json
from collections import defaultdict
import sys

def fix_duplicates_in_json(input_file, output_file):
    """JSON 파일의 중복된 romaji를 수정하여 새 파일로 저장"""

    print(f"📂 Reading {input_file}...")

    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"❌ Error: {input_file} not found!")
        return False
    except json.JSONDecodeError as e:
        print(f"❌ Error: Invalid JSON in {input_file}: {e}")
        return False

    print(f"📊 Total items: {len(data)}")

    # 중복 romaji 찾기
    romaji_counts = defaultdict(list)
    for i, item in enumerate(data):
        romaji = item.get('romaji', '')
        if romaji:
            romaji_counts[romaji].append(i)

    # 중복 그룹 찾기
    duplicate_groups = {romaji: indices for romaji, indices in romaji_counts.items() if len(indices) > 1}

    if duplicate_groups:
        print(f"🔍 Found {len(duplicate_groups)} duplicate romaji groups with {sum(len(indices) for indices in duplicate_groups.values())} total items")

        # 중복 상세 정보 출력
        total_duplicates = 0
        for romaji, indices in duplicate_groups.items():
            print(f"  • {romaji}: {len(indices)} items")
            total_duplicates += len(indices)

        print(f"📈 Total duplicated items: {total_duplicates}")
        print(f"📉 Unique items after fixing: {len(data)}")

        # 중복 해결: 순차적 접미사 추가
        for romaji, indices in duplicate_groups.items():
            for i, idx in enumerate(indices):
                if i == 0:
                    # 첫 번째는 원본 유지
                    continue
                else:
                    # 두 번째부터 접미사 추가
                    new_romaji = f"{romaji}{i+1}"
                    data[idx]['romaji'] = new_romaji

                    # audio 경로도 수정
                    if 'audio' in data[idx]:
                        audio = data[idx]['audio']
                        old_path_prefix = f"jlpt/n1/{romaji}/"
                        new_path_prefix = f"jlpt/n1/{new_romaji}/"

                        for key in ['word', 'gloss', 'example']:
                            if key in audio and audio[key].startswith(old_path_prefix):
                                audio[key] = audio[key].replace(old_path_prefix, new_path_prefix)

        print("✅ Duplicates fixed!")
    else:
        print("✅ No duplicates found!")

    # 수정된 데이터 저장
    print(f"💾 Writing {output_file}...")
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        print(f"✅ Successfully created {output_file}")
        return True
    except Exception as e:
        print(f"❌ Error writing {output_file}: {e}")
        return False

def generate_duplicate_report(input_file, report_file):
    """중복 항목의 상세 보고서 생성"""

    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except:
        print(f"❌ Could not read {input_file} for report generation")
        return

    # 중복 romaji 찾기
    romaji_counts = defaultdict(list)
    for item in data:
        romaji = item.get('romaji', '')
        if romaji:
            romaji_counts[romaji].append(item)

    # 중복 그룹 찾기
    duplicate_groups = {romaji: items for romaji, items in romaji_counts.items() if len(items) > 1}

    if not duplicate_groups:
        print("📝 No duplicates found for report")
        return

    # 보고서 작성
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write("=================================================================\n")
        f.write("                N1 JLPT 중복 romaji 상세 보고서\n")
        f.write("=================================================================\n\n")
        f.write(f"📅 생성일: 2025년 9월 22일\n")
        f.write(f"📊 총 중복 그룹: {len(duplicate_groups)}개\n")
        f.write(f"📈 총 중복 항목: {sum(len(items) for items in duplicate_groups.values())}개\n\n")

        for romaji, items in sorted(duplicate_groups.items()):
            f.write(f"🔤 romaji: {romaji} ({len(items)}개)\n")
            for i, item in enumerate(items):
                f.write(f"  {i+1}. {item.get('lemma', 'N/A')} ({item.get('kana', 'N/A')}) - {item.get('koGloss', 'N/A')}\n")
            f.write("\n")

    print(f"📝 Duplicate report saved to {report_file}")

def main():
    input_file = "N1.json"
    output_file = "N1_fixed.json"
    report_file = "n1_duplicated.txt"

    print("🎯 N1 JLPT 중복 romaji 수정 스크립트")
    print("=" * 50)

    # 중복 보고서 생성
    generate_duplicate_report(input_file, report_file)

    # 중복 수정된 JSON 파일 생성
    success = fix_duplicates_in_json(input_file, output_file)

    if success:
        print("\n🎉 All tasks completed successfully!")
        print(f"📁 Created files:")
        print(f"  • {output_file} - Fixed JSON with unique romaji")
        print(f"  • {report_file} - Detailed duplicate report")
    else:
        print("\n❌ Task failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()