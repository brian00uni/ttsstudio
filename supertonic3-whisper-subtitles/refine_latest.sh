#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DATA_DIR="${DATA_DIR:-../supertonic3-local-tts/data}"
MODEL="${MODEL:-medium}"
LANGUAGE="${LANGUAGE:-ko}"
COMPUTE_TYPE="${COMPUTE_TYPE:-int8}"
CPU_THREADS="${CPU_THREADS:-8}"

if [ ! -x ".venv/bin/python" ]; then
  python3 -m venv .venv
  ./.venv/bin/python -m pip install -r requirements.txt
fi

./.venv/bin/python ./whisper_subtitle_refiner.py \
  --latest-from "$DATA_DIR" \
  --model "$MODEL" \
  --language "$LANGUAGE" \
  --compute-type "$COMPUTE_TYPE" \
  --cpu-threads "$CPU_THREADS"
