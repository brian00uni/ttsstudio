---
title: Ttsstudio Backend
emoji: 🎙️
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
short_description: Supertonic3 local TTS inference backend
---

# ttsstudio backend

Supertonic3 TTS inference API + UI, packaged as a Docker Space.

- Source of truth: https://github.com/brian00uni/ttsstudio
- This Space mirrors `supertonic3-local-tts/` from that repo.
- Endpoints: `GET /health`, `POST /api/tts`, static UI at `/`.

Deployed via `deploy/push-hf-space.sh` in the GitHub repo.
