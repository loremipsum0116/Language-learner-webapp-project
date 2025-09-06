@echo off
set ANDROID_AVD_HOME=D:\Android\avd
set ANDROID_SDK_ROOT=D:\Android\Sdk
set ANDROID_HOME=D:\Android\Sdk

echo Starting Android Emulator...
echo AVD Home: %ANDROID_AVD_HOME%
echo SDK Root: %ANDROID_SDK_ROOT%
echo.

"%ANDROID_SDK_ROOT%\emulator\emulator.exe" -avd Pixel_3a_API_36 -memory 2048 -partition-size 2048