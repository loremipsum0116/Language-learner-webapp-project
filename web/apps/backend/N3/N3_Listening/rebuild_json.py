#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import re

def rebuild_json():
    """JSON 파일을 완전히 새로 구성"""

    with open('N3_Listening.json', 'r', encoding='utf-8') as f:
        content = f.read()

    print(f"원본 파일 크기: {len(content)} 문자")

    # 정규식으로 각 객체 추출
    # "id": "N3_L_XXX" 패턴을 시작으로 다음 패턴까지 추출
    pattern = r'\{\s*"id":\s*"N3_L_\d+",.*?\}'

    matches = re.findall(pattern, content, re.DOTALL)
    print(f"정규식으로 찾은 객체 수: {len(matches)}")

    # 각 객체를 JSON으로 파싱해서 검증
    valid_objects = []

    for i, match in enumerate(matches):
        try:
            obj = json.loads(match)
            valid_objects.append(obj)
            if i < 5:  # 처음 5개만 출력
                print(f"✅ 객체 {i+1}: {obj.get('id', 'NO_ID')}")
        except json.JSONDecodeError as e:
            print(f"❌ 객체 {i+1} 파싱 실패: {e}")
            print(f"   내용: {match[:100]}...")

    print(f"유효한 객체 수: {len(valid_objects)}")

    if valid_objects:
        # 새 JSON 파일 생성
        with open('N3_Listening_rebuilt.json', 'w', encoding='utf-8') as f:
            json.dump(valid_objects, f, ensure_ascii=False, indent=4)

        print("✅ N3_Listening_rebuilt.json 파일이 생성되었습니다.")

        # 검증
        with open('N3_Listening_rebuilt.json', 'r', encoding='utf-8') as f:
            test_data = json.load(f)

        print(f"✅ 새 파일 검증 완료: {len(test_data)}개 객체")

        # 원본 백업 후 교체
        import shutil
        shutil.copy('N3_Listening.json', 'N3_Listening_original.json')
        shutil.copy('N3_Listening_rebuilt.json', 'N3_Listening.json')
        print("✅ 원본 파일이 교체되었습니다. (백업: N3_Listening_original.json)")

    else:
        print("❌ 유효한 객체를 찾을 수 없습니다.")

if __name__ == "__main__":
    rebuild_json()