# -*- coding: utf-8 -*-
"""
fix_N1_L_035.py

N1_L_035 항목에서 한국어 번역 부분을 제거하고 일본어만으로 오디오 파일을 재생성하는 스크립트

사용법:
  python fix_N1_L_035.py
"""
import os
os.environ["GRPC_DNS_RESOLVER"] = "native"

import re
import json
import argparse
from io import BytesIO
from typing import List, Tuple, Any, Dict

from google.cloud import texttospeech
from pydub import AudioSegment

# ----------------------
# 공용 오디오 설정
# ----------------------
AUDIO_CONFIG = texttospeech.AudioConfig(
    audio_encoding=texttospeech.AudioEncoding.MP3
)

# ----------------------
# 한국어 제거 함수 (강화버전)
# ----------------------
def remove_korean_translation(text: str) -> str:
    """한국어 번역 부분을 더 정확하게 제거하는 함수"""
    if not text:
        return text

    # 1. 소괄호와 그 안의 한국어 번역 완전 제거
    result = re.sub(r'[（(][^）)]*[）)]', '', text)

    # 2. 대괄호, 중괄호는 괄호만 제거하고 내용 유지
    result = re.sub(r'[［\[]', '', result)
    result = re.sub(r'[］\]]', '', result)
    result = re.sub(r'[｛\{]', '', result)
    result = re.sub(r'[｝\}]', '', result)

    # 3. 한글 문자 완전 제거 (가-힣, ㄱ-ㅎ, ㅏ-ㅣ)
    result = re.sub(r'[가-힣ㄱ-ㅎㅏ-ㅣ]', '', result)

    # 4. 연속된 공백을 하나로 정리
    result = re.sub(r'\s+', ' ', result)

    # 5. 문장 끝의 불필요한 공백이나 구두점 정리
    result = result.strip()

    return result

def sanitize_filename(name: str) -> str:
    return re.sub(r'[\\/*?:"<>| ]+', "_", str(name)).strip("_")

def parse_script_ordered(script: str) -> List[Tuple[str, str]]:
    """'A: ... B: ... C: ...' -> [('A','...'), ('B','...'), ('C','...'), ...]
       라벨이 없으면 전체를 A 보이스로 나레이션 처리."""
    if not script or not isinstance(script, str):
        return []

    # 한국어 번역 제거
    s = remove_korean_translation(script)
    s = re.sub(r"\s+", " ", s).strip()

    # A/B/C 라벨 분리
    tokens = re.split(r"(?i)\b([ABC])\s*:\s*", s)
    if len(tokens) < 3:
        return [("A", s)]  # 라벨 없음 → 나레이션

    seq = []
    for i in range(1, len(tokens), 2):
        spk = tokens[i].upper()
        text = tokens[i + 1].strip()
        if spk in ("A", "B", "C") and text:
            seq.append((spk, text))
    return seq

def normalize_questions(q_field: Any) -> List[str]:
    """str -> [str], list -> list[str], dict{'questions': [...]} -> list[str]"""
    if isinstance(q_field, list):
        return [remove_korean_translation(str(x).strip()) for x in q_field if remove_korean_translation(str(x).strip())]
    if isinstance(q_field, dict):
        if "questions" in q_field and isinstance(q_field["questions"], list):
            return [remove_korean_translation(str(x).strip()) for x in q_field["questions"] if remove_korean_translation(str(x).strip())]
        return []
    if isinstance(q_field, str):
        s = q_field.strip()
        return [remove_korean_translation(s)] if remove_korean_translation(s) else []
    return []

def _pairs_from_dict(d: Dict[str, Any]) -> List[Tuple[str, str]]:
    items = []
    for k, v in d.items():
        lab = str(k).strip().upper()
        if len(lab) == 1 and lab.isalpha():
            txt = remove_korean_translation(str(v).strip())
            if txt:
                items.append((lab, txt))
    items.sort(key=lambda x: x[0])  # 알파벳 순
    return items

def normalize_options(opt_field: Any):
    """옵션 정규화 및 한국어 제거"""
    if not opt_field:
        return {"mode": "none", "sets": []}

    if isinstance(opt_field, list) and all(isinstance(x, dict) for x in opt_field):
        sets = []
        for d in opt_field:
            pairs = _pairs_from_dict(d)
            sets.append(pairs if pairs else [])
        return {"mode": "per_question", "sets": sets}

    if isinstance(opt_field, dict):
        pairs = _pairs_from_dict(opt_field)
        if pairs:
            return {"mode": "broadcast", "sets": [pairs]}

    return {"mode": "none", "sets": []}

def build_voice_set(language_code: str):
    """언어코드(ja-JP)에 맞는 A/B/C/Q 보이스 세트 생성"""
    return {
        "C": texttospeech.VoiceSelectionParams(
            language_code=language_code, name=f"{language_code}-Chirp3-HD-Orus"
        ),
        "A": texttospeech.VoiceSelectionParams(
            language_code=language_code, name=f"{language_code}-Chirp3-HD-Laomedeia"
        ),
        "B": texttospeech.VoiceSelectionParams(
            language_code=language_code, name=f"{language_code}-Chirp3-HD-Sadachbia"
        ),
        "Q": texttospeech.VoiceSelectionParams(
            language_code=language_code, name=f"{language_code}-Chirp3-HD-Kore"
        ),
    }

def synthesize(
    client: texttospeech.TextToSpeechClient,
    text: str,
    voice: texttospeech.VoiceSelectionParams,
) -> AudioSegment:
    # 한국어 번역 제거
    text = remove_korean_translation(text)
    if not text:
        return AudioSegment.silent(duration=0)

    synthesis_input = texttospeech.SynthesisInput(text=text)
    resp = client.synthesize_speech(
        input=synthesis_input, voice=voice, audio_config=AUDIO_CONFIG
    )
    return AudioSegment.from_file(BytesIO(resp.audio_content), format="mp3")

def main():
    # JSON 파일 읽기
    json_file = "N1_Listening.json"
    output_dir = "N1_Listening_mix"

    try:
        client = texttospeech.TextToSpeechClient()
    except Exception as e:
        raise SystemExit(f"Google Cloud TTS 클라이언트 생성 실패: {e}")

    try:
        with open(json_file, "r", encoding="utf-8") as f:
            items = json.load(f)
    except Exception as e:
        raise SystemExit(f"입력 JSON 로드 실패: {e}")

    if not isinstance(items, list):
        raise SystemExit("입력 JSON 루트는 list 여야 합니다.")

    # N1_L_035 항목 찾기
    target_item = None
    for item in items:
        if item.get("id") == "N1_L_035":
            target_item = item
            break

    if not target_item:
        print("N1_L_035 항목을 찾을 수 없습니다.")
        return

    print("N1_L_035 항목 발견. 한국어 번역 제거 후 오디오 재생성을 시작합니다.")

    # 한국어 제거 전후 비교 출력
    print("\n=== 원본 script ===")
    print(target_item.get("script", "")[:200] + "...")

    cleaned_script = remove_korean_translation(target_item.get("script", ""))
    print("\n=== 한국어 제거 후 script ===")
    print(cleaned_script[:200] + "...")

    # 출력 디렉토리 생성
    os.makedirs(output_dir, exist_ok=True)

    # 보이스 설정
    VOICES = build_voice_set("ja-JP")

    # 오디오 처리 파라미터
    gap_turn = AudioSegment.silent(duration=250)
    gap_q = AudioSegment.silent(duration=400)
    gap_qprefix = AudioSegment.silent(duration=220)
    gap_opt = AudioSegment.silent(duration=180)
    gap_q2opt = AudioSegment.silent(duration=1500)
    gap_opt_hold = AudioSegment.silent(duration=1500)

    audio_mix = AudioSegment.silent(duration=0)

    # (1) 대화부 처리
    script = target_item.get("script", "")
    seq = parse_script_ordered(script)

    print(f"\n대화부 처리: {len(seq)}개 발화")
    if seq:
        for spk, text in seq:
            print(f"  {spk}: {text[:50]}...")
            if spk == "A":
                voice = VOICES["A"]
            elif spk == "B":
                voice = VOICES["B"]
            else:  # "C"
                voice = VOICES["C"]
            try:
                seg = synthesize(client, text, voice)
                audio_mix += seg
                audio_mix += gap_turn
            except Exception as e:
                print(f"  ! 합성 실패({spk}): {e}")
                continue

    # (2) 질문부 + 옵션부 처리
    questions = normalize_questions(target_item.get("question"))
    options_norm = normalize_options(target_item.get("options"))

    print(f"\n질문부 처리: {len(questions)}개 질문")
    if questions:
        audio_mix += gap_q
        opt_mode = options_norm["mode"]
        opt_sets = options_norm["sets"]

        if len(questions) == 1:
            # 단일 질문
            audio_mix += synthesize(client, "もんだいばんごういち。", VOICES["Q"])
            audio_mix += gap_qprefix
            audio_mix += synthesize(client, questions[0], VOICES["Q"])
            print(f"  질문: {questions[0][:50]}...")

            # 질문 → 옵션 사이 대기
            audio_mix += gap_q2opt

            # 옵션 읽기
            opts = []
            if opt_mode == "per_question" and len(opt_sets) >= 1:
                opts = opt_sets[0]
            elif opt_mode == "broadcast" and len(opt_sets) == 1:
                opts = opt_sets[0]

            if opts:
                print(f"  옵션: {len(opts)}개")
                for lab, txt in opts:
                    print(f"    {lab}: {txt[:30]}...")
                    audio_mix += gap_opt
                    audio_mix += synthesize(client, f"{lab}", VOICES["Q"])
                    audio_mix += gap_opt_hold
                    audio_mix += synthesize(client, txt, VOICES["Q"])

    # (3) 파일 저장
    output_file = os.path.join(output_dir, "N1_L_035.mp3")

    # 기존 파일이 있으면 백업
    if os.path.exists(output_file):
        backup_file = os.path.join(output_dir, "N1_L_035_backup.mp3")
        os.rename(output_file, backup_file)
        print(f"기존 파일을 {backup_file}로 백업했습니다.")

    audio_mix.export(output_file, format="mp3")
    print(f"\n✅ 완료! 새로운 오디오 파일이 생성되었습니다: {output_file}")
    print(f"   총 길이: {len(audio_mix)} ms ({len(audio_mix)/1000:.1f}초)")

if __name__ == "__main__":
    main()