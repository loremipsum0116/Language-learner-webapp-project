#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import os
from collections import defaultdict

def fix_n2_duplicates():
    """N2.json의 중복 romaji를 처리하여 N2_fixed.json을 생성"""

    input_file = "N2.json"
    output_file = "N2_fixed.json"
    duplicate_report = "n2_duplicated.txt"

    # JSON 파일 읽기
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print(f"원본 항목 수: {len(data)}")

    # romaji별 항목 그룹화
    romaji_groups = defaultdict(list)
    for i, item in enumerate(data):
        romaji = item.get('romaji', '').strip()
        if romaji:
            romaji_groups[romaji].append((i, item))

    # 중복 그룹 찾기
    duplicates = {romaji: items for romaji, items in romaji_groups.items() if len(items) > 1}

    print(f"중복 그룹 수: {len(duplicates)}")

    total_duplicate_items = sum(len(items) for items in duplicates.values())
    print(f"중복 항목 수: {total_duplicate_items}")

    # 중복 보고서 생성
    with open(duplicate_report, 'w', encoding='utf-8') as f:
        f.write("=============================================================\n")
        f.write("                 N2 레벨 중복 romaji 보고서\n")
        f.write("=============================================================\n\n")
        f.write(f"총 항목 수: {len(data)}\n")
        f.write(f"중복 그룹 수: {len(duplicates)}\n")
        f.write(f"중복 항목 수: {total_duplicate_items}\n")
        f.write(f"고유 항목 수: {len(data) - (total_duplicate_items - len(duplicates))}\n\n")

        f.write("중복 상세 목록:\n")
        f.write("=" * 60 + "\n\n")

        for romaji, items in sorted(duplicates.items()):
            f.write(f"🔄 {romaji} ({len(items)}개)\n")
            for idx, (original_idx, item) in enumerate(items):
                lemma = item.get('lemma', 'N/A')
                kana = item.get('kana', 'N/A')
                pos = item.get('pos', 'N/A')
                gloss = item.get('koGloss', 'N/A')
                f.write(f"   {idx+1}. {lemma} ({kana}) - {pos} - {gloss}\n")
            f.write("\n")

    # 중복 처리 및 수정된 데이터 생성
    fixed_data = []
    romaji_counters = defaultdict(int)

    for item in data:
        original_romaji = item.get('romaji', '').strip()
        if not original_romaji:
            fixed_data.append(item)
            continue

        # 카운터 증가
        romaji_counters[original_romaji] += 1
        current_count = romaji_counters[original_romaji]

        # 새 항목 생성 (딥카피)
        new_item = json.loads(json.dumps(item))

        # 첫 번째 항목이 아니면 접미사 추가
        if current_count > 1:
            new_romaji = f"{original_romaji}{current_count}"
            new_item['romaji'] = new_romaji

            # audio 경로도 수정
            if 'audio' in new_item and isinstance(new_item['audio'], dict):
                for audio_type, path in new_item['audio'].items():
                    if path and isinstance(path, str):
                        # jlpt/n2/romaji/ -> jlpt/n2/romaji2/
                        old_path_part = f"jlpt/n2/{original_romaji}/"
                        new_path_part = f"jlpt/n2/{new_romaji}/"
                        new_item['audio'][audio_type] = path.replace(old_path_part, new_path_part)

        fixed_data.append(new_item)

    # 수정된 데이터 저장
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(fixed_data, f, ensure_ascii=False, indent=4)

    print(f"\n✅ 작업 완료!")
    print(f"📄 수정된 파일: {output_file}")
    print(f"📊 중복 보고서: {duplicate_report}")
    print(f"📈 최종 항목 수: {len(fixed_data)} (중복 해결된 고유 romaji)")

    # 고유 romaji 검증
    unique_romaji = set()
    for item in fixed_data:
        romaji = item.get('romaji', '').strip()
        if romaji:
            unique_romaji.add(romaji)

    print(f"🔍 고유 romaji 수: {len(unique_romaji)}")

    if len(unique_romaji) == len(fixed_data):
        print("✅ 모든 romaji가 고유합니다!")
    else:
        print("⚠️ 아직 중복이 남아있을 수 있습니다.")

if __name__ == "__main__":
    try:
        fix_n2_duplicates()
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()