#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

PORT_VALUE="${PORT:-3000}"

# Kill any existing listener on the requested port.
pids="$(lsof -tiTCP:${PORT_VALUE} -sTCP:LISTEN 2>/dev/null || true)"
if [ -n "$pids" ]; then
  echo "Stopping existing process(es) on port ${PORT_VALUE}: $pids"
  kill $pids || true
  sleep 0.3
  # Force kill if still alive.
  pids2="$(lsof -tiTCP:${PORT_VALUE} -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$pids2" ]; then
    kill -9 $pids2 || true
  fi
fi

exec node server/index.js
