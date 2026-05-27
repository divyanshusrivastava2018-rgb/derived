#!/usr/bin/env bash
# Start Researchium main server (3000) + Stream API (4000) for local studio dev.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

fuser -k 3000/tcp 4000/tcp 2>/dev/null || true
sleep 1

echo "[Researchium] Starting Stream API on :4000..."
(cd Researchium_stream && npm run dev:api) &
API_PID=$!
sleep 3

if ! curl -sf http://127.0.0.1:4000/health >/dev/null; then
  echo "[Researchium] Warning: Stream API did not respond on :4000 yet."
fi

echo "[Researchium] Starting main server on :3000..."
trap 'kill $API_PID 2>/dev/null || true' EXIT
npm start
