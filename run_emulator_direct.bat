@echo off
echo Setting up Android Emulator with D drive AVD...
echo.

REM Set environment variables
set ANDROID_AVD_HOME=D:\Android\avd
set ANDROID_SDK_ROOT=D:\Android\Sdk
set ANDROID_HOME=D:\Android\Sdk
set PATH=%ANDROID_SDK_ROOT%\emulator;%ANDROID_SDK_ROOT%\platform-tools;%PATH%

echo Environment Variables:
echo ANDROID_AVD_HOME: %ANDROID_AVD_HOME%
echo ANDROID_SDK_ROOT: %ANDROID_SDK_ROOT%
echo.

REM Check available AVDs
echo Checking available AVDs in D:\Android\avd...
dir /b "D:\Android\avd\*.ini" 2>nul
echo.

REM Direct launch with full AVD path
echo Starting Pixel_3a_API_36 emulator...
"%ANDROID_SDK_ROOT%\emulator\emulator.exe" @Pixel_3a_API_36 -avd-dir "D:\Android\avd\Pixel_3a_API_36.avd"

if errorlevel 1 (
    echo.
    echo Failed to start emulator. Trying alternative method...
    "%ANDROID_SDK_ROOT%\emulator\emulator.exe" -avd Pixel_3a_API_36 -datadir "D:\Android\avd\Pixel_3a_API_36.avd"
)

pause