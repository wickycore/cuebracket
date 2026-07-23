$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$providerPath = Join-Path $projectRoot "components\CloudAutoSyncProvider.tsx"

if (-not (Test-Path $providerPath)) {
    throw "CloudAutoSyncProvider.tsx was not found at: $providerPath"
}

$content = Get-Content $providerPath -Raw
$old = 'const SYNC_DEBOUNCE_MS = 650;'
$new = 'const SYNC_DEBOUNCE_MS = 120;'

if ($content.Contains($new)) {
    Write-Host "Fast sync is already enabled (120ms)." -ForegroundColor Green
}
elseif ($content.Contains($old)) {
    $backupPath = "$providerPath.before-fast-sync"
    Copy-Item $providerPath $backupPath -Force
    $content = $content.Replace($old, $new)
    Set-Content -Path $providerPath -Value $content -Encoding UTF8
    Write-Host "Cloud sync debounce changed from 650ms to 120ms." -ForegroundColor Green
    Write-Host "Backup created: $backupPath" -ForegroundColor DarkGray
}
else {
    throw "Expected debounce line was not found. The provider may have changed. No file was edited."
}

Write-Host ""
Write-Host "Verification:" -ForegroundColor Cyan
Select-String -Path $providerPath -Pattern "SYNC_DEBOUNCE_MS"
