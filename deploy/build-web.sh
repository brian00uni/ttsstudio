#!/usr/bin/env bash
# Build the Vercel site:
#   - React app (web/) at the root  -> web/dist  (bundle under /app-assets)
#   - shared static assets at /public (voice samples, fonts, images, json)
#   - legacy vanilla UI at /legacy   (admin-only "구버전 화면")
# API calls (/api, /audio, /health) are proxied to the HF Space via vercel.json.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB="$ROOT/web"
SRC="$ROOT/supertonic3-local-tts"
DIST="$WEB/dist"

echo "[1/4] Build React app"
cd "$WEB"
npm install
npm run build   # -> web/dist (index.html + /app-assets)

echo "[2/4] Copy shared /public (voice samples, fonts, images, json)"
cp -R "$SRC/public" "$DIST/public"

echo "[3/4] Assemble legacy UI at /legacy"
mkdir -p "$DIST/legacy/assets"
cp "$SRC/ui/index.html" "$DIST/legacy/index.html"
cp "$SRC/ui/"*.js "$SRC/ui/"*.css "$DIST/legacy/assets/"
# Legacy index references /assets/*; remap to /legacy/assets/. Its /public/* and
# /api/* references stay absolute (served from the shared root / proxy).
sed -i.bak 's#/assets/#/legacy/assets/#g' "$DIST/legacy/index.html"
rm -f "$DIST/legacy/index.html.bak"

echo "[4/4] Inject Supabase config"
# Legacy build-time config (server-side env names).
if [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_ANON_KEY:-}" ]; then
  sed -i.bak "s|__SUPABASE_URL__|$SUPABASE_URL|; s|__SUPABASE_ANON_KEY__|$SUPABASE_ANON_KEY|" \
    "$DIST/legacy/assets/supabase-config.js"
  rm -f "$DIST/legacy/assets/supabase-config.js.bak"
  echo "  legacy config injected."
else
  echo "  WARN: SUPABASE_URL/ANON_KEY unset; legacy library disabled."
fi
# (React app reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY at vite build time.)

echo "Done: $DIST"
