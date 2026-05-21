# SSH deploy for derived.co.in (Researchium)
# Set once, then run: .\scripts\deploy-ssh.ps1
#
#   $env:DEPLOY_HOST = "user@your-server-ip"
#   $env:DEPLOY_PATH = "/home/user/derived-main"
#   $env:PM2_NAME    = "researchium"

param(
  [string]$DeployHost = $env:DEPLOY_HOST,
  [string]$DeployPath = $env:DEPLOY_PATH,
  [string]$Pm2Name = $env:PM2_NAME
)

if (-not $DeployHost -or -not $DeployPath) {
  Write-Host "Set DEPLOY_HOST and DEPLOY_PATH first:" -ForegroundColor Yellow
  Write-Host '  $env:DEPLOY_HOST = "ubuntu@123.45.67.89"'
  Write-Host '  $env:DEPLOY_PATH = "/var/www/derived"'
  Write-Host '  $env:PM2_NAME    = "researchium"'
  Write-Host "  .\scripts\deploy-ssh.ps1"
  exit 1
}

$cmd = "cd '$DeployPath' && git pull origin main && npm install --omit=dev && npm run sync:demos && npm run sync:courses"
if ($Pm2Name) {
  $cmd += " && (pm2 restart '$Pm2Name' || pm2 start server/index.js --name '$Pm2Name')"
}

Write-Host "Deploying to $DeployHost ..." -ForegroundColor Cyan
ssh $DeployHost $cmd
Write-Host "Deploy finished." -ForegroundColor Green
