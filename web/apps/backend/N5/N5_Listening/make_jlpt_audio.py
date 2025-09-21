# -*- coding: utf-8 -*-
"""
make_jlpt_audio.py

기능 요약
- JSON 각 항목당 MP3 1개 생성
- 대화부: A/B 라벨이 있으면 A/B 보이스로 교차 합성, 없으면 전체를 A 보이스로 나레이션
- 질문부: "Question number ..." + question[*] (1개면 one, 여러 개면 번호 증가)
- 옵션부: 각 question 직후 Q(나레이터) 보이스로
          [라벨(A) → 2초대기 → 텍스트] 를 보기마다 수행
  * options가 dict이면(공통) 모든 질문에 동일 적용
  * options가 list[dict]이고 길이가 질문 수와 같으면 문항별 개별 옵션 적용
- 보이스: 항목 인덱스 기준 ja-JP 사용, A=Charon, B=Laomedeia, Q=Aoede
- 출력 속도: 기본 0.8배속(피치 유지, ffmpeg atempo), --tempo로 조정 가능
- 안전장치: 항목당 export 1회 강제, --purge-out 로 출력 폴더의 기존 .mp3 삭제

필수:
  pip install google-cloud-texttospeech pydub
  ffmpeg가 PATH에 있어야 합니다.

사용 예:
  python make_jlpt_audio.py --in N5_Listening.json --out N5_Listening_mix --purge-out
  python make_jlpt_audio.py --tempo 1.0
  python make_jlpt_audio.py --rotate ja-JP
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
# 유틸
# ----------------------
def sanitize_filename(name: str) -> str:
    return re.sub(r'[\\/*?:"<>| ]+', "_", str(name)).strip("_")


def parse_script_ordered(script: str) -> List[Tuple[str, str]]:
    """'A: ... B: ...' -> [('A','...'), ('B','...'), ...]
       라벨이 없으면 전체를 A 보이스로 나레이션 처리."""
    if not script or not isinstance(script, str):
        return []
    s = re.sub(r"\s+", " ", script).strip()
    tokens = re.split(r"(?i)\b([AB])\s*:\s*", s)
    if len(tokens) < 3:
        return [("A", s)]  # 라벨 없음 → 나레이션
    seq = []
    for i in range(1, len(tokens), 2):
        spk = tokens[i].upper()
        text = tokens[i + 1].strip()
        if spk in ("A", "B") and text:
            seq.append((spk, text))
    return seq


def normalize_questions(q_field: Any) -> List[str]:
    """str -> [str], list -> list[str], dict{'questions': [...]} -> list[str]"""
    if isinstance(q_field, list):
        return [str(x).strip() for x in q_field if str(x).strip()]
    if isinstance(q_field, dict):
        if "questions" in q_field and isinstance(q_field["questions"], list):
            return [str(x).strip() for x in q_field["questions"] if str(x).strip()]
        return []
    if isinstance(q_field, str):
        s = q_field.strip()
        return [s] if s else []
    return []


# 옵션 정규화: dict → [("A", "..."), ...] / list[dict] → [[("A","..."),...], [..], ...]
def _pairs_from_dict(d: Dict[str, Any]) -> List[Tuple[str, str]]:
    items = []
    for k, v in d.items():
        lab = str(k).strip().upper()
        if len(lab) == 1 and lab.isalpha():
            txt = str(v).strip()
            if txt:
                items.append((lab, txt))
    items.sort(key=lambda x: x[0])  # 알파벳 순
    return items


def normalize_options(opt_field: Any):
    """
    반환형:
      - 공통 옵션(dict 등) → {"mode": "broadcast", "sets": [ [("A","..."),("B","..."),...] ]}
      - 질문별 옵션(list[dict]) → {"mode": "per_question", "sets": [ [("A","...")...], [..], ... ]}
      - 없거나 비정상 → {"mode": "none", "sets": []}
    """
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


def synthesize(
    client: texttospeech.TextToSpeechClient,
    text: str,
    voice: texttospeech.VoiceSelectionParams,
) -> AudioSegment:
    if not text:
        return AudioSegment.silent(duration=0)
    synthesis_input = texttospeech.SynthesisInput(text=text)
    resp = client.synthesize_speech(
        input=synthesis_input, voice=voice, audio_config=AUDIO_CONFIG
    )
    return AudioSegment.from_file(BytesIO(resp.audio_content), format="mp3")


def purge_dir_mp3(out_dir: str):
    if not os.path.isdir(out_dir):
        return
    removed = 0
    for name in os.listdir(out_dir):
        if name.lower().endswith(".mp3"):
            try:
                os.remove(os.path.join(out_dir, name))
                removed += 1
            except Exception:
                pass
    print(f"[PURGE] {out_dir} 내 기존 MP3 {removed}개 삭제")


# ----------------------
# 보이스 로테이션
# ----------------------
def build_voice_set(language_code: str):
    """언어코드(ja-JP)에 맞는 A/B/Q 보이스 세트 생성"""
    return {
        "A": texttospeech.VoiceSelectionParams(
            language_code=language_code, name=f"{language_code}-Chirp3-HD-Charon"
        ),
        "B": texttospeech.VoiceSelectionParams(
            language_code=language_code, name=f"{language_code}-Chirp3-HD-Laomedeia"
        ),
        "Q": texttospeech.VoiceSelectionParams(
            language_code=language_code, name=f"{language_code}-Chirp3-HD-Aoede"
        ),
    }


def parse_rotation_list(s: str) -> List[str]:
    codes = [x.strip() for x in s.split(",") if x.strip()]
    if not codes:
        codes = ["ja-JP"]  # 일본어 기본값
    return codes


# ----------------------
# atempo 체인(배속) 구성
# ----------------------
def atempo_chain(t: float) -> str:
    """ffmpeg atempo는 0.5~2.0 범위만 허용 → 범위를 벗어나면 체인으로 분해"""
    if t <= 0:
        raise ValueError("tempo must be > 0")
    chain = []
    while t < 0.5:
        chain.append("atempo=0.5")
        t /= 0.5
    while t > 2.0:
        chain.append("atempo=2.0")
        t /= 2.0
    chain.append(f"atempo={t:.6f}")
    return ",".join(chain)


# ----------------------
# 메인
# ----------------------
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--in", dest="input_json", default="N5_Listening.json", help="입력 JSON 경로")
    parser.add_argument("--out", dest="out_dir", default="N5_Listening_mix", help="출력 폴더")
    parser.add_argument("--gap-turn", dest="gap_turn_ms", type=int, default=250, help="A/B 사이 침묵(ms)")
    parser.add_argument("--gap-q", dest="gap_q_ms", type=int, default=400, help="대화→질문 블록 앞 침묵(ms)")
    parser.add_argument("--gap-qprefix", dest="gap_qprefix_ms", type=int, default=220, help="프리픽스→질문 사이 침묵(ms)")
    parser.add_argument("--gap-opt", dest="gap_opt_ms", type=int, default=180, help="옵션들 사이 침묵(ms)")
    parser.add_argument(
        "--gap-opt-hold",
        dest="gap_opt_hold_ms",
        type=int,
        default=1500,
        help="옵션 라벨과 본문 사이 대기(ms). 기본 2000=2초",
    )
    parser.add_argument(
        "--gap-q2opt",
        dest="gap_q2opt_ms",
        type=int,
        default=1500,
        help="질문 끝난 직후 옵션 시작까지 대기(ms). 기본 1500=1.5초",
    )
    parser.add_argument("--prefix-single", dest="prefix_single", default="Question number one.", help="단일 질문 프리픽스")
    parser.add_argument("--prefix-format", dest="prefix_format", default="Question number {n}.", help="다수 질문 프리픽스 포맷")
    parser.add_argument("--purge-out", dest="purge_out", action="store_true", help="시작 전 출력 폴더의 기존 MP3 삭제")
    parser.add_argument(
        "--rotate",
        dest="rotate",
        default="ja-JP",
        help="항목별 보이스 로테이션(콤마 구분). 예: ja-JP",
    )
    parser.add_argument(
        "--tempo",
        dest="tempo",
        type=float,
        default=0.8,
        help="전체 출력 배속(피치 유지). 예: 0.8=느리게, 1.0=기본, 1.25=빠르게",
    )

    args = parser.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)
    if args.purge_out:
        purge_dir_mp3(args.out_dir)

    try:
        client = texttospeech.TextToSpeechClient()
    except Exception as e:
        raise SystemExit(f"Google Cloud TTS 클라이언트 생성 실패: {e}")

    try:
        with open(args.input_json, "r", encoding="utf-8") as f:
            items = json.load(f)
    except Exception as e:
        raise SystemExit(f"입력 JSON 로드 실패: {e}")

    if not isinstance(items, list):
        raise SystemExit("입력 JSON 루트는 list 여야 합니다.")

    gap_turn = AudioSegment.silent(duration=max(0, args.gap_turn_ms))
    gap_q = AudioSegment.silent(duration=max(0, args.gap_q_ms))
    gap_qprefix = AudioSegment.silent(duration=max(0, args.gap_qprefix_ms))
    gap_opt = AudioSegment.silent(duration=max(0, args.gap_opt_ms))
    # gap_* 만들던 곳에 추가
    gap_q2opt = AudioSegment.silent(duration=max(0, args.gap_q2opt_ms))
    gap_opt_hold = AudioSegment.silent(duration=max(0, args.gap_opt_hold_ms))  # 라벨→본문 대기(기본 2초)

    # 로테이션 코드 목록 준비
    rotation_codes = parse_rotation_list(args.rotate)
    voice_cache = {}  # language_code -> built voices

    # atempo 파라미터 구성
    tempo = float(args.tempo)
    if tempo <= 0:
        raise SystemExit("--tempo must be > 0")
    export_params = []
    if abs(tempo - 1.0) > 1e-6:
        export_params = ["-filter:a", atempo_chain(tempo)]

    total = len(items)
    print(f"총 {total}건 처리 → 출력: {args.out_dir}")
    print(f"보이스 로테이션: {rotation_codes}")
    print(f"출력 배속(피치 유지): {tempo}")

    for idx, it in enumerate(items, 1):
        item_id = sanitize_filename(it.get("id") or f"item_{idx:03d}")
        script = it.get("script", "")
        questions = normalize_questions(it.get("question"))
        options_norm = normalize_options(it.get("options"))

        # 이번 항목의 언어코드/보이스 세트 결정 (라운드 로빈)
        lang = rotation_codes[(idx - 1) % len(rotation_codes)]
        if lang not in voice_cache:
            voice_cache[lang] = build_voice_set(lang)
        VOICES = voice_cache[lang]  # {"A":..., "B":..., "Q":...}

        print(f"[{idx}/{total}] id={item_id}  |  voice={lang}")

        audio_mix = AudioSegment.silent(duration=0)
        export_count = 0  # 항목당 export 1회만 허용

        # (1) 대화부
        seq = parse_script_ordered(script)
        if seq:
            for spk, text in seq:
                voice = VOICES["A"] if spk == "A" else VOICES["B"]
                try:
                    seg = synthesize(client, text, voice)
                except Exception as e:
                    print(f"  ! 합성 실패({spk}): {e}")
                    continue
                audio_mix += seg
                audio_mix += gap_turn
        else:
            print("  - 대화부 스킵(라벨 A:/B: 미검출)")

        # (2) 질문부 + 옵션부
        # (2) 질문부 + 옵션부
        if questions:
            audio_mix += gap_q
            opt_mode = options_norm["mode"]
            opt_sets = options_norm["sets"]  # list of list of pairs

            if len(questions) == 1:
                # 질문 프리픽스
                audio_mix += synthesize(client, args.prefix_single, VOICES["Q"])
                audio_mix += gap_qprefix
                # 질문 본문
                audio_mix += synthesize(client, questions[0], VOICES["Q"])
                print("  - question ▶ 'Question number one.' + question")

                # ▼ 추가: 질문 → 옵션 사이 1.5초 대기
                audio_mix += gap_q2opt

                # 옵션 읽기
                opts = []
                if opt_mode == "per_question" and len(opt_sets) >= 1:
                    opts = opt_sets[0]
                elif opt_mode == "broadcast" and len(opt_sets) == 1:
                    opts = opt_sets[0]
                if opts:
                    for lab, txt in opts:
                        # 보기 사이 간격
                        audio_mix += gap_opt
                        # 라벨 → 2초 대기 → 본문
                        audio_mix += synthesize(client, f"{lab}", VOICES["Q"])
                        audio_mix += gap_opt_hold
                        audio_mix += synthesize(client, txt, VOICES["Q"])
                    print(
                        f"  - options ▶ {len(opts)}개 낭독(질문→{args.gap_q2opt_ms}ms→옵션 | 라벨→{args.gap_opt_hold_ms}ms→본문)"
                    )
                else:
                    print("  - options 없음/미정규화")
            else:
                # 여러 질문
                for i, qtext in enumerate(questions, start=1):
                    # 질문 프리픽스 + 본문
                    audio_mix += synthesize(client, args.prefix_format.format(n=i), VOICES["Q"])
                    audio_mix += gap_qprefix
                    audio_mix += synthesize(client, qtext, VOICES["Q"])

                    # ▼ 추가: 질문 → 옵션 사이 1.5초 대기
                    audio_mix += gap_q2opt

                    # 해당 질문의 옵션 선택
                    opts = []
                    if opt_mode == "per_question" and len(opt_sets) >= i:
                        opts = opt_sets[i - 1]
                    elif opt_mode == "broadcast" and len(opt_sets) == 1:
                        opts = opt_sets[0]
                    # 옵션 읽기
                    if opts:
                        for lab, txt in opts:
                            audio_mix += gap_opt
                            audio_mix += synthesize(client, f"{lab}", VOICES["Q"])
                            audio_mix += gap_opt_hold
                            audio_mix += synthesize(client, txt, VOICES["Q"])
                        print(
                            f"  - question {i} options ▶ {len(opts)}개 낭독(질문→{args.gap_q2opt_ms}ms→옵션 | 라벨→{args.gap_opt_hold_ms}ms→본문)"
                        )
                    else:
                        print(f"  - question {i} options 없음/미정규화")
                    # 문항 간 아주 짧은 간격
                    audio_mix += gap_qprefix
                print(f"  - questions ▶ {len(questions)}개 처리 완료")
        else:
            print("  - question 없음")

        # (3) 저장: 항목당 '정확히 한 번' export
        out_path = os.path.join(args.out_dir, f"{item_id}.mp3")
        if export_count >= 1:
            raise RuntimeError(f"[BUG] export가 2회 이상 시도되었습니다: id={item_id}")
        audio_mix.export(out_path, format="mp3", parameters=export_params)
        export_count += 1
        print(f"  => 저장(1/1): {out_path}  ({len(audio_mix)} ms)\n")

    print("완료.")


if __name__ == "__main__":
    main()