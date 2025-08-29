# make_word_gloss.py
# -*- coding: utf-8 -*-
"""
JSON(배열/단일)로부터 <level>/<lemma>/{word,gloss}.mp3 생성(항상 덮어쓰기).

요구사항:
- 보이스: 모든 합성(en/KR 모두) en-US(Chirp3 HD) 사용.
  - 남성: en-US-Chirp3-HD-Charon
  - 여성: en-US-Chirp3-HD-Laomedeia
  - 항목별 순환: 남 → 여 → 남 → 여 ...
- word.mp3: lemma(영문) 합성
- gloss.mp3: word.mp3 + GLOSS_GAP_MS 무음 + koGloss(한국어 Neural2) 합성
  - Charon(영문 남성) → 한국어 남성(기본: ko-KR-Neural2-C)
  - Laomedeia(영문 여성) → 한국어 여성(기본: ko-KR-Neural2-B)
  - koGloss 내 '~' → '무엇무엇'
  - koGloss 내 쉼표(,)마다 COMMA_GAP_MS 무음 삽입
- 레벨 폴더: '입문'→starter, '기초'→elementary, '중급'→intermediate, '중상급'→upper, '고급'→advanced
- 기존 파일은 항상 덮어쓰기.

필수: pip install google-cloud-texttospeech pydub, FFmpeg, GCP ADC
환경변수(옵션):
  TARGET_DBFS=-16.0, GLOSS_GAP_MS=1000, COMMA_GAP_MS=500, MAX_RETRY=2, RETRY_BACKOFF_SEC=0.8
  EN_MALE, EN_FEMALE, KO_MALE_NEURAL, KO_FEMALE_NEURAL                 # 일반 남/여 기본값
  KO_NEURAL_FOR_CHARON, KO_NEURAL_FOR_LAOMEDEIA                         # 영문 보이스별 강제 매핑(우선)
  KO_MALE_FALLBACKS, KO_FEMALE_FALLBACKS                                # 합성 실패 시 한국어 폴백 후보(쉼표 구분)
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
GLOSS_GAP_MS = int(os.getenv("GLOSS_GAP_MS", "1000"))   # word→koGloss 간격(기본 1.0초)
COMMA_GAP_MS = int(os.getenv("COMMA_GAP_MS", "500"))    # koGloss 내 콤마 간격(기본 0.5초)
MAX_RETRY = int(os.getenv("MAX_RETRY", "2"))
RETRY_BACKOFF_SEC = float(os.getenv("RETRY_BACKOFF_SEC", "0.8"))

# en-US(Chirp3 HD)
EN_MALE   = os.getenv("EN_MALE", "en-US-Chirp3-HD-Charon")
EN_FEMALE = os.getenv("EN_FEMALE", "en-US-Chirp3-HD-Laomedeia")

# ko-KR(Neural2) 기본값
# 주: 서비스 지역/프로젝트별로 존재 보이스가 다를 수 있습니다.
KO_MALE_NEURAL   = os.getenv("KO_MALE_NEURAL",   "ko-KR-Neural2-C")  # 남성 기본(광범위하게 존재)
KO_FEMALE_NEURAL = os.getenv("KO_FEMALE_NEURAL", "ko-KR-Neural2-B")  # 여성 기본

# 영문 보이스명 기반 강제 매핑(최우선)
KO_NEURAL_FOR_CHARON    = os.getenv("KO_NEURAL_FOR_CHARON",    "ko-KR-Neural2-C")  # 남성
KO_NEURAL_FOR_LAOMEDEIA = os.getenv("KO_NEURAL_FOR_LAOMEDEIA", "ko-KR-Neural2-B")  # 여성

# 폴백 후보(쉼표로 구분; 왼쪽부터 시도)
def _parse_list(s: str) -> List[str]:
    return [x.strip() for x in s.split(",") if x.strip()]

KO_MALE_FALLBACKS   = _parse_list(os.getenv("KO_MALE_FALLBACKS",
                                            "ko-KR-Neural2-C,ko-KR-Neural2-B,ko-KR-Neural2-A,ko-KR-Standard-D,ko-KR-Standard-C"))
KO_FEMALE_FALLBACKS = _parse_list(os.getenv("KO_FEMALE_FALLBACKS",
                                            "ko-KR-Neural2-B,ko-KR-Neural2-A,ko-KR-Standard-A,ko-KR-Standard-B"))

LEVEL_MAP = [
    ("고급",   "advanced"),
    ("중상급", "upper"),
    ("중급",   "intermediate"),
    ("기초",   "elementary"),
    ("입문",   "starter"),
]

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

def level_folder_from_categories(categories: Any) -> Optional[str]:
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

def build_output_paths(categories: Any, lemma: str) -> Dict[str, str]:
    level = level_folder_from_categories(categories)
    if level is None:
        raise ValueError("LEVEL_TAG_MISSING")
    word_folder = sanitize_filename(lemma)
    out_dir = os.path.normpath(os.path.join(level, word_folder))
    os.makedirs(out_dir, exist_ok=True)
    return {
        "dir": out_dir,
        "word": os.path.join(out_dir, "word.mp3"),
        "gloss": os.path.join(out_dir, "gloss.mp3"),
    }

def clean_ko_gloss(text: str) -> str:
    """
    koGloss 전처리:
      - '~' → '무엇무엇'
      - 품사 약어 제거(adj., n., art., ...)
      - 공백/구두점 정리
    """
    if not text:
        return ""
    s = normalize_spaces(text)
    s = s.replace("~", "무엇무엇")
    s = re.sub(r"\b(?:adj|adv|n|v|vt|vi|prep|conj|pron|art|int|interj|aux|det|num)\.\s*", "", s, flags=re.I)
    s = normalize_spaces(s).strip(" ;,·")
    return s

# ===== 성별 순환 & 보이스 매핑 =====
def is_male(index_zero_based: int) -> bool:
    return (index_zero_based % 2 == 0)  # 0,2,4,... 남성 / 1,3,5,... 여성

def voices_for_index(idx0: int) -> Dict[str, str]:
    """
    1) en 보이스는 기존 순환 규칙(남/여)
    2) ko 보이스는 en 보이스명(Charon/Laomedeia)에 '강제 매핑' 우선 적용
       - 그 외 en 보이스명일 때만 남/여 기본값 사용
    """
    if is_male(idx0):
        en = EN_MALE
    else:
        en = EN_FEMALE

    if "Charon" in en:
        ko = KO_NEURAL_FOR_CHARON
        gender = "male"
    elif "Laomedeia" in en:
        ko = KO_NEURAL_FOR_LAOMEDEIA
        gender = "female"
    else:
        gender = "male" if is_male(idx0) else "female"
        ko = KO_MALE_NEURAL if gender == "male" else KO_FEMALE_NEURAL

    return {"en": en, "ko": ko, "gender": gender}

# ===== TTS =====
def tts_client() -> texttospeech.TextToSpeechClient:
    return texttospeech.TextToSpeechClient()

def synthesize_lang(tts: texttospeech.TextToSpeechClient,
                    text: str,
                    voice_name: str,
                    language_code: str) -> Optional[AudioSegment]:
    """주어진 언어코드/보이스로 단일 합성."""
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
                # 최종 실패
                print(f"  ❌ TTS 실패(name={voice_name}, lang={language_code}): {e}")
                return None
    return None

def synthesize_lang_try_voices(tts: texttospeech.TextToSpeechClient,
                               text: str,
                               language_code: str,
                               voices: List[str]) -> Optional[AudioSegment]:
    """보이스 후보 리스트를 순차 시도."""
    last_err = None
    for idx, vname in enumerate([v for v in voices if v]):
        seg = synthesize_lang(tts, text, vname, language_code)
        if seg is not None and len(seg) > 0:
            if idx > 0:
                print(f"  ↪︎ 사용 가능 보이스로 대체: {vname}")
            return seg
        last_err = vname
    if last_err:
        print(f"  ❌ 모든 보이스 실패(ko candidates tried: {', '.join(voices)})")
    return None

def synthesize_with_commas_try_voices(tts: texttospeech.TextToSpeechClient,
                                      text: str,
                                      language_code: str,
                                      comma_gap_ms: int,
                                      voices: List[str]) -> Optional[AudioSegment]:
    """쉼표 분할 합성에 대해 보이스 후보 리스트를 순차 시도."""
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
                print(f"  ↪︎ ko 보이스 대체: {vname}")
            return loudness_normalize(merged, TARGET_DBFS)
    print(f"  ❌ koGloss 합성 실패(ko candidates tried: {', '.join(voices)})")
    return None

# ===== IO =====
def load_items(json_path: str) -> List[Dict[str, Any]]:
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, list) else [data]

# ===== 메인 파이프라인 =====
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

    total = len(items)
    print(f"🎧 Start (items={total})")
    print(f"    EN: male={EN_MALE}, female={EN_FEMALE}")
    print(f"    KO defaults: male={KO_MALE_NEURAL}, female={KO_FEMALE_NEURAL}")
    print(f"    KO forced:   Charon→{KO_NEURAL_FOR_CHARON}, Laomedeia→{KO_NEURAL_FOR_LAOMEDEIA}")
    print(f"    gaps: gloss={GLOSS_GAP_MS}ms, comma={COMMA_GAP_MS}ms")
    print("📝 모드: word=en-US(Chirp3 HD), gloss=ko-KR(Neural2), 성별 순환(남→여→남…), 덮어쓰기\n")

    last_saved: Optional[str] = None
    fails: List[str] = []

    for i, it in enumerate(items):
        lemma = (it.get("lemma") or "").strip()
        categories = it.get("categories")
        ko_gloss_raw = it.get("koGloss") or ""

        if not lemma:
            print(f"[{i+1}/{total}] 건너뜀: lemma 없음")
            continue

        # 경로
        try:
            paths = build_output_paths(categories, lemma)
        except ValueError as ve:
            if str(ve) == "LEVEL_TAG_MISSING":
                print(f"[{i+1}/{total}] '{lemma}' ❌ 레벨 태그 미검출 → 처리 중단")
                try:
                    with open("마지막 생성 단어.txt", "w", encoding="utf-8") as f:
                        f.write((last_saved or '').strip())
                except Exception:
                    pass
                return
            print(f"[{i+1}/{total}] '{lemma}' 경로 오류: {ve}")
            fails.append(f"{lemma}\tPATH_ERROR:{ve}")
            continue

        v = voices_for_index(i)
        print(f"[{i+1}/{total}] '{lemma}' → dir='{paths['dir']}', en={v['en']}, ko={v['ko']} (gender={v['gender']})")

        # 1) word.mp3 (en-US)
        word_seg = synthesize_lang_try_voices(tts, lemma, "en-US", [v["en"]])
        if word_seg is None or len(word_seg) == 0:
            print("  ❌ word 합성 실패")
            fails.append(f"{lemma}\tWORD_SYNTH_FAIL:{v['en']}")
            continue
        try:
            word_seg.export(paths["word"], format="mp3")
            print("  ✅ word.mp3 저장(덮어쓰기)")
        except Exception as e:
            print(f"  ⚠️ word 저장 실패: {e}")
            fails.append(f"{lemma}\tWORD_SAVE_FAIL:{e}")
            continue

        # 2) gloss.mp3 = word + GLOSS_GAP_MS + koGloss(ko-KR), 콤마마다 COMMA_GAP_MS
        ko_gloss = clean_ko_gloss(ko_gloss_raw)
        if not ko_gloss:
            print("  ⚠️ koGloss 비어있음 → gloss 생략")
            last_saved = lemma
            continue

        # 성별별 한국어 폴백 후보 구성
        ko_candidates = [v["ko"]] + (KO_MALE_FALLBACKS if v["gender"] == "male" else KO_FEMALE_FALLBACKS)

        ko_seg = synthesize_with_commas_try_voices(tts, ko_gloss, "ko-KR", COMMA_GAP_MS, ko_candidates)
        if ko_seg is None or len(ko_seg) == 0:
            fails.append(f"{lemma}\tKOGLOSS_SYNTH_FAIL:{'|'.join(ko_candidates)}")
            continue

        gloss_seg = word_seg + AudioSegment.silent(duration=GLOSS_GAP_MS) + ko_seg
        gloss_seg = loudness_normalize(gloss_seg, TARGET_DBFS)

        try:
            gloss_seg.export(paths["gloss"], format="mp3")
            print("  ✅ gloss.mp3 저장(덮어쓰기)")
            last_saved = lemma
        except Exception as e:
            print(f"  ⚠️ gloss 저장 실패: {e}")
            fails.append(f"{lemma}\tGLOSS_SAVE_FAIL:{e}")
            continue

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
    json_file = sys.argv[1] if len(sys.argv) > 1 else "cefr_vocabs.json"
    process(json_file)
