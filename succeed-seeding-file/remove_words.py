# -*- coding: utf-8 -*-
import re

def filter_words_and_save(target_file, source_file_for_removal, output_file):
    """
    target_file에서 source_file_for_removal에 존재하는 단어들을 제외하고 
    결과를 output_file에 저장합니다.

    :param target_file: 필터링할 대상 파일 경로 (예: "N2words.txt")
    :param source_file_for_removal: 제거할 단어 목록 파일 경로 (예: "words_to_remove.txt")
    :param output_file: 필터링된 결과가 저장될 파일 경로
    """
    try:
        # 제거할 단어 목록 파일을 읽어 단어 세트를 만듭니다.
        # 파일 형식에 관계없이 순수 단어만 추출하기 위해 정규표현식을 사용합니다.
        words_to_remove = set()
        with open(source_file_for_removal, 'r', encoding='utf-8') as f_source:
            # words_to_remove.txt는 한 줄에 단어 하나씩 있으므로, strip()만으로 충분합니다.
            for line in f_source:
                stripped_line = line.strip()
                if stripped_line: # 빈 줄은 무시합니다.
                    words_to_remove.add(stripped_line)
        
        print(f"제거 기준으로 사용할 단어 {len(words_to_remove)}개 ({source_file_for_removal})를 불러왔습니다.\n")
        print("--- 제거되는 단어 목록 ---")

        kept_lines = []
        removed_count = 0

        # 필터링 대상 파일(N2words.txt)을 엽니다.
        with open(target_file, 'r', encoding='utf-8') as fin:
            for line in fin:
                original_line = line
                # 각 줄에서 실제 단어 부분만 추출합니다.
                word_match = re.search(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+', line)
                word = ""
                if word_match:
                    word = word_match.group(0).strip()
                
                # 추출된 단어가 제거 목록에 없는 경우에만 kept_lines 리스트에 추가합니다.
                if word and word not in words_to_remove:
                    kept_lines.append(original_line)
                # 헤더 같이 단어가 없는 줄은 보관합니다.
                elif not word:
                     kept_lines.append(original_line)
                # 단어가 있고, 제거 목록에도 있는 경우
                elif word in words_to_remove:
                    print(f"제거됨: {word}")
                    removed_count += 1
        
        # 필터링된 결과를 새 파일에 씁니다.
        with open(output_file, 'w', encoding='utf-8') as fout:
            for line in kept_lines:
                fout.write(line)

        print("\n" + "="*30)
        print(f"총 {removed_count}개의 단어를 제거하고, 결과를 '{output_file}' 파일에 저장했습니다.")
        print("="*30)
        print(f"\n이제 '{output_file}' 파일을 열어 결과를 확인해주세요.")


    except FileNotFoundError as e:
        print(f"오류: 파일을 찾을 수 없습니다. - {e}. 'N2words.txt'와 'words_to_remove.txt' 파일이 있는지 확인해주세요.")
    except Exception as e:
        print(f"스크립트 실행 중 오류가 발생했습니다: {e}")

# --- 스크립트 실행 ---
if __name__ == "__main__":
    # N2 단어 목록에서 지정된 파일(words_to_remove.txt)에 있는 단어를 제거하는 시나리오
    INPUT_FILENAME = "N2words.txt"                 # 필터링 대상 파일
    WORDS_TO_REMOVE_SOURCE_FILENAME = "words_to_remove.txt" # 제거할 단어가 담긴 파일
    OUTPUT_FILENAME = "N2words_filtered.txt"        # 결과를 저장할 파일
    
    filter_words_and_save(INPUT_FILENAME, WORDS_TO_REMOVE_SOURCE_FILENAME, OUTPUT_FILENAME)

