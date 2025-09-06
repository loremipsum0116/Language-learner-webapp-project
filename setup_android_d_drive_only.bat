@echo off
echo ================================================================
echo          ANDROID EMULATOR D-DRIVE ONLY SETUP
echo ================================================================
echo.

REM 관리자 권한 확인
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo 이 스크립트는 관리자 권한이 필요합니다.
    echo 마우스 우클릭으로 "관리자 권한으로 실행"을 선택해주세요.
    pause
    exit /b 1
)

echo 1. 시스템 환경 변수를 D 드라이브로 설정 중...
echo.

REM Android SDK 환경변수를 D드라이브로 설정
setx ANDROID_SDK_ROOT "D:\Android\Sdk" /M
setx ANDROID_HOME "D:\Android\Sdk" /M
setx ANDROID_SDK_HOME "D:\Android\Sdk" /M

REM AVD 홈을 D드라이브로 설정
setx ANDROID_AVD_HOME "D:\Android\avd" /M

REM Gradle을 D드라이브로 설정
setx GRADLE_USER_HOME "D:\Gradle" /M

REM Android tools를 PATH에 추가 (D드라이브 경로만)
setx PATH "%PATH%;D:\Android\Sdk\platform-tools;D:\Android\Sdk\emulator;D:\Android\Sdk\tools;D:\Android\Sdk\tools\bin;D:\Android\Sdk\cmdline-tools\latest\bin" /M

echo 2. C드라이브 Android 디렉토리 접근 차단 중...
echo.

REM C드라이브 Android 폴더를 읽기 전용으로 만들어서 새로운 파일 생성 방지
if exist "C:\Users\%USERNAME%\AppData\Local\Android" (
    attrib +R "C:\Users\%USERNAME%\AppData\Local\Android" /S /D
    echo C드라이브 Android 폴더를 읽기 전용으로 설정했습니다.
)

REM 사용자 환경 변수에서도 C드라이브 경로 제거
setx ANDROID_SDK_ROOT "D:\Android\Sdk"
setx ANDROID_HOME "D:\Android\Sdk"
setx ANDROID_SDK_HOME "D:\Android\Sdk"
setx ANDROID_AVD_HOME "D:\Android\avd"
setx GRADLE_USER_HOME "D:\Gradle"

echo 3. D드라이브 디렉토리 구조 생성 중...
echo.

REM D드라이브에 필요한 디렉토리 생성
if not exist "D:\Android\Sdk" mkdir "D:\Android\Sdk"
if not exist "D:\Android\avd" mkdir "D:\Android\avd"
if not exist "D:\Gradle" mkdir "D:\Gradle"

echo 4. 권한 설정 완료
echo.

echo ================================================================
echo                      설정 완료!
echo ================================================================
echo.
echo 다음 환경 변수가 D드라이브로 설정되었습니다:
echo   - ANDROID_SDK_ROOT: D:\Android\Sdk
echo   - ANDROID_HOME: D:\Android\Sdk
echo   - ANDROID_SDK_HOME: D:\Android\Sdk
echo   - ANDROID_AVD_HOME: D:\Android\avd
echo   - GRADLE_USER_HOME: D:\Gradle
echo.
echo C드라이브 Android 폴더는 읽기 전용으로 설정되어
echo 새로운 파일이 생성되는 것을 방지합니다.
echo.
echo *** 중요: 모든 IDE와 터미널을 재시작해주세요 ***
echo.
pause