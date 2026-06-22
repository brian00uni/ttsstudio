#!/usr/bin/env bash
# Push the TTS backend to a Hugging Face Docker Space.
#
# Prereqs:
#   1) Create the Space on huggingface.co (New Space -> Docker -> blank).
#   2) Authenticate once:  hf auth login   (or: huggingface-cli login)
#
# Usage:
#   deploy/push-hf-space.sh <hf-username>/<space-name>
#   e.g. deploy/push-hf-space.sh brian00uni/ttsstudio-backend
set -euo pipefail

SPACE="${1:?Usage: push-hf-space.sh <user>/<space-name>}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$REPO_ROOT/supertonic3-local-tts"
HF_README="$REPO_ROOT/deploy/hf-space/README.md"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Authenticate git pushes to HF using the token stored by `hf auth login`.
HF="$BACKEND/.venv/bin/hf"
TOKEN="$("$HF" auth token 2>/dev/null || true)"
[ -n "$TOKEN" ] || { echo "No HF token. Run: $HF auth login"; exit 1; }
REMOTE="https://user:${TOKEN}@huggingface.co/spaces/$SPACE"

echo "[1/4] Cloning Space repo: https://huggingface.co/spaces/$SPACE"
git clone "$REMOTE" "$WORK/space"

echo "[2/4] Syncing backend files into the Space"
# Exclude binary assets (fonts, images, audio): HF rejects non-LFS binaries,
# and these are frontend assets served by Vercel, not needed by the API backend.
rsync -a --delete \
  --exclude '.git/' --exclude '.venv/' --exclude '__pycache__/' \
  --exclude 'data/' --exclude '.DS_Store' \
  --exclude 'public/voice-samples/' --exclude 'public/font/' \
  --exclude '*.wav' --exclude '*.mp3' \
  --exclude '*.jpg' --exclude '*.jpeg' --exclude '*.png' --exclude '*.ico' \
  --exclude '*.ttf' --exclude '*.woff' --exclude '*.woff2' \
  "$BACKEND"/ "$WORK/space"/
# HF Space root README with required metadata header
cp "$HF_README" "$WORK/space/README.md"

echo "[3/4] Commit"
cd "$WORK/space"
git add -A
git -c user.email="brian00uni@gmail.com" -c user.name="brian00uni" \
  commit -m "Deploy backend from ttsstudio @ $(cd "$REPO_ROOT" && git rev-parse --short HEAD)" \
  || { echo "Nothing to commit."; exit 0; }

echo "[4/4] Push to Hugging Face"
git push "$REMOTE" HEAD:main

echo "Done. Space building at: https://huggingface.co/spaces/$SPACE"
