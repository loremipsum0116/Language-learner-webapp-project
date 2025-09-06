# Android Emulator D드라이브 전용 설정 완료

## 🎯 목표
Android Emulator와 관련된 모든 파일을 D드라이브로 이동하여 C드라이브 용량 문제를 해결하고, 새로운 파일이 C드라이브에 생성되지 않도록 완전 차단

## 📂 이동된 디렉토리 구조
```
D:\Android\
├── Sdk\                    # Android SDK (기존 C:\Users\사용자명\AppData\Local\Android\Sdk에서 이동)
│   ├── platform-tools\
│   ├── emulator\
│   ├── tools\
│   └── system-images\
├── avd\                    # AVD 파일들 (Virtual Device 데이터)
│   ├── Medium_Phone.avd\
│   ├── Pixel_3a_API_33.avd\
│   └── Pixel_3a_API_36.avd\
└── 
D:\Gradle\                  # Gradle 캐시 및 설정
```

## 🔧 설정된 환경 변수
### 시스템 환경 변수 (모든 사용자)
- `ANDROID_SDK_ROOT=D:\Android\Sdk`
- `ANDROID_HOME=D:\Android\Sdk`
- `ANDROID_SDK_HOME=D:\Android\Sdk`
- `ANDROID_AVD_HOME=D:\Android\avd`
- `GRADLE_USER_HOME=D:\Gradle`
- `PATH`에 D드라이브 Android tools 경로 추가

## 🛠️ 사용 가능한 스크립트들

### 1. setup_android_d_drive_only.bat ⭐ **필수 실행**
```bash
# 관리자 권한으로 실행 필요
# 시스템 환경 변수 설정 및 C드라이브 차단
```

### 2. run_emulator_d_drive_only.bat ⭐ **권장 사용**
```bash
# D드라이브 전용 에뮬레이터 실행
# C드라이브 경로 완전 차단
# 안전한 에뮬레이터 실행
```

### 3. 기존 스크립트들 (업데이트됨)
- `run_emulator.bat` - D드라이브 경로로 업데이트
- `run_emulator_direct.bat` - D드라이브 경로로 업데이트
- `start_emulator.ps1` - D드라이브 경로로 업데이트

## 🚫 C드라이브 사용 차단 방법

### 1. 환경 변수 차단
- 모든 Android 관련 환경 변수가 D드라이브를 가리킴
- C드라이브 경로가 PATH에서 제거됨

### 2. 디렉토리 보호
- `C:\Users\사용자명\AppData\Local\Android` 디렉토리를 읽기 전용으로 설정
- 새로운 파일 생성 방지

### 3. Gradle 설정
```properties
# android/gradle.properties에 추가됨
org.gradle.caching.dir=D:\\Gradle\\caches
org.gradle.user.home=D:\\Gradle
org.gradle.daemon.directory=D:\\Gradle\\daemon
```

## 🧪 테스트 결과
✅ Android SDK가 D드라이브에서 정상 작동  
✅ AVD 파일들이 D드라이브에서 정상 로드  
✅ 환경 변수가 올바르게 D드라이브를 가리킴  
✅ Gradle 캐시가 D드라이브에 생성됨  

## ⚠️ 주의사항

1. **관리자 권한 필요**: `setup_android_d_drive_only.bat`는 반드시 관리자 권한으로 실행
2. **IDE 재시작**: 설정 후 모든 IDE (Android Studio, VS Code 등)와 터미널 재시작 필요
3. **기존 프로젝트**: 기존 React Native 프로젝트의 빌드 캐시는 수동으로 정리 권장
4. **백업 권장**: 중요한 AVD 설정이 있다면 이동 전 백업 권장

## 🔄 문제 해결

### AVD가 인식되지 않는 경우:
```bash
# AVD 목록 확인
D:\Android\Sdk\emulator\emulator.exe -list-avds

# 환경 변수 확인
echo %ANDROID_AVD_HOME%
echo %ANDROID_SDK_ROOT%
```

### Gradle 오류 발생 시:
```bash
# Gradle 캐시 정리
./gradlew clean
# 또는
pnpm android:clean
```

### 에뮬레이터 실행 실패 시:
1. HAXM/하이퍼바이저 설정 확인
2. D드라이브 용량 확인 (최소 10GB 필요)
3. 바이러스 백신 실시간 검사 예외 추가

## 🎉 완료!
이제 Android Emulator는 완전히 D드라이브에서만 작동하며, C드라이브에 새로운 파일이 생성되지 않습니다.