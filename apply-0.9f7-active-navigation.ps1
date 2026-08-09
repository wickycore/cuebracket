$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

Write-Host ""
Write-Host "Applying CueBracket 0.9F.7..." -ForegroundColor Cyan

node .\apply-0.9f6-navigation-stability.mjs
node .\apply-hard-navigation-fallback.mjs

Write-Host ""
Write-Host "CueBracket 0.9F.7 applied successfully." -ForegroundColor Green
Write-Host "Now run: npm run build" -ForegroundColor Yellow
