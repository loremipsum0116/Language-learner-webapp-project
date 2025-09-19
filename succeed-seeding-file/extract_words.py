import json

# 입력 JSON 파일과 출력 텍스트 파일의 이름을 지정합니다.
input_filename = "n1_pure.json"
output_filename = "N1_vocabs.txt"
omitted_filename = "omitted.txt" # 누락된 항목을 기록할 파일

try:
    # 'n1_pure.json' 파일을 읽기 모드('r')와 UTF-8 인코딩으로 엽니다.
    with open(input_filename, 'r', encoding='utf-8') as f:
        # JSON 파일을 읽어서 파이썬 리스트 객체로 변환합니다.
        data = json.load(f)

    # 결과를 저장할 리스트 초기화
    valid_words = []
    omitted_items = []

    # JSON 데이터의 각 항목을 반복하며 단어 추출 및 누락 확인
    for item in data:
        # 'word' 키의 값을 가져옵니다. get()은 키가 없으면 None을 반환합니다.
        word = item.get('word')

        # 'word' 키가 있고, 그 값이 비어있지 않은 경우
        if word:
            valid_words.append(word)
        # 'word' 키가 없거나, 값이 비어있는 경우
        else:
            omitted_items.append(item)

    # 추출된 단어들을 N1_vocabs.txt 파일에 씁니다.
    with open(output_filename, 'w', encoding='utf-8') as f:
        for word in valid_words:
            f.write(f"{word}\n")

    print(f"총 {len(valid_words)}개의 단어를 '{output_filename}' 파일에 성공적으로 저장했습니다.")

    # 누락된 항목이 있는 경우 omitted.txt 파일에 기록합니다.
    if omitted_items:
        with open(omitted_filename, 'w', encoding='utf-8') as f:
            f.write("다음 항목들에서 'word' 키가 없거나 값이 비어있습니다:\n")
            for item in omitted_items:
                # 누락된 항목(dict)을 JSON 문자열로 변환하여 파일에 씁니다.
                # ensure_ascii=False는 한글 등 유니코드 문자가 깨지지 않게 합니다.
                f.write(json.dumps(item, ensure_ascii=False) + "\n")
        print(f"{len(omitted_items)}개의 누락된 항목을 '{omitted_filename}' 파일에 기록했습니다.")

# 파일을 찾을 수 없을 때 발생하는 오류 처리
except FileNotFoundError:
    print(f"오류: '{input_filename}' 파일을 찾을 수 없습니다. 스크립트와 동일한 폴더에 파일이 있는지 확인해주세요.")
# JSON 파일 내용이 잘못되었을 때 발생하는 오류 처리
except json.JSONDecodeError:
    print(f"오류: '{input_filename}' 파일의 JSON 형식이 올바르지 않습니다.")
# 파일을 읽거나 쓰는 과정에서 문제가 생겼을 때의 오류 처리
except IOError as e:
    print(f"오류: 파일을 읽거나 쓰는 중 문제가 발생했습니다. {e}")

