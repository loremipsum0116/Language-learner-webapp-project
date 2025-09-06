@echo off
echo Setting Android environment variables to D drive...

REM Set Android SDK Root
setx ANDROID_SDK_ROOT "D:\Android\Sdk" /M
setx ANDROID_HOME "D:\Android\Sdk" /M

REM Set AVD Home
setx ANDROID_AVD_HOME "D:\Android\avd" /M

REM Add Android tools to PATH
setx PATH "%PATH%;D:\Android\Sdk\platform-tools;D:\Android\Sdk\emulator;D:\Android\Sdk\tools;D:\Android\Sdk\tools\bin" /M

REM Set Gradle home to D drive
setx GRADLE_USER_HOME "D:\Gradle" /M

echo Environment variables set successfully!
echo Please restart your command prompt or IDE for changes to take effect.
pause