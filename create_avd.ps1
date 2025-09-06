# PowerShell script to create AVD in D drive
$env:ANDROID_AVD_HOME = "D:\Android\avd"

Write-Host "Creating AVD in D:\Android\avd..." -ForegroundColor Green

# Create AVD using echo to provide default answers
$avdName = "Pixel_3a_API_36"
$deviceId = "pixel_3a"
$systemImage = "system-images;android-36;google_apis_playstore;x86_64"
$avdPath = "D:\Android\avd\$avdName.avd"

# Create the AVD directory if it doesn't exist
if (!(Test-Path "D:\Android\avd")) {
    New-Item -ItemType Directory -Path "D:\Android\avd" -Force
}

# Create AVD configuration files manually
$avdConfigPath = "D:\Android\avd\$avdName.avd"
if (!(Test-Path $avdConfigPath)) {
    New-Item -ItemType Directory -Path $avdConfigPath -Force
}

# Create config.ini file
$configContent = @"
avd.ini.encoding=UTF-8
abi.type=x86_64
avd.ini.displayname=Pixel 3a API 33
disk.dataPartition.size=2G
hw.accelerometer=yes
hw.arc=false
hw.audioInput=yes
hw.battery=yes
hw.camera.back=virtualscene
hw.camera.front=emulated
hw.cpu.arch=x86_64
hw.cpu.ncore=4
hw.dPad=no
hw.device.name=pixel_3a
hw.gps=yes
hw.gpu.enabled=yes
hw.gpu.mode=auto
hw.keyboard=yes
hw.lcd.density=440
hw.lcd.height=2220
hw.lcd.width=1080
hw.mainKeys=no
hw.ramSize=2048
hw.sdCard=yes
hw.sensors.orientation=yes
hw.sensors.proximity=yes
hw.trackBall=no
image.sysdir.1=system-images\android-36\google_apis_playstore\x86_64\
runtime.network.latency=none
runtime.network.speed=full
sdcard.size=512M
tag.display=Google Play
tag.id=google_apis_playstore
"@

$configContent | Out-File -FilePath "$avdConfigPath\config.ini" -Encoding UTF8

# Create AVD ini file in AVD home directory
$avdIniContent = @"
avd.ini.encoding=UTF-8
path=$avdConfigPath
path.rel=avd\$avdName.avd
target=android-36
"@

$avdIniContent | Out-File -FilePath "D:\Android\avd\$avdName.ini" -Encoding UTF8

Write-Host "AVD '$avdName' created successfully at $avdConfigPath" -ForegroundColor Green
Write-Host ""
Write-Host "To start the emulator, run:" -ForegroundColor Yellow
Write-Host "  emulator -avd $avdName" -ForegroundColor Cyan