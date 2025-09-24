# mja_n2.py
# -*- coding: utf-8 -*-
"""
JLPT N2 전체 오디오 생성기

기능:
- succeed-seeding-file/jlpt/jlpt/n2/ 내의 모든 폴더들을 감지
- N2_fixed.json 데이터와 매칭하여 해당 폴더에 오디오 파일 생성
- 모든 기존 파일을 덮어쓰며 처음부터 재생성

출력:
succeed-seeding-file/jlpt/jlpt/n2/{romaji}/
├── word.mp3     (kana 읽기)
├── gloss.mp3    (kana + 한국어 뜻)
└── example.mp3  (예문)
"""

import os
import sys
import json
import re
from pathlib import Path

# make_jlpt_audio.py 모듈 import
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from make_jlpt_audio import (
    tts_client,
    voices_for_index,
    synthesize_lang_try_voices,
    synthesize_with_commas_try_voices,
    synthesize_mixed_script,
    clean_ko_gloss,
    clean_japanese_text,
    loudness_normalize,
    AudioSegment,
    TARGET_DBFS,
    GLOSS_GAP_MS,
    COMMA_GAP_MS,
    JA_MALE_FALLBACKS,
    JA_FEMALE_FALLBACKS,
    KO_NEURAL_MALE_FALLBACKS,
    KO_NEURAL_FEMALE_FALLBACKS,
    KO_CHIRP_MALE_FALLBACKS,
    KO_CHIRP_FEMALE_FALLBACKS,
)

def sanitize_filename(name: str) -> str:
    """파일명 정리 (make_jlpt_audio.py와 동일한 로직)"""
    name = re.sub(r'[\\/*?:"<>|]', "", str(name or ""))
    return name.strip().lower() or "unnamed"

def get_all_n2_folders():
    """n2 폴더 내 모든 폴더들의 이름 목록 반환"""
    n2_path = Path("jlpt/n2")
    all_folders = []

    if n2_path.exists():
        for folder in n2_path.iterdir():
            if folder.is_dir():
                all_folders.append(folder.name)

    return sorted(all_folders)  # 알파벳 순으로 정렬

def load_n2_data():
    """N2_fixed.json 데이터 로드"""
    json_path = "N2_fixed.json"
    if not os.path.exists(json_path):
        print(f"❌ {json_path} 파일을 찾을 수 없습니다.")
        return []

    with open(json_path, "r", encoding="utf-8") as f:
        return json.load(f)

def find_matching_item(romaji_folder: str, items: list):
    """폴더명과 일치하는 JSON 항목 찾기"""
    # 먼저 정확히 일치하는 항목 찾기 (hayai2 -> hayai2)
    for item in items:
        item_romaji = sanitize_filename(item.get("romaji", ""))
        if item_romaji == romaji_folder:
            return item

    # 정확한 매칭이 없으면 숫자 접미사 제거 후 찾기 (abiru2 -> abiru)
    base_romaji = re.sub(r'\d+$', '', romaji_folder)
    for item in items:
        item_romaji = sanitize_filename(item.get("romaji", ""))
        if item_romaji == base_romaji:
            return item

    return None

def generate_audio_for_folder(folder_name: str, item: dict, index: int, tts, force_regenerate=True):
    """특정 폴더에 오디오 파일 생성"""
    folder_path = Path("jlpt/n2") / folder_name

    if not folder_path.exists():
        print(f"  ❌ 폴더가 존재하지 않음: {folder_path}")
        return False

    # 필요한 데이터 추출
    lemma = item.get("lemma", "")
    kana = item.get("kana", "")
    romaji = item.get("romaji", "")
    ko_gloss_raw = item.get("koGloss", "")
    ko_chirp_script = item.get("koChirpScript", "")

    if not kana:
        print(f"  ⚠️ kana 필드가 비어있음")
        return False

    # 보이스 선택
    v = voices_for_index(index)

    # 경로 설정
    word_path = folder_path / "word.mp3"
    gloss_path = folder_path / "gloss.mp3"
    example_path = folder_path / "example.mp3"

    # force_regenerate가 False인 경우, 이미 모든 파일이 존재하면 건너뛰기
    if not force_regenerate:
        if word_path.exists() and gloss_path.exists() and example_path.exists():
            print(f"    ⏭️ 이미 모든 파일이 존재함, 건너뛰기")
            return True

    success_count = 0

    # 1) word.mp3 생성
    ja_candidates = [v["ja"]] + (
        JA_MALE_FALLBACKS if v["gender"] == "male" else JA_FEMALE_FALLBACKS
    )
    word_seg = synthesize_lang_try_voices(tts, kana, "ja-JP", ja_candidates)

    if word_seg and len(word_seg) > 0:
        try:
            word_seg.export(str(word_path), format="mp3")
            print(f"    ✅ word.mp3 생성")
            success_count += 1
        except Exception as e:
            print(f"    ❌ word.mp3 저장 실패: {e}")
    else:
        print(f"    ❌ word 합성 실패")

    # 2) gloss.mp3 생성
    ko_gloss = clean_ko_gloss(ko_gloss_raw)
    if ko_gloss and word_seg:
        ko_neural_candidates = [v["ko_neural"]] + (
            KO_NEURAL_MALE_FALLBACKS if v["gender"] == "male" else KO_NEURAL_FEMALE_FALLBACKS
        )
        ko_seg = synthesize_with_commas_try_voices(
            tts, ko_gloss, "ko-KR", COMMA_GAP_MS, ko_neural_candidates
        )

        if ko_seg and len(ko_seg) > 0:
            gloss_seg = word_seg + AudioSegment.silent(duration=GLOSS_GAP_MS) + ko_seg
            gloss_seg = loudness_normalize(gloss_seg, TARGET_DBFS)

            try:
                gloss_seg.export(str(gloss_path), format="mp3")
                print(f"    ✅ gloss.mp3 생성")
                success_count += 1
            except Exception as e:
                print(f"    ❌ gloss.mp3 저장 실패: {e}")
        else:
            print(f"    ❌ koGloss 합성 실패")

    # 3) example.mp3 생성
    if ko_chirp_script:
        ko_chirp_candidates = [v["ko_chirp"]] + (
            KO_CHIRP_MALE_FALLBACKS if v["gender"] == "male" else KO_CHIRP_FEMALE_FALLBACKS
        )
        example_seg = synthesize_mixed_script(
            tts, ko_chirp_script, v, ja_candidates, ko_chirp_candidates
        )

        if example_seg and len(example_seg) > 0:
            try:
                example_seg.export(str(example_path), format="mp3")
                print(f"    ✅ example.mp3 생성")
                success_count += 1
            except Exception as e:
                print(f"    ❌ example.mp3 저장 실패: {e}")
        else:
            print(f"    ❌ example 합성 실패")

    return success_count > 0

def main():
    # 현재 작업 디렉토리를 succeed-seeding-file/jlpt/로 변경
    script_dir = Path(__file__).parent
    os.chdir(script_dir)

    print("🎧 JLPT N2 모든 폴더 오디오 생성 시작")
    print(f"📁 작업 디렉토리: {os.getcwd()}")
    print("⚠️ 모든 기존 오디오 파일을 재생성합니다.")

    # 1. 모든 폴더 목록 확인
    all_folders = get_all_n2_folders()
    if not all_folders:
        print("❌ n2 폴더가 비어있거나 존재하지 않습니다.")
        return

    print(f"📊 전체 폴더 {len(all_folders)}개 발견")

    # 2. N2_fixed.json 데이터 로드
    n2_items = load_n2_data()
    if not n2_items:
        print("❌ N2_fixed.json 데이터를 로드할 수 없습니다.")
        return

    print(f"📚 N2_fixed.json에서 {len(n2_items)}개 항목 로드")

    # 3. TTS 클라이언트 초기화
    try:
        tts = tts_client()
    except Exception as e:
        print(f"❌ Google Cloud TTS 초기화 실패: {e}")
        print("💡 GOOGLE_APPLICATION_CREDENTIALS 환경변수가 설정되어 있는지 확인하세요.")
        return

    # 4. 각 빈 폴더에 대해 오디오 생성
    success_count = 0
    fail_count = 0
    failed_folders = []
    failed_lemmas = []  # lemma 저장용 리스트 추가

    for i, folder_name in enumerate(all_folders):
        print(f"\n[{i+1}/{len(all_folders)}] 폴더: {folder_name}")

        # 매칭되는 데이터 찾기
        item = find_matching_item(folder_name, n2_items)

        if not item:
            print(f"  ⚠️ N2_fixed.json에서 매칭되는 데이터를 찾을 수 없음")
            fail_count += 1
            failed_folders.append(folder_name)
            continue

        lemma = item.get("lemma", "")
        kana = item.get("kana", "")
        print(f"  📖 {lemma} ({kana})")

        # 오디오 생성 (force_regenerate=True로 모든 파일 재생성)
        if generate_audio_for_folder(folder_name, item, i, tts, force_regenerate=True):
            success_count += 1
        else:
            fail_count += 1
            failed_folders.append(folder_name)
            if lemma:  # lemma가 있는 경우만 저장
                failed_lemmas.append(lemma)

    # 5. 결과 출력
    print("\n" + "=" * 50)
    print("📊 작업 완료:")
    print(f"  ✅ 성공: {success_count}개 폴더")
    print(f"  ❌ 실패: {fail_count}개 폴더")

    if failed_folders:
        print(f"\n실패한 폴더 목록:")
        for folder in failed_folders[:10]:  # 처음 10개만 표시
            print(f"  - {folder}")
        if len(failed_folders) > 10:
            print(f"  ... 외 {len(failed_folders) - 10}개")

        # 실패한 폴더 목록 파일로 저장
        with open("n2_failed_folders.txt", "w", encoding="utf-8") as f:
            f.write("\n".join(failed_folders))
        print(f"\n💾 실패한 폴더 목록이 n2_failed_folders.txt에 저장되었습니다.")

        # 실패한 lemma 목록을 n2failed.txt에 저장
        if failed_lemmas:
            with open("n2failed.txt", "w", encoding="utf-8") as f:
                f.write("\n".join(failed_lemmas))
            print(f"💾 실패한 lemma 목록이 n2failed.txt에 저장되었습니다.")

if __name__ == "__main__":
    main()