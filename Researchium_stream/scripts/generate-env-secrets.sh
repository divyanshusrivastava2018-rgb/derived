#!/usr/bin/env bash
# Generates random secrets for .env (run once, then copy output into .env)
set -euo pipefail
gen() { openssl rand -hex 32; }
echo "POSTGRES_PASSWORD=$(gen)"
echo "JWT_SECRET=$(gen)"
echo "API_KEY=$(gen)"
echo "INTERNAL_SERVICE_KEY=$(gen)"
