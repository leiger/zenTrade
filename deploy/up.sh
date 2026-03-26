#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

if [ ! -f .env.production ]; then
  echo "ERROR: .env.production not found."
  exit 1
fi

cp .env.production .env
echo "Synced .env from .env.production"

exec docker compose up -d "$@"
