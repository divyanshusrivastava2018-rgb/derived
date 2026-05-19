# Stop anything listening on the app port, then start Researchium.
$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $root

$port = 3000
$envFile = Join-Path $root ".env"
if (Test-Path $envFile) {
  foreach ($line in Get-Content $envFile) {
    if ($line -match '^\s*PORT\s*=\s*(\d+)') {
      $port = [int]$Matches[1]
      break
    }
  }
}

Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

Write-Host "Starting Researchium on http://localhost:$port ..."
npm start
