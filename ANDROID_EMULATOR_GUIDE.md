# Android 에뮬레이터 실행 가이드

## 현재 상황
- AVD 파일들이 D:\Android\avd에 생성되어 있음
- 환경 변수 ANDROID_AVD_HOME이 D:\Android\avd로 설정되어 있음
- 하지만 명령줄에서 에뮬레이터가 AVD를 찾지 못함

## 해결 방법

### 방법 1: Android Studio에서 직접 실행 (권장)
1. Android Studio 실행
2. 상단 메뉴에서 **Tools → AVD Manager** 선택
3. AVD Manager가 열리면 **"+ Create Virtual Device"** 클릭
4. 다음 설정으로 새 AVD 생성:
   - Device: Pixel 3a 또는 Pixel 2
   - System Image: API 36 (Android 14)
   - AVD Name: 원하는 이름
   - **Show Advanced Settings** 클릭
   - AVD 저장 경로가 D:\Android\avd로 설정되어 있는지 확인
5. 생성된 AVD 옆의 **▶ (Play)** 버튼 클릭하여 실행

### 방법 2: 명령 프롬프트에서 실행
새 명령 프롬프트를 **관리자 권한**으로 열고:
```cmd
set ANDROID_AVD_HOME=D:\Android\avd
set ANDROID_SDK_ROOT=C:\Users\sst70\AppData\Local\Android\Sdk
"C:\Users\sst70\AppData\Local\Android\Sdk\emulator\emulator.exe" -list-avds
```

AVD 목록이 표시되면:
```cmd
"C:\Users\sst70\AppData\Local\Android\Sdk\emulator\emulator.exe" -avd [AVD_NAME]
```

### 방법 3: 시스템 환경 변수 영구 설정
1. **Windows 키 + X** → **시스템** 선택
2. **고급 시스템 설정** 클릭
3. **환경 변수** 버튼 클릭
4. 사용자 변수에서:
   - ANDROID_AVD_HOME = D:\Android\avd
   - ANDROID_SDK_ROOT = C:\Users\sst70\AppData\Local\Android\Sdk
5. **확인** 클릭
6. **모든 명령 프롬프트와 Android Studio 재시작**

## React Native 앱 실행

에뮬레이터가 실행된 후:

```bash
cd app/LanguageLearnerApp
npx expo run:android
```

또는 Expo 개발 서버 사용:

```bash
cd app/LanguageLearnerApp
npx expo start
# 'a' 키를 눌러 Android에서 실행
```

## 문제 해결

### 에뮬레이터를 찾을 수 없을 때
- Android Studio를 완전히 종료 후 재시작
- 명령 프롬프트를 관리자 권한으로 실행
- PC 재시작 후 다시 시도

### ADB 디바이스를 찾을 수 없을 때
```bash
adb kill-server
adb start-server
adb devices
```

### 디스크 공간 부족
- D드라이브에 최소 10GB 이상의 여유 공간 확보
- AVD 설정에서 Internal Storage 크기 축소

## 생성된 AVD 정보
- 위치: D:\Android\avd
- 사용 가능한 AVD:
  - Pixel_3a_API_36
  - Pixel_3a_API_33 (시스템 이미지 필요)
  - Medium_Phone_API_36.0