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
# copy all UI scripts/styles (main.js, style.css, supabase-*.js) into /assets
cp "$SRC/ui/"*.js "$SRC/ui/"*.css "$OUT/assets/"
cp -R "$SRC/public" "$OUT/public"

# Inject Supabase credentials from env into the built config (keeps secrets out
# of git; the anon key is public/RLS-protected so env in Vercel is fine).
if [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_ANON_KEY:-}" ]; then
  sed -i.bak "s|__SUPABASE_URL__|$SUPABASE_URL|; s|__SUPABASE_ANON_KEY__|$SUPABASE_ANON_KEY|" \
    "$OUT/assets/supabase-config.js"
  rm -f "$OUT/assets/supabase-config.js.bak"
  echo "Injected Supabase config from env."
else
  echo "WARN: SUPABASE_URL / SUPABASE_ANON_KEY not set; library/auth will be disabled."
fi

echo "Built $OUT:"
find "$OUT" -maxdepth 2 -type d | sed "s#$OUT#  web-dist#"
