#!/usr/bin/env python3
"""
N2_Listening.json에서 id와 script(passage)를 추출하여 txt 파일로 저장
"""

import json
import os

def extract_passages_and_ids():
    """JSON 파일에서 id와 script를 추출하여 txt 파일로 저장"""

    input_file = "N2_Listening.json"
    output_file = "N2_Listening_passages.txt"

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

    print(f"📊 Total items found: {len(data)}")

    # 추출된 데이터를 저장할 리스트
    extracted_data = []

    for item in data:
        item_id = item.get('id', 'NO_ID')
        script = item.get('script', 'NO_SCRIPT')
        topic = item.get('topic', 'NO_TOPIC')

        extracted_data.append({
            'id': item_id,
            'topic': topic,
            'script': script
        })

    # txt 파일로 저장
    print(f"💾 Writing to {output_file}...")

    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("=" * 80 + "\n")
            f.write("N2 JLPT Listening - ID and Passages\n")
            f.write("=" * 80 + "\n\n")

            for i, item in enumerate(extracted_data, 1):
                f.write(f"[{i:03d}] ID: {item['id']}\n")
                f.write(f"Topic: {item['topic']}\n")
                f.write(f"Script: {item['script']}\n")
                f.write("-" * 80 + "\n\n")

        print(f"✅ Successfully created {output_file}")
        print(f"📝 Extracted {len(extracted_data)} passages")
        return True

    except Exception as e:
        print(f"❌ Error writing {output_file}: {e}")
        return False

def main():
    print("🎯 N2 Listening JSON Passage Extractor")
    print("=" * 50)

    success = extract_passages_and_ids()

    if success:
        print("\n🎉 Extraction completed successfully!")
    else:
        print("\n❌ Extraction failed!")

if __name__ == "__main__":
    main()