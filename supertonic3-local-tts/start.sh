#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
export PYTHONPATH="$PWD/src${PYTHONPATH:+:$PYTHONPATH}"
# Bind to loopback by default. Use SUPERTONIC3_HOST=0.0.0.0 only on a trusted LAN.
export SUPERTONIC3_HOST="${SUPERTONIC3_HOST:-127.0.0.1}"
export SUPERTONIC3_PORT="${SUPERTONIC3_PORT:-3093}"
if [ -x .venv/bin/python ]; then
  exec .venv/bin/python src/app.py
fi
exec python3 src/app.py
