#!/usr/bin/env bash
# Assemble the static frontend for Vercel from the backend's ui/ and public/.
# Output: web-dist/ (index.html + /assets + /public), matching the paths the UI
# references. API calls (/api, /audio, /health) are proxied to the HF Space
# backend via vercel.json rewrites, so no UI code changes are needed.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/supertonic3-local-tts"
OUT="$ROOT/web-dist"

rm -rf "$OUT"
mkdir -p "$OUT/assets"

cp "$SRC/ui/index.html" "$OUT/index.html"
cp "$SRC/ui/main.js" "$SRC/ui/style.css" "$OUT/assets/"
cp -R "$SRC/public" "$OUT/public"

echo "Built $OUT:"
find "$OUT" -maxdepth 2 -type d | sed "s#$OUT#  web-dist#"
