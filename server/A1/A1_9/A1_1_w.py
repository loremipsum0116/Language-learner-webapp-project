# -*- coding: utf-8 -*-
import json
import os
os.environ["GRPC_DNS_RESOLVER"] = "native" 
import re
from io import BytesIO

from google.cloud import texttospeech
from pydub import AudioSegment


def sanitize_filename(name):
    """파일 이름으로 사용할 수 없는 문자를 제거하고 소문자로 변환합니다."""
    name = re.sub(r'[\\/*?:"<>|]', "", name) + "-v"
    return name.lower()


def split_script_by_language(script_text):
    """
    한글과 영어가 섞인 텍스트를 언어별로 분리합니다.
    반환: [(lang_code, text_segment), ...]
    """
    segments = []
    current_lang = None
    buffer = ""

    for char in script_text:
        if '\uac00' <= char <= '\ud7af':  # 한글
            lang = 'en-US'
        elif 'a' <= char.lower() <= 'z':
            lang = 'en-US'
        elif char.isspace():
            lang = current_lang  # 공백은 이전 언어 유지
        else:
            lang = current_lang  # 문장부호 등

        if lang != current_lang and buffer:
            segments.append((current_lang, buffer))
            buffer = ""
        buffer += char
        current_lang = lang

    if buffer:
        segments.append((current_lang, buffer))

    return segments


# 언어별 음성 설정
VOICE_PARAMS = {
    "en-US": texttospeech.VoiceSelectionParams(
        language_code="en-US",
        name="en-US-Chirp3-HD-Erinome"
    ),
    "en-US": texttospeech.VoiceSelectionParams(
        language_code="en-US",
        name="en-US-Chirp3-HD-Erinome"
    )
}

def synthesize_vocab_audio(json_file_path):
    """JSON 파일을 읽고 각 단어의 koChirpScript를 mp3 파일로 생성합니다."""
    try:
        client = texttospeech.TextToSpeechClient()
    except Exception as e:
        print("Google Cloud 인증 실패. 다음을 확인하세요:")
        print("- gcloud auth application-default login 수행")
        print("- GOOGLE_APPLICATION_CREDENTIALS 환경변수 설정 여부")
        print(f"오류: {e}")
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

    output_dir = "A1_1_audio_generated"
    os.makedirs(output_dir, exist_ok=True)

    print(f"🎧 '{output_dir}' 폴더에 음성 파일 생성을 시작합니다...\n")
    total_items = len(vocab_list)

    for i, item in enumerate(vocab_list):
        lemma = item.get("lemma")
        script_text = item.get("koChirpScript")

        if not lemma or not script_text:
            print(f"[{i+1}/{total_items}] 건너뜀: lemma 또는 koChirpScript 없음.")
            continue

        print(f"[{i+1}/{total_items}] '{lemma}' 처리 중...")

        segments = split_script_by_language(script_text)
        merged_audio = AudioSegment.empty()

        for lang_code, segment_text in segments:
            if not segment_text.strip():
                continue

            voice = VOICE_PARAMS.get(lang_code)
            if not voice:
                print(f"⚠️ 지원하지 않는 언어 코드: {lang_code}. segment: '{segment_text}'")
                continue

            try:
                synthesis_input = texttospeech.SynthesisInput(text=segment_text)
                response = client.synthesize_speech(
                    input=synthesis_input, voice=voice, audio_config=audio_config
                )
                audio_part = AudioSegment.from_file(BytesIO(response.audio_content), format="mp3")
                merged_audio += audio_part
            except Exception as e:
                print(f"❌ 오류 발생: '{segment_text}' → {e}")
                continue

        if len(merged_audio) > 0:
            output_filename = f"{sanitize_filename(lemma)}.mp3"
            output_path = os.path.join(output_dir, output_filename)
            merged_audio.export(output_path, format="mp3")
        else:
            print(f"⚠️ '{lemma}'에 대해 유효한 음성이 없음.")

    print(f"\n✅ 모든 음성 파일 생성 완료! → '{output_dir}' 폴더 확인.")


if __name__ == "__main__":
    file_to_process = "w.json"
    synthesize_vocab_audio(file_to_process)
