# Set environment variable and start emulator
$env:ANDROID_AVD_HOME = "D:\Android\avd"
$env:ANDROID_SDK_HOME = "D:\Android\Sdk"
$env:ANDROID_HOME = "D:\Android\Sdk"

Write-Host "Environment Variables Set:" -ForegroundColor Green
Write-Host "  ANDROID_AVD_HOME: $env:ANDROID_AVD_HOME" -ForegroundColor Cyan
Write-Host "  ANDROID_SDK_HOME: $env:ANDROID_SDK_HOME" -ForegroundColor Cyan
Write-Host ""

# List available AVDs
Write-Host "Available AVDs:" -ForegroundColor Yellow
& "$env:ANDROID_SDK_HOME\emulator\emulator.exe" -list-avds

Write-Host ""
Write-Host "Starting Pixel_3a_API_33 emulator..." -ForegroundColor Green

# Start the emulator
& "$env:ANDROID_SDK_HOME\emulator\emulator.exe" -avd Pixel_3a_API_33 -memory 2048 -partition-size 2048