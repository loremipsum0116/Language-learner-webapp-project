@echo off
echo ================================================================
echo          ANDROID EMULATOR - D DRIVE ONLY MODE
echo ================================================================
echo.

REM D드라이브 전용 환경 변수 강제 설정
set ANDROID_SDK_ROOT=D:\Android\Sdk
set ANDROID_HOME=D:\Android\Sdk
set ANDROID_SDK_HOME=D:\Android\Sdk
set ANDROID_AVD_HOME=D:\Android\avd
set GRADLE_USER_HOME=D:\Gradle

REM C드라이브 Android 경로를 PATH에서 제거하고 D드라이브만 추가
set PATH=%PATH:C:\Users\%USERNAME%\AppData\Local\Android\Sdk\platform-tools;=%
set PATH=%PATH:C:\Users\%USERNAME%\AppData\Local\Android\Sdk\emulator;=%
set PATH=%PATH:C:\Users\%USERNAME%\AppData\Local\Android\Sdk\tools;=%
set PATH=D:\Android\Sdk\platform-tools;D:\Android\Sdk\emulator;D:\Android\Sdk\tools;D:\Android\Sdk\tools\bin;%PATH%

echo 현재 환경 설정:
echo   ANDROID_SDK_ROOT: %ANDROID_SDK_ROOT%
echo   ANDROID_HOME: %ANDROID_HOME%
echo   ANDROID_AVD_HOME: %ANDROID_AVD_HOME%
echo   GRADLE_USER_HOME: %GRADLE_USER_HOME%
echo.

REM D드라이브 디렉토리 존재 확인
if not exist "%ANDROID_SDK_ROOT%" (
    echo 오류: Android SDK가 D:\Android\Sdk에 없습니다!
    echo setup_android_d_drive_only.bat를 먼저 실행해주세요.
    pause
    exit /b 1
)

if not exist "%ANDROID_AVD_HOME%" (
    echo 오류: AVD 디렉토리가 D:\Android\avd에 없습니다!
    echo AVD를 먼저 생성해주세요.
    pause
    exit /b 1
)

echo 사용 가능한 AVD 목록:
"%ANDROID_SDK_ROOT%\emulator\emulator.exe" -list-avds
echo.

REM 기본 AVD 설정 (존재하는 것 중 첫 번째 선택)
set DEFAULT_AVD=Pixel_3a_API_36

echo %DEFAULT_AVD% 에뮬레이터를 시작합니다...
echo 메모리: 2048MB, 파티션: 2048MB
echo.

REM 에뮬레이터 시작 (D드라이브 경로 강제 지정)
"%ANDROID_SDK_ROOT%\emulator\emulator.exe" ^
  -avd %DEFAULT_AVD% ^
  -memory 2048 ^
  -partition-size 2048 ^
  -data-dir "%ANDROID_AVD_HOME%\%DEFAULT_AVD%.avd" ^
  -verbose

if errorlevel 1 (
    echo.
    echo 에뮬레이터 시작에 실패했습니다.
    echo.
    echo 문제 해결:
    echo 1. AVD가 존재하는지 확인: %ANDROID_AVD_HOME%
    echo 2. Android SDK가 올바르게 설치되었는지 확인: %ANDROID_SDK_ROOT%
    echo 3. HAXM 또는 하이퍼바이저가 활성화되어 있는지 확인
    echo.
    pause
    exit /b 1
)

echo.
echo 에뮬레이터가 성공적으로 시작되었습니다!
pause