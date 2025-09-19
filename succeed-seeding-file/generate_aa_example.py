# generate_aa_example.py
# -*- coding: utf-8 -*-
"""
JLPT N4 'ああ' 단어의 example.mp3 파일 단일 생성 (koChirpScript 기반)
"""

import os
os.environ["GRPC_DNS_RESOLVER"] = "native"

import sys, re, json, time
from io import BytesIO
from typing import Any, Dict, List, Optional

from google.cloud import texttospeech
from pydub import AudioSegment

# ===== 파라미터 =====
TARGET_DBFS = -16.0
MAX_RETRY = 2
RETRY_BACKOFF_SEC = 0.8
COMMA_GAP_MS = 500

# 일본어 보이스
JA_MALE = "ja-JP-Chirp3-HD-Orus"
# 한국어 보이스 (Chirp3)
KO_CHIRP_MALE = "ko-KR-Chirp3-HD-Orus"

def normalize_spaces(text: str) -> str:
    """공백 정규화"""
    return re.sub(r'\s+', ' ', text.strip())

def loudness_normalize(audio: AudioSegment, target_dbfs: float = TARGET_DBFS) -> AudioSegment:
    """오디오 볼륨 정규화"""
    try:
        current_dbfs = audio.dBFS
        if current_dbfs == float('-inf'):
            print(f"[WARN] 무음 오디오 감지 (dBFS={current_dbfs}), 정규화 스킵")
            return audio
        change_in_dbfs = target_dbfs - current_dbfs
        return audio.apply_gain(change_in_dbfs)
    except Exception as e:
        print(f"[WARN] 오디오 정규화 실패: {e}")
        return audio

def synthesize_lang(tts: texttospeech.TextToSpeechClient, text: str, voice_name: str, language_code: str) -> Optional[AudioSegment]:
    """단일 언어 TTS 합성"""
    text = normalize_spaces(text)
    if not text:
        return AudioSegment.silent(duration=0)

    voice = texttospeech.VoiceSelectionParams(
        language_code=language_code, name=voice_name
    )
    cfg = texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.MP3)
    inp = texttospeech.SynthesisInput(text=text)

    for attempt in range(1, MAX_RETRY + 2):
        try:
            resp = tts.synthesize_speech(input=inp, voice=voice, audio_config=cfg)
            seg = AudioSegment.from_file(BytesIO(resp.audio_content), format="mp3")
            return loudness_normalize(seg, TARGET_DBFS)
        except Exception as e:
            if attempt <= MAX_RETRY:
                time.sleep(RETRY_BACKOFF_SEC * attempt)
            else:
                print(f"  ❌ TTS 실패(name={voice_name}, lang={language_code}): {e}")
                return None
    return None

def synthesize_with_commas(tts: texttospeech.TextToSpeechClient, text: str, language_code: str, comma_gap_ms: int, voice_name: str) -> Optional[AudioSegment]:
    """쉼표 분할 합성"""
    text = normalize_spaces(text)
    if not text:
        return AudioSegment.silent(duration=0)

    parts = [p.strip() for p in re.split(r"[,\uFF0C]", text) if p.strip()]

    silence = AudioSegment.silent(duration=comma_gap_ms)
    merged = AudioSegment.empty()

    for idx, part in enumerate(parts):
        seg = synthesize_lang(tts, part, voice_name, language_code)
        if seg is None or len(seg) == 0:
            print(f"  ❌ 부분 합성 실패: {part}")
            return None
        merged += seg
        if idx != len(parts) - 1:
            merged += silence

    return loudness_normalize(merged, TARGET_DBFS)

def is_japanese_char(char: str) -> bool:
    """일본어 문자인지 판별 (히라가나, 가타카나, 한자)"""
    code = ord(char)
    return (
        0x3040 <= code <= 0x309F  # 히라가나
        or 0x30A0 <= code <= 0x30FF  # 가타카나
        or 0x4E00 <= code <= 0x9FAF  # CJK 한자
        or 0x3400 <= code <= 0x4DBF
    )  # CJK 확장 A

def split_mixed_text(text: str) -> List[tuple]:
    """일본어/한국어 혼합 텍스트를 분리하여 (언어, 텍스트) 튜플 리스트로 반환"""
    if not text:
        return []

    # 모든 괄호와 괄호 안의 내용을 완전히 제거
    processed_text = re.sub(r"[（(][^）)]*[）)]", "", text)

    segments = []
    current_text = ""
    current_lang = None

    for char in processed_text:
        if char.strip():  # 공백이 아닌 경우만
            is_ja = is_japanese_char(char)
            lang = "ja" if is_ja else "ko"

            if current_lang is None:
                current_lang = lang
                current_text = char
            elif current_lang == lang:
                current_text += char
            else:
                # 언어가 바뀜 - 이전 세그먼트 저장
                if current_text.strip():
                    segments.append((current_lang, current_text.strip()))
                current_lang = lang
                current_text = char
        else:
            current_text += char  # 공백은 그대로 추가

    # 마지막 세그먼트 저장
    if current_text.strip():
        segments.append((current_lang, current_text.strip()))

    return segments

def clean_japanese_text(text: str) -> str:
    """일본어 텍스트 정리"""
    # 특수 문자 처리
    return text.replace("。", "").replace("、", "").strip()

def clean_ko_gloss(text: str) -> str:
    """한국어 뜻 전처리 - 괄호 및 괄호 내용 완전 제거"""
    # 다양한 형태의 괄호와 그 안의 내용 완전 제거
    cleaned = re.sub(r"[（(][^）)]*[）)]", "", text)
    cleaned = re.sub(r"[【〔][^】〕]*[】〕]", "", cleaned)  # 대괄호 계열
    cleaned = re.sub(r"[〈《][^〉》]*[〉》]", "", cleaned)  # 꺾쇠 계열

    # 연속된 공백을 하나로 정리
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()

    return cleaned

def synthesize_mixed_script(tts: texttospeech.TextToSpeechClient, mixed_text: str) -> Optional[AudioSegment]:
    """일본어/한국어 혼합 텍스트를 각각 해당 언어 보이스로 합성"""
    segments = split_mixed_text(mixed_text)
    if not segments:
        return None

    merged = AudioSegment.empty()

    for lang, text in segments:
        if lang == "ja":
            # 일본어 부분
            cleaned_text = clean_japanese_text(text)
            seg = synthesize_lang(tts, cleaned_text, JA_MALE, "ja-JP")
        else:
            # 한국어 부분 - 쉼표 분할 적용
            cleaned_text = clean_ko_gloss(text)
            seg = synthesize_with_commas(tts, cleaned_text, "ko-KR", COMMA_GAP_MS, KO_CHIRP_MALE)

        if seg is None or len(seg) == 0:
            print(f"    ⚠️ {lang} 부분 합성 실패: '{text[:50]}{'...' if len(text) > 50 else ''}'")
            return None

        merged += seg
        # 세그먼트 간 짧은 무음 추가 (200ms)
        merged += AudioSegment.silent(duration=200)

    return loudness_normalize(merged, TARGET_DBFS)

def main():
    """메인 함수"""
    # JLPT N4 데이터 로드
    json_path = "C:\\Users\\sst70\\OneDrive\\바탕 화면\\Language-learner\\succeed-seeding-file\\jlpt_n4_vocabs.json"

    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            vocabs = json.load(f)
    except Exception as e:
        print(f"[ERROR] JSON 파일 로드 실패: {e}")
        return

    # 'ああ' 항목 찾기
    target_vocab = None
    for vocab in vocabs:
        if vocab.get("lemma") == "ああ":
            target_vocab = vocab
            break

    if not target_vocab:
        print("[ERROR] 'ああ' 항목을 찾을 수 없습니다.")
        return

    print(f"[INFO] 타겟 단어: {target_vocab['lemma']}")
    ko_chirp_script = target_vocab.get("koChirpScript", "")
    print(f"[INFO] koChirpScript: {ko_chirp_script}")

    if not ko_chirp_script:
        print("[ERROR] koChirpScript가 없습니다.")
        return

    # 출력 디렉토리 생성
    output_dir = "C:\\Users\\sst70\\OneDrive\\바탕 화면\\Language-learner\\succeed-seeding-file\\jlpt\\n4\\aa"
    os.makedirs(output_dir, exist_ok=True)

    # TTS 클라이언트 생성
    try:
        tts = texttospeech.TextToSpeechClient()
    except Exception as e:
        print(f"[ERROR] TTS 클라이언트 생성 실패: {e}")
        return

    # example.mp3 생성 (koChirpScript 혼합 언어 처리)
    print(f"[INFO] koChirpScript 기반 오디오 생성 중...")
    example_audio = synthesize_mixed_script(tts, ko_chirp_script)

    if example_audio:
        example_path = os.path.join(output_dir, "example.mp3")
        example_audio.export(example_path, format="mp3")
        print(f"[SUCCESS] example.mp3 생성 완료: {example_path}")
    else:
        print("[ERROR] 예문 오디오 생성 실패")

if __name__ == "__main__":
    main()