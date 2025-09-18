from google.cloud import texttospeech

# 클라이언트 인스턴스화
client = texttospeech.TextToSpeechClient()

# 변환할 텍스트 설정
synthesis_input = texttospeech.SynthesisInput(text= "sleep. 자다 라는 뜻입니다. You should sleep 8 hours a day. 당신은 하루에 8시간을 자야 합니다. 라는 뜻이에요.")

# Chirp 음성 모델 선택 (예: en-US-Chirp-3-HD-Charon)
# 사용 가능한 전체 음성 목록은 문서를 참조하세요.
# 한국어 Chirp 음성은 현재(2025년 8월 기준) 정식 출시되지 않았을 수 있습니다.
# 우선 영어 모델로 테스트합니다.
voice = texttospeech.VoiceSelectionParams(
    language_code="en-US",
    name="en-US-Chirp3-HD-Charon", # Chirp HD 보이스 이름
)

# 오디오 출력 형식 설정
audio_config = texttospeech.AudioConfig(
    audio_encoding=texttospeech.AudioEncoding.MP3
)

# 텍스트 음성 변환 요청
response = client.synthesize_speech(
    input=synthesis_input, voice=voice, audio_config=audio_config
)

# 응답으로 받은 오디오 콘텐츠를 .mp3 파일로 저장
with open("output_chirp.mp3", "wb") as out:
    out.write(response.audio_content)
    print('"output_chirp.mp3" 파일이 생성되었습니다.')
