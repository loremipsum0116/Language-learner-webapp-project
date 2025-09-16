# remake_jlpt_gloss_only.py
# -*- coding: utf-8 -*-
"""
JLPT 일본어 단어 gloss.mp3 파일만 재생성

기능:
- 기존 jlpt 폴더 구조에서 gloss.mp3 파일만 교체
- 일본어: 기존 Chirp3 모델 유지
- 한국어: ko-KR-Neural12-C (남성), ko-KR-Neural12-B (여성) 사용
- 타이밍: 일본어 → 1초 대기 → 한국어 (콤마시 0.5초 대기)
- 괄호 처리: 한국어에서 괄호 및 내용 완전 제거

출력: 기존 jlpt/n5/{romaji}/gloss.mp3 파일들 교체

필수: pip install google-cloud-texttospeech pydub, FFmpeg, GCP ADC 설정
"""

import os

os.environ["GRPC_DNS_RESOLVER"] = "native"

import sys, re, json, time, glob
from io import BytesIO
from typing import Any, Dict, List, Optional

from google.cloud import texttospeech
from pydub import AudioSegment

# ===== 파라미터 =====
TARGET_DBFS = float(os.getenv("TARGET_DBFS", "-16.0"))
GLOSS_GAP_MS = int(os.getenv("GLOSS_GAP_MS", "1000"))  # word→koGloss 간격 (1초)
COMMA_GAP_MS = int(os.getenv("COMMA_GAP_MS", "500"))   # koGloss 내 콤마 간격 (0.5초)
MAX_RETRY = int(os.getenv("MAX_RETRY", "2"))
RETRY_BACKOFF_SEC = float(os.getenv("RETRY_BACKOFF_SEC", "0.8"))

# 일본어 보이스 (기존 Chirp3 HD 유지)
JA_MALE = os.getenv("JA_MALE", "ja-JP-Chirp3-HD-Orus")
JA_FEMALE = os.getenv("JA_FEMALE", "ja-JP-Chirp3-HD-Achernar")

# 한국어 보이스 (Neural2로 변경)
KO_MALE = "ko-KR-Neural2-C"       # 남성 보이스
KO_FEMALE = "ko-KR-Neural2-B"     # 여성 보이스

# 폴백 후보
def _parse_list(s: str) -> List[str]:
    return [x.strip() for x in s.split(",") if x.strip()]

JA_MALE_FALLBACKS = _parse_list("ja-JP-Chirp3-HD-Orus,ja-JP-Neural2-C,ja-JP-Neural2-D")
JA_FEMALE_FALLBACKS = _parse_list("ja-JP-Chirp3-HD-Achernar,ja-JP-Neural2-B,ja-JP-Standard-B")
KO_MALE_FALLBACKS = _parse_list("ko-KR-Neural12-C,ko-KR-Neural2-C,ko-KR-Standard-C")
KO_FEMALE_FALLBACKS = _parse_list("ko-KR-Neural12-B,ko-KR-Neural2-B,ko-KR-Standard-B")

# ===== 유틸 =====
def normalize_spaces(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())

def loudness_normalize(seg: AudioSegment, target_dbfs: float) -> AudioSegment:
    if seg.duration_seconds <= 0 or seg.dBFS == float("-inf"):
        return seg
    return seg.apply_gain(target_dbfs - seg.dBFS)

def clean_ko_gloss_strict(text: str) -> str:
    """한국어 뜻 전처리 - 괄호 및 괄호 내용 완전 제거"""
    if not text:
        return ""
    s = normalize_spaces(text)

    # 물결 표시(~)를 '무엇무엇'으로 치환
    s = s.replace("~", "무엇무엇")

    # 품사 약어 제거 (먼저 처리)
    s = re.sub(r"\b(?:exp|pron|n|v|adj|adv|prep|conj|int|interj|aux|det|num)\.\s*", "", s, flags=re.I)
    s = re.sub(r"\b(?:명사|동사|형용사|부사|감탄사|대명사|전치사|접속사|조동사|관사|수사)\.\s*", "", s)

    # 괄호 및 괄호 안의 내용 완전히 제거 (모든 종류의 괄호)
    s = re.sub(r"[（(【\[]([^）)】\]]*)[）)】\]]", "", s)

    # 추가적인 괄호 형태 제거
    s = re.sub(r"[（(][^）)]*[）)]", "", s)
    s = re.sub(r"【[^】]*】", "", s)
    s = re.sub(r"\[[^\]]*\]", "", s)

    # 특수문자 제거
    s = re.sub(r"[/\\|<>\"']", " ", s)

    # 연속된 공백을 하나로 정리하고 앞뒤 공백 제거
    s = normalize_spaces(s).strip(" ;,·")
    return s

def clean_japanese_text(text: str) -> str:
    """일본어 텍스트 정리"""
    if not text:
        return ""
    s = normalize_spaces(text)
    s = re.sub(r"[（(][^）)]*[）)]", "", s)  # 괄호 제거
    s = re.sub(r"[/\\|<>\"']", " ", s)     # 특수문자 제거
    return normalize_spaces(s)

# ===== 성별 순환 =====
def is_male(index_zero_based: int) -> bool:
    return index_zero_based % 2 == 0

def voices_for_index(idx0: int) -> Dict[str, str]:
    """인덱스별 보이스 선택"""
    if is_male(idx0):
        return {"ja": JA_MALE, "ko": KO_MALE, "gender": "male"}
    else:
        return {"ja": JA_FEMALE, "ko": KO_FEMALE, "gender": "female"}

# ===== TTS =====
def tts_client() -> texttospeech.TextToSpeechClient:
    return texttospeech.TextToSpeechClient()

def synthesize_lang(
    tts: texttospeech.TextToSpeechClient, text: str, voice_name: str, language_code: str
) -> Optional[AudioSegment]:
    """단일 언어 TTS 합성"""
    text = normalize_spaces(text)
    if not text:
        return AudioSegment.silent(duration=0)

    voice = texttospeech.VoiceSelectionParams(language_code=language_code, name=voice_name)
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

def synthesize_lang_try_voices(
    tts: texttospeech.TextToSpeechClient,
    text: str,
    language_code: str,
    voices: List[str],
) -> Optional[AudioSegment]:
    """보이스 후보 리스트를 순차 시도"""
    for idx, vname in enumerate([v for v in voices if v]):
        seg = synthesize_lang(tts, text, vname, language_code)
        if seg is not None and len(seg) > 0:
            if idx > 0:
                print(f"  ↪︎ 대체 보이스 사용: {vname}")
            return seg
    print(f"  ❌ 모든 보이스 실패: {', '.join(voices)}")
    return None

def synthesize_with_commas_try_voices(
    tts: texttospeech.TextToSpeechClient,
    text: str,
    language_code: str,
    comma_gap_ms: int,
    voices: List[str],
) -> Optional[AudioSegment]:
    """쉼표 분할 합성"""
    text = normalize_spaces(text)
    if not text:
        return AudioSegment.silent(duration=0)

    parts = [p.strip() for p in re.split(r"[,\uFF0C]", text) if p.strip()]

    for idx_voice, vname in enumerate([v for v in voices if v]):
        silence = AudioSegment.silent(duration=comma_gap_ms)
        merged = AudioSegment.empty()
        ok = True

        for idx, part in enumerate(parts):
            seg = synthesize_lang(tts, part, vname, language_code)
            if seg is None or len(seg) == 0:
                ok = False
                break
            merged += seg
            if idx != len(parts) - 1:
                merged += silence

        if ok:
            if idx_voice > 0:
                print(f"  ↪︎ 대체 보이스 사용: {vname}")
            return loudness_normalize(merged, TARGET_DBFS)

    print(f"  ❌ 쉼표 분할 합성 실패: {', '.join(voices)}")
    return None

# ===== IO =====
def load_items(json_path: str) -> List[Dict[str, Any]]:
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, list) else [data]

def find_existing_gloss_files() -> List[str]:
    """기존 gloss.mp3 파일들 찾기"""
    pattern = "jlpt/n5/*/gloss.mp3"
    files = glob.glob(pattern)
    print(f"🔍 기존 gloss.mp3 파일 {len(files)}개 발견")
    return files

def sanitize_filename(name: str) -> str:
    name = re.sub(r'[\\/*?:"<>|]', "", str(name or ""))
    return name.strip().lower() or "unnamed"

# ===== 메인 파이프라인 =====
def process_gloss_only(json_path: str) -> None:
    try:
        items = load_items(json_path)
    except Exception as e:
        print(f"JSON 로드 실패: {e}")
        return

    try:
        tts = tts_client()
    except Exception as e:
        print("Google Cloud 인증 실패 또는 클라이언트 생성 실패:", e)
        return

    # 기존 gloss.mp3 파일들 확인
    existing_files = find_existing_gloss_files()

    # romaji -> item 매핑 생성
    romaji_to_item = {}
    for i, item in enumerate(items):
        romaji = item.get("romaji", "")
        if romaji:
            romaji_to_item[sanitize_filename(romaji)] = (i, item)

    total = len(items)
    print(f"🎧 JLPT gloss.mp3 재생성 시작 (items={total})")
    print(f"    JA: male={JA_MALE}, female={JA_FEMALE} (기존 Chirp3 유지)")
    print(f"    KO: male={KO_MALE}, female={KO_FEMALE} (Neural12로 변경)")
    print(f"    gaps: gloss={GLOSS_GAP_MS}ms, comma={COMMA_GAP_MS}ms")
    print(f"    괄호 처리: 한국어에서 괄호 및 내용 완전 제거\n")

    processed = 0
    success = 0
    fails: List[str] = []

    for i, item in enumerate(items):
        lemma = item.get("lemma", "")
        kana = item.get("kana", "")
        romaji = item.get("romaji", "")
        ko_gloss_raw = item.get("koGloss", "") or item.get("koChirpScript", "")

        if not lemma or not kana or not romaji or not ko_gloss_raw:
            print(f"[{i+1}/{total}] 건너뜀: 필수 필드 누락 → {romaji}")
            continue

        # 출력 경로 확인
        word_folder = sanitize_filename(romaji)
        out_dir = os.path.normpath(os.path.join("jlpt", "n5", word_folder))
        gloss_path = os.path.join(out_dir, "gloss.mp3")
        word_path = os.path.join(out_dir, "word.mp3")

        # 기존 word.mp3가 있는지 확인 (없으면 건너뜀)
        if not os.path.exists(word_path):
            print(f"[{i+1}/{total}] 건너뜀: word.mp3 없음 → {word_path}")
            continue

        processed += 1
        v = voices_for_index(i)
        print(f"[{processed}] '{lemma}({kana})' → {gloss_path}")
        print(f"    ja={v['ja']}, ko={v['ko']} (gender={v['gender']})")

        # 기존 word.mp3 로드
        try:
            word_seg = AudioSegment.from_mp3(word_path)
            word_seg = loudness_normalize(word_seg, TARGET_DBFS)
        except Exception as e:
            print(f"  ❌ word.mp3 로드 실패: {e}")
            fails.append(f"{romaji}\tWORD_LOAD_FAIL:{e}")
            continue

        # 한국어 뜻 정리 (괄호 완전 제거)
        ko_gloss = clean_ko_gloss_strict(ko_gloss_raw)
        if not ko_gloss:
            print(f"  ⚠️ 한국어 뜻 비어있음: '{ko_gloss_raw}'")
            fails.append(f"{romaji}\tEMPTY_KOGLOSS")
            continue

        print(f"    원본: '{ko_gloss_raw}'")
        print(f"    정리: '{ko_gloss}'")

        # 한국어 음성 합성 (콤마 분할 적용)
        ko_candidates = [v["ko"]] + (
            KO_MALE_FALLBACKS if v["gender"] == "male" else KO_FEMALE_FALLBACKS
        )
        ko_seg = synthesize_with_commas_try_voices(
            tts, ko_gloss, "ko-KR", COMMA_GAP_MS, ko_candidates
        )

        if ko_seg is None or len(ko_seg) == 0:
            print("  ❌ 한국어 음성 합성 실패")
            fails.append(f"{romaji}\tKO_SYNTH_FAIL")
            continue

        # gloss.mp3 조합: word + 1초 무음 + 한국어
        gloss_seg = word_seg + AudioSegment.silent(duration=GLOSS_GAP_MS) + ko_seg
        gloss_seg = loudness_normalize(gloss_seg, TARGET_DBFS)

        # 저장
        try:
            os.makedirs(out_dir, exist_ok=True)
            gloss_seg.export(gloss_path, format="mp3")
            print(f"  ✅ gloss.mp3 교체 완료")
            success += 1
        except Exception as e:
            print(f"  ❌ gloss.mp3 저장 실패: {e}")
            fails.append(f"{romaji}\tGLOSS_SAVE_FAIL:{e}")

    # 결과 정리
    print(f"\n📊 처리 완료:")
    print(f"    처리 대상: {processed}개")
    print(f"    성공: {success}개")
    print(f"    실패: {len(fails)}개")

    if fails:
        with open("gloss_재생성_실패_목록.txt", "w", encoding="utf-8") as f:
            f.write("\n".join(fails) + "\n")
        print(f"⚠️ 실패 목록 → 'gloss_재생성_실패_목록.txt' 저장")
    else:
        print("✅ 모든 gloss.mp3 파일 재생성 완료!")

if __name__ == "__main__":
    json_file = sys.argv[1] if len(sys.argv) > 1 else "jlpt_n5_vocabs.json"
    if not os.path.exists(json_file):
        print(f"❌ JSON 파일을 찾을 수 없습니다: {json_file}")
        sys.exit(1)

    print(f"📂 사용할 JSON 파일: {json_file}")
    process_gloss_only(json_file)