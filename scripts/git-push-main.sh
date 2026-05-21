#!/bin/bash
# Sync local main with origin: commit if needed, rebase, push.
# Usage (from repo root): bash scripts/git-push-main.sh ["commit message"]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v git >/dev/null 2>&1; then
  echo "git is not installed or not in PATH. Install git and try again." >&2
  exit 1
fi

if [[ -n $(git status --porcelain 2>/dev/null) ]]; then
  MSG="${1:-Update}"
  git add -A
  git commit -m "$MSG"
fi

git pull --rebase origin main
git push origin main
echo "OK — main is synced with origin."
