# make_jlpt_audio.py
# -*- coding: utf-8 -*-
"""
JLPT 일본어 단어 오디오 생성기

기능:
- jlpt_n5_vocabs.json으로부터 일본어 단어 오디오 파일 생성
- word.mp3: 일본어 단어(kana) 음성 합성
- gloss.mp3: 일본어 단어 + 무음 + 한국어 뜻 합성
- example.mp3: 일본어 예문 음성 합성

출력 구조:
jlpt/n5/{romaji}/
├── word.mp3     (kana 읽기)
├── gloss.mp3    (kana + 한국어 뜻)
└── example.mp3  (예문)

보이스:
- 일본어: ja-JP-Chirp3-HD-Orus (남성), ja-JP-Chirp3-HD-Achernar (여성) 순환
- 한국어 (gloss): ko-KR-Neural2-C (남성), ko-KR-Neural2-B (여성) 순환
- 한국어 (example): ko-KR-Chirp3-HD-Orus (남성), ko-KR-Chirp3-HD-Achernar (여성) 순환

필수: pip install google-cloud-texttospeech pydub, FFmpeg, GCP ADC 설정
"""

import os

os.environ["GRPC_DNS_RESOLVER"] = "native"

import sys, re, json, time
from io import BytesIO
from typing import Any, Dict, List, Optional

from google.cloud import texttospeech
from pydub import AudioSegment

# ===== 파라미터 =====
TARGET_DBFS = float(os.getenv("TARGET_DBFS", "-16.0"))
GLOSS_GAP_MS = int(os.getenv("GLOSS_GAP_MS", "1000"))  # word→koGloss 간격(기본 1.0초)
COMMA_GAP_MS = int(os.getenv("COMMA_GAP_MS", "500"))  # koGloss 내 콤마 간격(기본 0.5초)
MAX_RETRY = int(os.getenv("MAX_RETRY", "2"))
RETRY_BACKOFF_SEC = float(os.getenv("RETRY_BACKOFF_SEC", "0.8"))

# 일본어 보이스 (Chirp3 HD) - Orus/Achernar 순환
JA_MALE = os.getenv("JA_MALE", "ja-JP-Chirp3-HD-Orus")  # 일본어 남성 보이스
JA_FEMALE = os.getenv("JA_FEMALE", "ja-JP-Chirp3-HD-Achernar")  # 일본어 여성 보이스

# 한국어 보이스 (gloss용 Neural2)
KO_NEURAL_MALE = os.getenv("KO_NEURAL_MALE", "ko-KR-Neural2-C")  # 한국어 Neural2 남성
KO_NEURAL_FEMALE = os.getenv("KO_NEURAL_FEMALE", "ko-KR-Neural2-B")  # 한국어 Neural2 여성

# 한국어 보이스 (example용 Chirp3)
KO_CHIRP_MALE = os.getenv("KO_CHIRP_MALE", "ko-KR-Chirp3-HD-Orus")  # 한국어 Chirp3 남성
KO_CHIRP_FEMALE = os.getenv("KO_CHIRP_FEMALE", "ko-KR-Chirp3-HD-Achernar")  # 한국어 Chirp3 여성


# 폴백 후보
def _parse_list(s: str) -> List[str]:
    return [x.strip() for x in s.split(",") if x.strip()]


JA_MALE_FALLBACKS = _parse_list(
    os.getenv(
        "JA_MALE_FALLBACKS",
        "ja-JP-Chirp3-HD-Orus,ja-JP-Neural2-C,ja-JP-Neural2-D,ja-JP-Standard-C,ja-JP-Standard-D",
    )
)
JA_FEMALE_FALLBACKS = _parse_list(
    os.getenv(
        "JA_FEMALE_FALLBACKS",
        "ja-JP-Chirp3-HD-Achernar,ja-JP-Neural2-B,ja-JP-Standard-B,ja-JP-Standard-A",
    )
)

# gloss용 한국어 Neural2 폴백
KO_NEURAL_MALE_FALLBACKS = _parse_list(
    os.getenv(
        "KO_NEURAL_MALE_FALLBACKS",
        "ko-KR-Neural2-C,ko-KR-Standard-C,ko-KR-Standard-D",
    )
)
KO_NEURAL_FEMALE_FALLBACKS = _parse_list(
    os.getenv(
        "KO_NEURAL_FEMALE_FALLBACKS",
        "ko-KR-Neural2-B,ko-KR-Standard-A,ko-KR-Standard-B",
    )
)

# example용 한국어 Chirp3 폴백
KO_CHIRP_MALE_FALLBACKS = _parse_list(
    os.getenv(
        "KO_CHIRP_MALE_FALLBACKS",
        "ko-KR-Chirp3-HD-Orus,ko-KR-Neural2-C,ko-KR-Standard-C",
    )
)
KO_CHIRP_FEMALE_FALLBACKS = _parse_list(
    os.getenv(
        "KO_CHIRP_FEMALE_FALLBACKS",
        "ko-KR-Chirp3-HD-Achernar,ko-KR-Neural2-B,ko-KR-Standard-A",
    )
)


# ===== 유틸 =====
def normalize_spaces(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def sanitize_filename(name: str) -> str:
    name = re.sub(r'[\\/*?:"<>|]', "", str(name or ""))
    return name.strip().lower() or "unnamed"


def loudness_normalize(seg: AudioSegment, target_dbfs: float) -> AudioSegment:
    if seg.duration_seconds <= 0 or seg.dBFS == float("-inf"):
        return seg
    return seg.apply_gain(target_dbfs - seg.dBFS)


def build_output_paths(romaji: str, level: str = "n5") -> Dict[str, str]:
    """JLPT 출력 경로 생성"""
    word_folder = sanitize_filename(romaji)
    out_dir = os.path.normpath(os.path.join("jlpt", level, word_folder))
    os.makedirs(out_dir, exist_ok=True)
    return {
        "dir": out_dir,
        "word": os.path.join(out_dir, "word.mp3"),
        "gloss": os.path.join(out_dir, "gloss.mp3"),
        "example": os.path.join(out_dir, "example.mp3"),
    }


def clean_ko_gloss(text: str) -> str:
    """한국어 뜻 전처리 - 괄호 및 괄호 내용 완전 제거"""
    if not text:
        return ""
    s = normalize_spaces(text)

    # 물결 표시(~)를 '무엇무엇'으로 치환
    s = s.replace("~", "무엇무엇")

    # 괄호 및 괄호 안의 내용 완전히 제거
    s = re.sub(r"[（(][^）)]*[）)]", "", s)

    # 품사 약어 제거 (영어, 한국어 품사 표시 모두)
    s = re.sub(
        r"\b(?:pron|n|v|adj|adv|prep|conj|int|interj|aux|det|num)\.\s*",
        "",
        s,
        flags=re.I,
    )
    # 한국어 품사 표시 제거 (명사, 동사, 형용사, 부사, 감탄사 등)
    s = re.sub(
        r"\b(?:명사|동사|형용사|부사|감탄사|대명사|전치사|접속사|조동사|관사|수사)\.\s*",
        "",
        s,
    )

    # 특수문자 제거 (슬래시 등)
    s = re.sub(r"[/\\|<>\"']", " ", s)

    s = normalize_spaces(s).strip(" ;,·")
    return s


def clean_japanese_text(text: str) -> str:
    """일본어 텍스트 정리 - 특수문자 및 괄호 처리"""
    if not text:
        return ""
    s = normalize_spaces(text)

    # 괄호와 괄호 안의 내용 제거 (일본어 포함)
    s = re.sub(r"[（(][^）)]*[）)]", "", s)

    # 특수문자 제거 (슬래시 등)
    s = re.sub(r"[/\\|<>\"']", " ", s)

    return normalize_spaces(s)


# ===== 성별 순환 =====
def is_male(index_zero_based: int) -> bool:
    return index_zero_based % 2 == 0  # 0,2,4,... 남성 / 1,3,5,... 여성


def voices_for_index(idx0: int) -> Dict[str, str]:
    """인덱스별 보이스 선택"""
    if is_male(idx0):
        return {
            "ja": JA_MALE,
            "ko_neural": KO_NEURAL_MALE,  # gloss용
            "ko_chirp": KO_CHIRP_MALE,    # example용
            "gender": "male"
        }
    else:
        return {
            "ja": JA_FEMALE,
            "ko_neural": KO_NEURAL_FEMALE,  # gloss용
            "ko_chirp": KO_CHIRP_FEMALE,    # example용
            "gender": "female"
        }


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


def ensure_parent_dir(path: str) -> None:
    d = os.path.dirname(os.path.normpath(path))
    if d and not os.path.exists(d):
        os.makedirs(d, exist_ok=True)


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


def synthesize_mixed_script(
    tts: texttospeech.TextToSpeechClient,
    mixed_text: str,
    voices: Dict[str, str],
    ja_candidates: List[str],
    ko_chirp_candidates: List[str],  # example용 Chirp3 보이스
) -> Optional[AudioSegment]:
    """일본어/한국어 혼합 텍스트를 각각 해당 언어 보이스로 합성 (example용)"""
    segments = split_mixed_text(mixed_text)
    if not segments:
        return None

    merged = AudioSegment.empty()

    for lang, text in segments:
        if lang == "ja":
            # 일본어 부분 - 특수문자 처리 후 일본어 Chirp3 보이스 사용
            cleaned_text = clean_japanese_text(text)
            seg = synthesize_lang_try_voices(tts, cleaned_text, "ja-JP", ja_candidates)
        else:
            # 한국어 부분 - example용이므로 Chirp3 보이스 사용, 쉼표 분할 적용
            cleaned_text = clean_ko_gloss(text)
            seg = synthesize_with_commas_try_voices(
                tts, cleaned_text, "ko-KR", COMMA_GAP_MS, ko_chirp_candidates
            )

        if seg is None or len(seg) == 0:
            print(
                f"    ⚠️ {lang} 부분 합성 실패: '{text[:50]}{'...' if len(text) > 50 else ''}'"
            )
            return None

        merged += seg
        # 세그먼트 간 짧은 무음 추가 (200ms)
        merged += AudioSegment.silent(duration=200)

    return loudness_normalize(merged, TARGET_DBFS)


# ===== 메인 파이프라인 =====
def extract_level_from_filename(json_path: str) -> str:
    """JSON 파일명에서 JLPT 레벨 추출 (예: jlpt_n4_vocabs.json -> n4)"""
    import re
    filename = os.path.basename(json_path)
    match = re.search(r'jlpt_?(n[1-5])', filename, re.IGNORECASE)
    return match.group(1).lower() if match else "n5"

def process(json_path: str) -> None:
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

    level = extract_level_from_filename(json_path)
    total = len(items)
    print(f"🎧 JLPT 오디오 생성 시작 (items={total}, level={level})")
    print(f"    JA: male={JA_MALE}, female={JA_FEMALE}")
    print(f"    KO(gloss): male={KO_NEURAL_MALE}, female={KO_NEURAL_FEMALE}")
    print(f"    KO(example): male={KO_CHIRP_MALE}, female={KO_CHIRP_FEMALE}")
    print(f"    gaps: gloss={GLOSS_GAP_MS}ms, comma={COMMA_GAP_MS}ms")
    print(
        "📝 모드: word=ja-JP(Chirp3 HD), gloss=ja-JP(Chirp3)+ko-KR(Neural2), example=ja-JP(Chirp3)+ko-KR(Chirp3), 성별 순환(남→여→남…)\n"
    )

    last_saved: Optional[str] = None
    fails: List[str] = []

    for i, item in enumerate(items):
        lemma = item.get("lemma", "")
        kana = item.get("kana", "")
        romaji = item.get("romaji", "")
        ko_gloss_raw = item.get("koGloss", "") or item.get("koChirpScript", "")
        example = item.get("example", "")
        audio_paths = item.get("audio", {})

        if not lemma or not kana or not romaji:
            print(
                f"[{i+1}/{total}] 건너뜀: 필수 필드 누락 → lemma={lemma}, kana={kana}, romaji={romaji}"
            )
            continue

        # 출력 경로 생성
        try:
            paths = build_output_paths(romaji, level)
        except Exception as e:
            print(f"[{i+1}/{total}] '{romaji}' 경로 오류: {e}")
            fails.append(f"{romaji}\tPATH_ERROR:{e}")
            continue

        # 폴더가 이미 존재하고 모든 파일이 있는지 확인
        if os.path.exists(paths["dir"]):
            has_word = os.path.exists(paths["word"])
            has_gloss = os.path.exists(paths["gloss"]) if ko_gloss_raw else True
            has_example = os.path.exists(paths["example"]) if item.get("koChirpScript", "") else True

            if has_word and has_gloss and has_example:
                print(f"[{i+1}/{total}] '{lemma}({kana})' → 이미 존재, 건너뜀")
                continue

        v = voices_for_index(i)
        print(
            f"[{i+1}/{total}] '{lemma}({kana})' → dir='{paths['dir']}', "
            f"ja={v['ja']}, ko_gloss={v['ko_neural']}, ko_example={v['ko_chirp']} (gender={v['gender']})"
        )

        # 1) word.mp3 (일본어 kana - Chirp3)
        ja_candidates = [v["ja"]] + (
            JA_MALE_FALLBACKS if v["gender"] == "male" else JA_FEMALE_FALLBACKS
        )
        word_seg = synthesize_lang_try_voices(tts, kana, "ja-JP", ja_candidates)

        if word_seg is None or len(word_seg) == 0:
            print("  ❌ word 합성 실패")
            fails.append(f"{romaji}\tWORD_SYNTH_FAIL:{v['ja']}")
            continue

        try:
            word_seg.export(paths["word"], format="mp3")
            print("  ✅ word.mp3 저장")

            # 추가 저장: audio.word (옵션)
            if audio_paths.get("word"):
                alt_path = os.path.normpath(audio_paths["word"])
                ensure_parent_dir(alt_path)
                word_seg.export(alt_path, format="mp3")
                print(f"    ↪︎ 추가 저장: {alt_path}")
        except Exception as e:
            print(f"  ⚠️ word 저장 실패: {e}")
            fails.append(f"{romaji}\tWORD_SAVE_FAIL:{e}")
            continue

        # 2) gloss.mp3 = kana(Chirp3) + 무음 + koGloss(Neural2)
        ko_gloss = clean_ko_gloss(ko_gloss_raw)
        if ko_gloss:
            # gloss용 Neural2 보이스 사용
            ko_neural_candidates = [v["ko_neural"]] + (
                KO_NEURAL_MALE_FALLBACKS if v["gender"] == "male" else KO_NEURAL_FEMALE_FALLBACKS
            )
            ko_seg = synthesize_with_commas_try_voices(
                tts, ko_gloss, "ko-KR", COMMA_GAP_MS, ko_neural_candidates
            )

            if ko_seg is not None and len(ko_seg) > 0:
                gloss_seg = (
                    word_seg + AudioSegment.silent(duration=GLOSS_GAP_MS) + ko_seg
                )
                gloss_seg = loudness_normalize(gloss_seg, TARGET_DBFS)

                try:
                    gloss_seg.export(paths["gloss"], format="mp3")
                    print("  ✅ gloss.mp3 저장 (Neural2)")

                    # 추가 저장: audio.gloss (옵션)
                    if audio_paths.get("gloss"):
                        alt_path = os.path.normpath(audio_paths["gloss"])
                        ensure_parent_dir(alt_path)
                        gloss_seg.export(alt_path, format="mp3")
                        print(f"    ↪︎ 추가 저장: {alt_path}")
                except Exception as e:
                    print(f"  ⚠️ gloss 저장 실패: {e}")
                    fails.append(f"{romaji}\tGLOSS_SAVE_FAIL:{e}")
            else:
                print("  ⚠️ koGloss 합성 실패")
                fails.append(f"{romaji}\tKOGLOSS_SYNTH_FAIL")
        else:
            print("  ⚠️ koGloss 비어있음 → gloss 생략")

        # 3) example.mp3 (koChirpScript - 일본어 Chirp3 / 한국어 Chirp3 분리 합성)
        ko_chirp_script = item.get("koChirpScript", "")
        if ko_chirp_script:
            # example용 Chirp3 보이스 사용
            ko_chirp_candidates = [v["ko_chirp"]] + (
                KO_CHIRP_MALE_FALLBACKS if v["gender"] == "male" else KO_CHIRP_FEMALE_FALLBACKS
            )
            example_seg = synthesize_mixed_script(
                tts, ko_chirp_script, v, ja_candidates, ko_chirp_candidates
            )

            if example_seg is not None and len(example_seg) > 0:
                try:
                    example_seg.export(paths["example"], format="mp3")
                    print("  ✅ example.mp3 저장 (koChirpScript - Chirp3 혼합)")

                    # 추가 저장: audio.example (옵션)
                    if audio_paths.get("example"):
                        alt_path = os.path.normpath(audio_paths["example"])
                        ensure_parent_dir(alt_path)
                        example_seg.export(alt_path, format="mp3")
                        print(f"    ↪︎ 추가 저장: {alt_path}")
                except Exception as e:
                    print(f"  ⚠️ example 저장 실패: {e}")
                    fails.append(f"{romaji}\tEXAMPLE_SAVE_FAIL:{e}")
            else:
                print("  ⚠️ koChirpScript 합성 실패")
                fails.append(f"{romaji}\tKOCHIRPSCRIPT_SYNTH_FAIL")
        else:
            print("  ⚠️ koChirpScript 비어있음 → example 생략")

        last_saved = romaji

    # 마무리
    try:
        with open("마지막 생성 단어.txt", "w", encoding="utf-8") as f:
            f.write((last_saved or "").strip())
    except Exception:
        pass

    if fails:
        with open("생성 실패 목록.txt", "w", encoding="utf-8") as f:
            f.write("\n".join(fails) + "\n")
        print(f"\n⚠️ 실패 {len(fails)}건 → '생성 실패 목록.txt' 기록")
    else:
        print("\n✅ 모든 항목 처리 완료(실패 없음)")


if __name__ == "__main__":
    json_file = sys.argv[1] if len(sys.argv) > 1 else "jlpt_n4_vocabs.json"
    process(json_file)