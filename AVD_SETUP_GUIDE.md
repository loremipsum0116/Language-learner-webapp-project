# Android Studio AVD 설정 가이드

## 환경 설정 완료
- C드라이브의 기존 AVD 파일 삭제 완료
- 환경 변수 ANDROID_AVD_HOME을 D:\Android\avd로 설정 완료

## Android Studio에서 새 AVD 생성 방법

1. **Android Studio 실행**
   - Android Studio를 재시작하세요 (환경 변수 적용을 위해)

2. **AVD Manager 열기**
   - Tools → AVD Manager 선택
   - 또는 상단 툴바에서 AVD Manager 아이콘 클릭

3. **새 가상 디바이스 생성**
   - "Create Virtual Device" 클릭
   - 디바이스 선택:
     - Phone 카테고리에서 Pixel 2 또는 Pixel 3a 추천
     - Next 클릭

4. **시스템 이미지 선택**
   - API Level 33 또는 34 (Android 13/14) 추천
   - x86_64 아키텍처 선택
   - Google Play 포함 이미지 선택 (Google Play Store 테스트 필요시)
   - Next 클릭

5. **AVD 구성**
   - AVD Name: 예) "Pixel_2_API_33"
   - **중요**: Show Advanced Settings 클릭
   - AVD 저장 위치가 D:\Android\avd\[AVD_NAME]으로 표시되는지 확인
   - Memory and Storage 섹션에서:
     - RAM: 2048 MB
     - VM heap: 256 MB
     - Internal Storage: 2048 MB (필요시 조정)
     - SD Card: 512 MB (선택사항)
   - Finish 클릭

6. **AVD 실행 테스트**
   - 생성된 AVD 옆의 Play 버튼 클릭
   - 에뮬레이터가 정상적으로 부팅되는지 확인

## React Native 앱 실행 방법

AVD가 실행된 상태에서:

```bash
cd app/LanguageLearnerApp
npx expo run:android
```

또는 Expo Go 앱을 사용하여:

```bash
cd app/LanguageLearnerApp
npx expo start
```

그 후 'a' 키를 눌러 Android에서 실행

## 문제 해결

- AVD가 여전히 C드라이브에 생성되는 경우:
  1. Android Studio 완전히 종료
  2. 명령 프롬프트에서 `echo %ANDROID_AVD_HOME%` 실행하여 D:\Android\avd 확인
  3. Android Studio 재시작

- 디스크 공간 부족 에러:
  - D드라이브에 최소 10GB 이상의 여유 공간 확보
  - AVD 설정에서 Internal Storage 크기 축소