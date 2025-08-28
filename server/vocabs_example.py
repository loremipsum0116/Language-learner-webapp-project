# -*- coding: utf-8 -*-
import json
import os
os.environ["GRPC_DNS_RESOLVER"] = "native"
import re
import time
from io import BytesIO
from typing import List, Optional, Dict, Any

from google.cloud import texttospeech
from pydub import AudioSegment

# ========= 설정(환경변수로 조정 가능) =========
MAX_CHARS_PER_CHUNK = int(os.getenv("MAX_CHARS_PER_CHUNK", "3800"))             # 청크 최대 글자수
SILENCE_BETWEEN_CHUNKS_MS = int(os.getenv("SILENCE_BETWEEN_CHUNKS_MS", "250"))  # 청크 간 무음(ms)
TARGET_DBFS = float(os.getenv("TARGET_DBFS", "-16.0"))                           # 라우드니스 타깃(dBFS)
MAX_RETRY = int(os.getenv("TTS_MAX_RETRY", "2"))                                 # TTS 재시도 횟수
RETRY_BACKOFF_SEC = float(os.getenv("TTS_RETRY_BACKOFF_SEC", "0.8"))             # 재시도 백오프(sec)

# en-US(Chirp3) 보이스: 남/여 교대
VOICE_MALE = texttospeech.VoiceSelectionParams(
    language_code="en-US", name="en-US-Chirp3-HD-Charon"
)
VOICE_FEMALE = texttospeech.VoiceSelectionParams(
    language_code="en-US", name="en-US-Chirp3-HD-Laomedeia"
)
START_GENDER = "male"  # 첫 항목 시작 성별: "male" 또는 "female"

# ========= 레벨 매핑 =========
LEVEL_MAP = [
    ("고급",   "advanced"),
    ("중상급", "upper"),
    ("중급",   "intermediate"),
    ("기초",   "elementary"),
    ("입문",   "starter"),
]

# ========= 유틸 =========
def sanitize_filename(name: str) -> str:
    name = re.sub(r'[\\/*?:"<>|]', "", str(name or ""))
    return name.strip().lower() or "unnamed"

def normalize_spaces(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())

def gender_for_index(idx: int, start: str = "male") -> str:
    first_is_male = (start == "male")
    return "male" if ((idx % 2 == 0) == first_is_male) else "female"

def sentence_tokenize(text: str) -> List[str]:
    """영/한 구두점 기준 문장 분리."""
    if not text:
        return []
    pattern = r"([^\.!\?！？。…]+[\.!\?！？。…])"
    parts = re.findall(pattern, text, flags=re.S)
    if not parts:
        return [text]
    tail = text[sum(len(p) for p in parts):].strip()
    if tail:
        parts.append(tail)
    return [normalize_spaces(p) for p in parts if normalize_spaces(p)]

def chunk_by_chars(sentences: List[str], max_chars: int) -> List[str]:
    """문장 배열을 max_chars 이하 청크로 묶는다."""
    chunks: List[str] = []
    buf = ""
    for s in sentences:
        if not buf:
            buf = s
        elif len(buf) + 1 + len(s) <= max_chars:
            buf = f"{buf} {s}"
        else:
            chunks.append(buf)
            buf = s
    if buf:
        chunks.append(buf)
    return chunks

def loudness_normalize(seg: AudioSegment, target_dbfs: float) -> AudioSegment:
    if seg.duration_seconds <= 0:
        return seg
    if seg.dBFS == float("-inf"):
        return seg
    gain = target_dbfs - seg.dBFS
    return seg.apply_gain(gain)

def level_folder_from_categories(categories: Any) -> Optional[str]:
    """
    카테고리에서 레벨 폴더명 반환. 미검출 시 None(→ 즉시 중단 트리거)
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
    return None

def build_output_path_strict(categories: Any, lemma: str) -> str:
    """저장 경로: 레벨/단어/example.mp3 (레벨 미검출이면 예외 발생)"""
    level = level_folder_from_categories(categories)
    if level is None:
        raise ValueError("LEVEL_TAG_MISSING")
    word_folder = sanitize_filename(lemma)
    out_dir = os.path.normpath(os.path.join(level, word_folder))
    os.makedirs(out_dir, exist_ok=True)
    return os.path.join(out_dir, "example.mp3")

def write_last_saved_lemma(lemma: Optional[str]) -> None:
    """마지막 성공 저장된 lemma 기록."""
    try:
        with open("마지막 생성 단어.txt", "w", encoding="utf-8") as f:
            f.write((lemma or "").strip())
    except Exception as e:
        print(f"⚠️ '마지막 생성 단어.txt' 기록 실패: {e}")

# ========= TTS 합성 =========
def synthesize_chunk(
    tts_client: "texttospeech.TextToSpeechClient",
    voice: "texttospeech.VoiceSelectionParams",
    text: str,
) -> Optional[AudioSegment]:
    if not text:
        return AudioSegment.silent(duration=0)
    synthesis_input = texttospeech.SynthesisInput(text=text)
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3
    )
    for attempt in range(1, MAX_RETRY + 2):  # 최초 1회 + 재시도
        try:
            resp = tts_client.synthesize_speech(
                input=synthesis_input, voice=voice, audio_config=audio_config
            )
            return AudioSegment.from_file(BytesIO(resp.audio_content), format="mp3")
        except Exception as e:
            if attempt <= MAX_RETRY:
                time.sleep(RETRY_BACKOFF_SEC * attempt)
            else:
                print(f"❌ TTS 실패(최대 재시도 초과): {e}")
                return None
    return None

def synthesize_full_text(
    tts_client: "texttospeech.TextToSpeechClient",
    voice: "texttospeech.VoiceSelectionParams",
    text: str,
) -> Optional[AudioSegment]:
    text = normalize_spaces(text)
    if not text:
        return AudioSegment.silent(duration=0)
    sentences = sentence_tokenize(text)
    chunks = chunk_by_chars(sentences, MAX_CHARS_PER_CHUNK)
    merged = AudioSegment.empty()
    silence = AudioSegment.silent(duration=SILENCE_BETWEEN_CHUNKS_MS)
    for idx, chunk in enumerate(chunks, 1):
        seg = synthesize_chunk(tts_client, voice, chunk)
        if seg is None or len(seg) == 0:
            print(f"⚠️ 청크 합성 실패 → index={idx}, text='{chunk[:80]}...'")
            return None
        seg = loudness_normalize(seg, TARGET_DBFS)
        merged += seg
        if idx != len(chunks):
            merged += silence
    return merged

# ========= JSON 로더 =========
def load_items(json_file_path: str) -> List[Dict[str, Any]]:
    with open(json_file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        return data if isinstance(data, list) else [data]

# ========= 메인 파이프라인 =========
def synthesize_vocab_audio(json_file_path: str):
    # TTS 클라이언트
    try:
        tts_client = texttospeech.TextToSpeechClient()
    except Exception as e:
        print("Google Cloud 인증 실패. 확인:",
              "- 서비스계정 키/ADC 설정",
              "- 프로젝트 보이스 가용성", sep="\n")
        print(f"오류: {e}")
        return

    try:
        vocab_list = load_items(json_file_path)
    except Exception as e:
        print(f"JSON 파일 열기/파싱 실패: {e}")
        return

    print(f"🎧 en-US(Chirp3) 남/여 교대 — 시작 (items={len(vocab_list)})\n")

    last_saved_lemma: Optional[str] = None   # 직전 성공 저장된 lemma
    fail_logs: List[str] = []
    total = len(vocab_list)

    for i, item in enumerate(vocab_list):
        lemma = item.get("lemma")
        script_text = item.get("koChirpScript")
        categories = item.get("categories")

        if not lemma or not script_text:
            print(f"[{i+1}/{total}] 건너뜀: lemma 또는 koChirpScript 없음.")
            continue

        # ★ 레벨 태그 필수(미검출 즉시 중단)
        try:
            out_path = build_output_path_strict(categories, lemma)
        except ValueError as ve:
            if str(ve) == "LEVEL_TAG_MISSING":
                print(f"[{i+1}/{total}] '{lemma}' → ❌ 카테고리에서 레벨 태그 미검출. 생성 중단.")
                write_last_saved_lemma(last_saved_lemma)
                return
            else:
                print(f"[{i+1}/{total}] '{lemma}' → 경로 빌드 오류: {ve}")
                write_last_saved_lemma(last_saved_lemma)
                return

        # ★ 보이스: en-US(Chirp3) 남/여 교대
        gender = gender_for_index(i, START_GENDER)
        voice = VOICE_MALE if gender == "male" else VOICE_FEMALE

        print(f"[{i+1}/{total}] '{lemma}' → voice={gender}, save='{out_path}'")

        # TTS (문장→청크→병합)
        merged_audio = synthesize_full_text(tts_client, voice, script_text)
        if merged_audio is None or len(merged_audio) == 0:
            print(f"  ❌ 합성 실패 → 미저장")
            fail_logs.append(f"{lemma}\tSYNTH_FAIL\tpath={out_path}")
            continue

        # MP3 저장
        try:
            merged_audio.export(out_path, format="mp3")
            last_saved_lemma = lemma
            print(f"  ✅ 오디오 저장 완료")
        except Exception as e:
            print(f"  ⚠️ 파일 저장 실패: {e}")
            fail_logs.append(f"{lemma}\tSAVE_ERROR:{e}\tpath={out_path}")

    # 전체 루프 정상 종료 시 마지막 저장 단어 기록
    write_last_saved_lemma(last_saved_lemma)

    # 실패 목록 저장
    if fail_logs:
        try:
            with open("추출 실패 단어 목록.txt", "w", encoding="utf-8") as f:
                f.write("\n".join(fail_logs) + "\n")
            print(f"\n⚠️ 실패 {len(fail_logs)}건 → '추출 실패 단어 목록.txt' 기록 완료")
        except Exception as e:
            print(f"\n⚠️ 실패 목록 저장 오류: {e}")
    else:
        print("\n✅ 모든 항목 저장 완료(실패 없음)")

    print("\n✅ 처리 종료")


if __name__ == "__main__":
    file_to_process = "cefr_vocabs.json"  # 배열 JSON 기준
    synthesize_vocab_audio(file_to_process)
