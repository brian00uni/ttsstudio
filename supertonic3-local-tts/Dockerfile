# Supertonic3 TTS backend — production container (Render/Railway/Fly.io)
FROM python:3.12-slim

# ffmpeg is needed for MP3 conversion; build tools for any native wheels
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/app/.hf-cache \
    SUPERTONIC3_OUTPUT_DIR=/app/data

WORKDIR /app

# Install Python deps first (better layer caching)
COPY requirements.txt ./
RUN pip install --upgrade pip \
    && pip install -r requirements.txt \
    && pip install "gunicorn>=23.0"

# App source
COPY src ./src
COPY ui ./ui
COPY public ./public

RUN mkdir -p /app/data /app/.hf-cache

# Render/Railway inject $PORT. Default to 3093 for local docker runs.
ENV PORT=3093
EXPOSE 3093

# Public deployment guards (rate limits, size caps) on by default for the hosted backend.
ENV SUPERTONIC3_PUBLIC_MODE=1

WORKDIR /app/src
# Single worker: the ONNX engine is cached per-process and synthesis holds a lock.
# Long timeout because first request downloads the model and synthesis is CPU-bound.
CMD ["sh", "-c", "gunicorn app:app --bind 0.0.0.0:${PORT} --workers 1 --threads 4 --timeout 600"]
