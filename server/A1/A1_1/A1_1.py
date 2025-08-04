# -*- coding: utf-8 -*-
import json
import os
import re
import sys
from google.cloud import texttospeech

def sanitize_filename(name):
    """파일 이름으로 사용할 수 없는 문자를 제거하고 소문자로 변환합니다."""
    name = re.sub(r'[\\/*?:"<>|]', "", name)
    return name.lower()

def synthesize_vocab_audio(json_file_path):
    """
    JSON 파일을 읽어 각 단어의 koChirpScript에 대한 MP3 파일을 생성합니다.
    파일 이름은 각 단어의 lemma에 맞춰 생성됩니다.
    """
    # --- 1단계: 클라이언트 및 설정 초기화 ---
    try:
        client = texttospeech.TextToSpeechClient()
    except Exception as e:
        print("Google Cloud 인증에 실패했습니다. 다음을 확인하세요:")
        print("1. gcloud SDK가 설치되었는지 확인하세요.")
        print("2. 터미널에서 'gcloud auth application-default login' 명령어를 실행했는지 확인하세요.")
        print(f"오류 상세 정보: {e}")
        return

    # 여성 음성(Neural2, Chirp 기술 기반)으로 설정합니다.
    voice = texttospeech.VoiceSelectionParams(
        language_code="en-US",
        name='en-US-Chirp3-HD-Charon' 
    )

    # 오디오 출력 형식(MP3)을 설정합니다.
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3
    )

    # --- 2단계: JSON 파일 읽기 ---
    try:
        with open(json_file_path, 'r', encoding='utf-8') as f:
            vocab_list = json.load(f)
    except FileNotFoundError:
        print(f"오류: '{json_file_path}' 파일을 찾을 수 없습니다.")
        return
    except json.JSONDecodeError:
        print(f"오류: '{json_file_path}' 파일이 올바른 JSON 형식이 아닙니다.")
        return

    # --- 3단계: 음성 파일 생성 ---
    output_dir = "A1_1_audio_generated"
    os.makedirs(output_dir, exist_ok=True)
    print(f"🎧 '{output_dir}' 폴더에 음성 파일 생성을 시작합니다...")

    total_items = len(vocab_list)
    for i, item in enumerate(vocab_list):
        lemma = item.get("lemma")
        script_text = item.get("koChirpScript")

        if not lemma or not script_text:
            print(f"[{i+1}/{total_items}] 경고: lemma나 koChirpScript가 없어 건너뜁니다.")
            continue
        
        print(f"[{i+1}/{total_items}] '{lemma}' 단어 음성 생성 중...")

        synthesis_input = texttospeech.SynthesisInput(text=script_text)
        
        response = client.synthesize_speech(
            input=synthesis_input, voice=voice, audio_config=audio_config
        )

        # 파일 이름을 lemma에 맞춰 생성합니다.
        output_filename = f"{sanitize_filename(lemma)}.mp3"
        output_path = os.path.join(output_dir, output_filename)
        
        with open(output_path, "wb") as out:
            out.write(response.audio_content)

    print(f"\n🎉 모든 음성 파일 생성이 완료되었습니다! '{output_dir}' 폴더를 확인해보세요.")

if __name__ == "__main__":
    # 처리할 JSON 파일의 경로를 지정합니다.
    # 다른 파일을 처리하려면 이 파일 이름만 변경하면 됩니다.
    file_to_process = "ielts_a1_1.json"
    synthesize_vocab_audio(file_to_process)
