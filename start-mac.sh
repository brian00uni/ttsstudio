#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TTS_DIR="$ROOT_DIR/supertonic3-local-tts"
WHISPER_DIR="$ROOT_DIR/supertonic3-whisper-subtitles"
TTS_VENV="$TTS_DIR/.venv"
WHISPER_VENV="$WHISPER_DIR/.venv"
HOST="${SUPERTONIC3_HOST:-127.0.0.1}"
PORT="${SUPERTONIC3_PORT:-3093}"

fail() {
  echo
  echo "[ERROR] $*"
  echo "Please copy the 20-40 lines above this message when reporting the error."
  exit 1
}

find_python() {
  local candidate
  for candidate in python3.12 python3.11 python3.10 python3.13 python3; do
    if command -v "$candidate" >/dev/null 2>&1; then
      if "$candidate" -c 'import sys, venv; raise SystemExit(0 if (sys.version_info.major == 3 and 10 <= sys.version_info.minor <= 13) else 1)' >/dev/null 2>&1; then
        command -v "$candidate"
        return 0
      fi
    fi
  done
  return 1
}

try_create_venv() {
  local python_bin="$1"
  local venv_dir="$2"
  local requirements="$3"
  if ! "$python_bin" -c 'import sys, venv; raise SystemExit(0 if (sys.version_info.major == 3 and 10 <= sys.version_info.minor <= 13) else 1)' >/dev/null 2>&1; then
    return 1
  fi
  echo "[SETUP] Trying $python_bin ..."
  rm -rf "$venv_dir"
  if ! "$python_bin" -m venv "$venv_dir"; then
    return 1
  fi
  if ! "$venv_dir/bin/python" -c "import sys" >/dev/null 2>&1; then
    rm -rf "$venv_dir"
    return 1
  fi
  "$venv_dir/bin/python" -m pip install --upgrade pip
  "$venv_dir/bin/python" -m pip install -r "$requirements"
  return 0
}

ensure_venv() {
  local label="$1"
  local target_dir="$2"
  local venv_dir="$3"
  local requirements="$4"

  if [ -x "$venv_dir/bin/python" ]; then
    if "$venv_dir/bin/python" -c "import sys" >/dev/null 2>&1; then
      echo "[SETUP] $label venv exists. Skipped."
      return 0
    fi
    echo "[WARN] $label venv exists but Python is not usable. Recreating it."
    rm -rf "$venv_dir"
  fi

  local python_bin=""
  for candidate in python3.12 python3.11 python3.10 python3.13 python3; do
    if command -v "$candidate" >/dev/null 2>&1; then
      if try_create_venv "$(command -v "$candidate")" "$venv_dir" "$requirements"; then
        echo "[SETUP] $label venv ready."
        return 0
      fi
    fi
  done

  python_bin="$(find_python)" || true
  if [ -n "$python_bin" ] && try_create_venv "$python_bin" "$venv_dir" "$requirements"; then
    echo "[SETUP] $label venv ready."
    return 0
  fi

  echo "[ERROR] Could not create $label venv with Python 3.10-3.13."
  return 1
}

find_port() {
  "$TTS_VENV/bin/python" - "$HOST" "$PORT" <<'PY'
import socket
import sys

host = sys.argv[1]
start = int(sys.argv[2])
for port in range(start, 65536):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind((host, port))
    except OSError:
        sock.close()
        continue
    sock.close()
    print(port)
    raise SystemExit(0)
raise SystemExit(1)
PY
}

echo "============================================================"
echo "Supertonic3 Local TTS macOS/Linux startup"
echo "============================================================"
echo "Project root : $ROOT_DIR"
echo "TTS folder   : $TTS_DIR"
echo "Whisper tool : $WHISPER_DIR"
echo

[ -f "$TTS_DIR/src/app.py" ] || fail "TTS app was not found: $TTS_DIR/src/app.py"
[ -f "$TTS_DIR/requirements.txt" ] || fail "TTS requirements were not found: $TTS_DIR/requirements.txt"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "[WARN] ffmpeg was not found."
  echo "       TTS WAV generation can still work without ffmpeg."
  echo "       For broader media/subtitle workflows on macOS, install it manually:"
  echo "       brew install ffmpeg"
fi

ensure_venv "TTS" "$TTS_DIR" "$TTS_VENV" "$TTS_DIR/requirements.txt" || fail "Could not prepare the TTS Python environment. Python 3.11 or 3.12 is recommended."

if [ -f "$WHISPER_DIR/requirements.txt" ]; then
  if ensure_venv "Whisper" "$WHISPER_DIR" "$WHISPER_VENV" "$WHISPER_DIR/requirements.txt"; then
    export SUPERTONIC3_WHISPER_DIR="$WHISPER_DIR"
    export SUPERTONIC3_WHISPER_PYTHON="$WHISPER_VENV/bin/python"
  else
    echo "[WARN] Whisper setup failed. TTS server can still run without subtitle refinement."
  fi
fi

OPEN_PORT="$(find_port)" || fail "Could not find an accessible local port."
if [ "$OPEN_PORT" != "$PORT" ]; then
  echo "[WARN] Port $PORT cannot be opened on $HOST."
  echo "[INFO] This copy will start on port $OPEN_PORT instead."
  PORT="$OPEN_PORT"
fi

export SUPERTONIC3_HOST="$HOST"
export SUPERTONIC3_PORT="$PORT"
export SUPERTONIC3_PUBLIC_MODE="0"
export SUPERTONIC3_OUTPUT_DIR="${SUPERTONIC3_OUTPUT_DIR:-$TTS_DIR/data}"

echo
echo "[READY] Python: $TTS_VENV/bin/python"
echo "[READY] URL: http://$HOST:$PORT"
echo "[RUN] Starting server. Press Ctrl+C in this terminal to stop it."
echo

if command -v open >/dev/null 2>&1; then
  open "http://$HOST:$PORT" >/dev/null 2>&1 || true
fi

cd "$TTS_DIR"
exec "$TTS_VENV/bin/python" src/app.py
