# -*- coding: utf-8 -*-
import json
import os
os.environ["GRPC_DNS_RESOLVER"] = "native"
import re
from io import BytesIO

from google.cloud import texttospeech
from pydub import AudioSegment


def sanitize_filename(name):
    name = re.sub(r'[\\/*?:"<>|]', "", name)
    return name.lower()


def split_script_by_language(script_text):
    """한글/영어 혼합 텍스트를 언어별로 분리."""
    segments = []
    current_lang, buf = None, ""

    for ch in script_text:
        if '\uac00' <= ch <= '\ud7af':  # 한글
            lang = 'en-US'
        elif 'a' <= ch.lower() <= 'z':
            lang = 'en-US'
        elif ch.isspace():
            lang = current_lang
        else:
            lang = current_lang

        if lang != current_lang and buf:
            segments.append((current_lang, buf))
            buf = ""
        buf += ch
        current_lang = lang

    if buf:
        segments.append((current_lang, buf))
    return segments


# ✅ 성별에 따라 보이스 묶음 정의 (필요 시 이름을 환경에 맞게 조정)
VOICE_SETS = {
    "male": {
        "en-US": texttospeech.VoiceSelectionParams(
            language_code="en-US", name="en-US-Chirp3-HD-Charon"
        ),
        "en-US": texttospeech.VoiceSelectionParams(
            language_code="en-US", name="en-US-Chirp3-HD-Charon"
        ),
    },
    "female": {
        "en-US": texttospeech.VoiceSelectionParams(
            language_code="en-US", name="en-US-Chirp3-HD-Laomedeia"
        ),
        "en-US": texttospeech.VoiceSelectionParams(
            language_code="en-US", name="en-US-Chirp3-HD-Laomedeia"
        ),
    },
}

# 첫 항목 성별 설정: 'male'이면 1번째 남/2번째 여…, 'female'이면 반대로 시작
START_GENDER = "male"

def gender_for_index(idx: int, start: str = "male") -> str:
    first_is_male = (start == "male")
    return "male" if ((idx % 2 == 0) == first_is_male) else "female"


def synthesize_vocab_audio(json_file_path):
    try:
        client = texttospeech.TextToSpeechClient()
    except Exception as e:
        print("Google Cloud 인증 실패:", e)
        return

    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3
    )

    try:
        with open(json_file_path, 'r', encoding='utf-8') as f:
            vocab_list = json.load(f)
    except Exception as e:
        print(f"JSON 파일 열기 실패: {e}")
        return

    output_dir = "A1_1_audio_generated_duo"  # 충돌 방지용 새 폴더
    os.makedirs(output_dir, exist_ok=True)

    print(f"🎧 '{output_dir}' 폴더에 음성 파일 생성을 시작합니다...\n")
    total = len(vocab_list)

    for i, item in enumerate(vocab_list):
        lemma = item.get("lemma")
        script_text = item.get("koChirpScript")

        if not lemma or not script_text:
            print(f"[{i+1}/{total}] 건너뜀: lemma 또는 koChirpScript 없음.")
            continue

        # ✅ 이 항목 전체에 적용할 성별 결정 (교대)
        gender = gender_for_index(i, START_GENDER)
        voice_map = VOICE_SETS[gender]
        print(f"[{i+1}/{total}] '{lemma}' → {gender} 보이스")

        merged_audio = AudioSegment.empty()
        for lang_code, seg_text in split_script_by_language(script_text):
            if not seg_text or not lang_code:
                continue

            voice = voice_map.get(lang_code)
            if not voice:
                # 언어 매핑 누락 시 한국어 보이스로 폴백
                voice = voice_map.get("en-US")

            try:
                synthesis_input = texttospeech.SynthesisInput(text=seg_text)
                resp = client.synthesize_speech(
                    input=synthesis_input, voice=voice, audio_config=audio_config
                )
                audio_part = AudioSegment.from_file(BytesIO(resp.audio_content), format="mp3")
                merged_audio += audio_part
            except Exception as e:
                print(f"❌ 합성 오류: '{seg_text}' ({gender}/{lang_code}) → {e}")

        if len(merged_audio) > 0:
            out_path = os.path.join(output_dir, f"{sanitize_filename(lemma)}.mp3")
            merged_audio.export(out_path, format="mp3")
        else:
            print(f"⚠️ '{lemma}'에 대해 유효한 음성이 없음.")

    print(f"\n✅ 완료: '{output_dir}' 확인")


if __name__ == "__main__":
    file_to_process = "ielts_b1_1.json"
    synthesize_vocab_audio(file_to_process)
