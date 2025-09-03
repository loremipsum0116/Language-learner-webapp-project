# -*- coding: utf-8 -*-
import json
import os
os.environ["GRPC_DNS_RESOLVER"] = "native"
import re
from io import BytesIO
from typing import Tuple, List, Dict, Any, Optional

from google.cloud import texttospeech
from pydub import AudioSegment

# ===== 설정 =====
# 항상 en-US 보이스 사용 (필요 시 프로젝트에 맞는 이름으로 교체 가능)
EN_VOICE = texttospeech.VoiceSelectionParams(
    language_code="en-US",
    name="en-US-Chirp3-HD-Charon"   # 사용 가능 보이스로 교체 가능 (예: "en-US-Neural2-C")
)

FAIL_LIST_FILENAME = "추출 실패 단어 목록.txt"

# ===== 유틸 =====
def sanitize_filename(name: str) -> str:
    name = re.sub(r'[\\/*?:"<>|]', "", str(name))
    return name.strip().lower()

LEVEL_MAP = [
    ("고급",   "advanced"),
    ("중상급", "upper"),
    ("중급",   "intermediate"),
    ("기초",   "elementary"),
    ("입문",   "starter"),
]

def level_folder_from_categories(categories: Any) -> str:
    """
    categories: "중급, 수능, TOEFL" 또는 리스트/기타
    매칭 실패 시 'intermediate'로 폴백.
    """
    if isinstance(categories, list):
        cat_str = ",".join(map(str, categories))
    elif isinstance(categories, str):
        cat_str = categories
    else:
        cat_str = str(categories or "")
    for kr, folder in LEVEL_MAP:
        if kr in cat_str:
            return folder
    print(f"⚠️ 레벨 태그 미검출(categories='{cat_str}'), 'intermediate'로 저장합니다.")
    return "intermediate"

# ===== koChirpScript → 영어/한글 텍스트 분리 =====
def split_english_korean(script_text: str) -> Tuple[str, str]:
    """
    koChirpScript에서 영어 구간과 한글 구간을 모아
    (english_text, korean_text)로 반환.
    - 연속 구간을 합쳐 각 언어별 하나의 큰 문장으로 만듦
    - 공백 정리 포함
    """
    if not script_text:
        return "", ""

    def is_hangul(ch: str) -> bool:
        code = ord(ch)
        return (
            0xAC00 <= code <= 0xD7AF or   # Hangul Syllables
            0x1100 <= code <= 0x11FF or   # Hangul Jamo
            0x3130 <= code <= 0x318F      # Hangul Compatibility Jamo
        )

    def is_english_letter(ch: str) -> bool:
        return "a" <= ch.lower() <= "z"

    segments: List[Tuple[str, str]] = []  # [(lang, text)], lang ∈ {"en","ko"}
    current_lang: Optional[str] = None
    buf: List[str] = []

    def flush():
        nonlocal buf, current_lang
        if buf and current_lang:
            text = "".join(buf)
            segments.append((current_lang, text))
        buf = []

    for ch in script_text:
        if is_hangul(ch):
            lang = "ko"
        elif is_english_letter(ch):
            lang = "en"
        elif ch.isspace():
            lang = current_lang  # 현재 언어 유지
        else:
            lang = current_lang  # 구두점 등은 현재 언어에 붙임

        if lang != current_lang and buf:
            flush()
        buf.append(ch)
        current_lang = lang or current_lang

    flush()

    english_text = " ".join(t for lang, t in segments if lang == "en")
    korean_text  = " ".join(t for lang, t in segments if lang == "ko")

    # 공백 정리
    def normalize_spaces(s: str) -> str:
        s = re.sub(r"\s+", " ", s or "").strip()
        return s

    return normalize_spaces(english_text), normalize_spaces(korean_text)

# ===== JSON 로더: 배열/단일/NDJSON 지원 =====
def load_items(json_file_path: str) -> List[Dict[str, Any]]:
    with open(json_file_path, "r", encoding="utf-8") as f:
        text = f.read().strip()
        if not text:
            return []
        try:
            data = json.loads(text)
            if isinstance(data, list):
                return data
            elif isinstance(data, dict):
                return [data]
        except json.JSONDecodeError:
            pass

    items: List[Dict[str, Any]] = []
    with open(json_file_path, "r", encoding="utf-8") as f:
        for line in f:
            s = line.strip()
            if not s:
                continue
            try:
                obj = json.loads(s)
                if isinstance(obj, dict):
                    items.append(obj)
            except json.JSONDecodeError:
                continue
    return items

# ===== TTS: 한 번 합성 =====
def tts_synthesize(tts_client: "texttospeech.TextToSpeechClient", text: str) -> AudioSegment:
    """
    text를 en-US 보이스로 합성하여 AudioSegment 반환.
    text가 비어 있으면 길이 0 AudioSegment 반환.
    """
    if not text:
        return AudioSegment.empty()

    synthesis_input = texttospeech.SynthesisInput(text=text)
    audio_config = texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.MP3)

    try:
        resp = tts_client.synthesize_speech(
            input=synthesis_input,
            voice=EN_VOICE,         # ★ 영어/한글 모두 동일한 en-US 보이스 사용
            audio_config=audio_config
        )
        return AudioSegment.from_file(BytesIO(resp.audio_content), format="mp3")
    except Exception as e:
        print(f"❌ TTS 합성 오류: {e} | text='{text[:60]}...'")
        return AudioSegment.empty()

def synthesize_vocab_audio(json_file_path: str):
    # TTS 클라이언트
    try:
        tts_client = texttospeech.TextToSpeechClient()
    except Exception as e:
        print("Google Cloud 인증 실패(TTS):", e)
        return

    items = load_items(json_file_path)
    if not items:
        print(f"JSON 로드 결과가 비어있습니다: {json_file_path}")
        return

    print(f"🎧 TTS(언어별 분리 합성) 시작… (items={len(items)})\n")
    failed_logs: List[str] = []
    total = len(items)

    for i, item in enumerate(items):
        lemma = item.get("lemma")
        script_text = item.get("koChirpScript")
        categories = item.get("categories")

        if not lemma or not script_text:
            print(f"[{i+1}/{total}] 건너뜀: lemma 또는 koChirpScript 없음.")
            continue

        # 저장 경로: level/lemma/example.mp3
        level = level_folder_from_categories(categories)
        out_dir = os.path.normpath(os.path.join(level, sanitize_filename(lemma)))
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, "example.mp3")

        # 1) koChirpScript를 영어/한글로 분리
        en_text, ko_text = split_english_korean(script_text)

        # 2) 각 언어 텍스트를 동일(en-US) 보이스로 별도 합성
        en_audio = tts_synthesize(tts_client, en_text)
        ko_audio = tts_synthesize(tts_client, ko_text)

        # 3) 합치기 (영어 → 짧은 무음 → 한글)
        merged = AudioSegment.empty()
        if len(en_audio) > 0:
            merged += en_audio
        # 300ms 무음 구분 (원치 않으면 제거 가능)
        if len(en_audio) > 0 and len(ko_audio) > 0:
            merged += AudioSegment.silent(duration=300)
        if len(ko_audio) > 0:
            merged += ko_audio

        if len(merged) == 0:
            print(f"[{i+1}/{total}] '{lemma}' → ❌ 합성된 오디오 없음 → 미저장")
            failed_logs.append(f"{lemma}\tNO_AUDIO\tpath={out_path}")
            continue

        try:
            merged.export(out_path, format="mp3")
            print(f"[{i+1}/{total}] '{lemma}' → ✅ 저장: {out_path}")
        except Exception as e:
            print(f"[{i+1}/{total}] '{lemma}' → ⚠️ 파일 저장 실패: {e}")
            failed_logs.append(f"{lemma}\tSAVE_ERROR:{e}\tpath={out_path}")

    # 실패 목록 저장
    if failed_logs:
        try:
            with open(FAIL_LIST_FILENAME, "w", encoding="utf-8") as f:
                f.write("\n".join(failed_logs) + "\n")
            print(f"\n⚠️ 실패 {len(failed_logs)}건 → '{FAIL_LIST_FILENAME}' 기록 완료")
        except Exception as e:
            print(f"\n⚠️ 실패 목록 저장 오류: {e}")
    else:
        print("\n✅ 모든 항목 저장 완료(실패 목록 없음)")

    print("\n✅ 처리 완료")

if __name__ == "__main__":
    # 예: 배열 형태 JSON 파일
    file_to_process = "vocab_new.json"
    synthesize_vocab_audio(file_to_process)
