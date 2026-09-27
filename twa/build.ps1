# Manual release build: gradle assembleRelease -> zipalign -> apksigner.
# Secrets come from the environment, never from the repo:
#   $env:MANEKI_KEYSTORE       path to the keystore (kept outside the repo)
#   $env:MANEKI_KEYSTORE_PASS  keystore + key password
# JAVA_HOME / ANDROID_HOME are expected to be set by the machine.
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot

if (-not $env:MANEKI_KEYSTORE -or -not $env:MANEKI_KEYSTORE_PASS) {
  Write-Host "Set MANEKI_KEYSTORE and MANEKI_KEYSTORE_PASS first."; exit 1
}

Write-Host "== gradle assembleRelease =="
cmd /c ".\gradlew.bat assembleRelease --stacktrace > gradle-log.txt 2>&1"
if ($LASTEXITCODE -ne 0) { Get-Content gradle-log.txt -Tail 25; exit 1 }
Get-Content gradle-log.txt -Tail 3

$unsigned = "app\build\outputs\apk\release\app-release-unsigned.apk"
if (-not (Test-Path $unsigned)) { "unsigned APK not found"; Get-ChildItem app\build\outputs\apk\release; exit 1 }

$bt = (Get-ChildItem "$env:ANDROID_HOME\build-tools" -Directory | Sort-Object Name -Descending | Select-Object -First 1).FullName
Write-Host "== zipalign ($bt) =="
& "$bt\zipalign.exe" -f -p 4 $unsigned "app-release-aligned.apk"
if ($LASTEXITCODE -ne 0) { "zipalign failed"; exit 1 }

Write-Host "== apksigner =="
cmd /c "`"$bt\apksigner.bat`" sign --ks `"$env:MANEKI_KEYSTORE`" --ks-key-alias maneki --ks-pass pass:$env:MANEKI_KEYSTORE_PASS --key-pass pass:$env:MANEKI_KEYSTORE_PASS --out app-release-signed.apk app-release-aligned.apk"
if ($LASTEXITCODE -ne 0) { "signing failed"; exit 1 }
cmd /c "`"$bt\apksigner.bat`" verify --print-certs app-release-signed.apk" | Select-Object -First 3
Get-Item app-release-signed.apk | ForEach-Object { "APK READY: {0}  {1:N1} MB" -f $_.Name, ($_.Length/1MB) }
