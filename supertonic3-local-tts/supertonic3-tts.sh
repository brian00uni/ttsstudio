#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
export PYTHONPATH="$PWD/src${PYTHONPATH:+:$PYTHONPATH}"
PY="python3"
if [ -x .venv/bin/python ]; then
  PY=".venv/bin/python"
fi
exec "$PY" src/supertonic3_cli.py "$@"
