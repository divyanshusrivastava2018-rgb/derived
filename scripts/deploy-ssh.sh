#!/usr/bin/env bash
# SSH deploy — usage:
#   export DEPLOY_HOST="user@your-server"
#   export DEPLOY_PATH="/var/www/derived"
#   export PM2_NAME="researchium"   # optional
#   bash scripts/deploy-ssh.sh

set -euo pipefail

HOST="${DEPLOY_HOST:-}"
PATH_ON_SERVER="${DEPLOY_PATH:-}"
PM2_NAME="${PM2_NAME:-}"

if [[ -z "$HOST" || -z "$PATH_ON_SERVER" ]]; then
  echo "Set DEPLOY_HOST and DEPLOY_PATH, e.g.:"
  echo '  export DEPLOY_HOST="ubuntu@1.2.3.4"'
  echo '  export DEPLOY_PATH="/var/www/derived"'
  exit 1
fi

ssh "$HOST" bash -s <<EOF
set -e
cd "$PATH_ON_SERVER"
echo "==> git pull"
git pull origin main
echo "==> npm install"
npm install --omit=dev
echo "==> sync chemistry"
npm run sync:chemistry
echo "==> sync demo courses"
npm run sync:courses
if [[ -n "$PM2_NAME" ]]; then
  pm2 restart "$PM2_NAME" || pm2 start server/index.js --name "$PM2_NAME"
else
  echo "Set PM2_NAME to auto-restart, or restart Node manually."
fi
echo "==> Done"
EOF
