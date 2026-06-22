# Supertonic3 TTS backend — production container.
# Works on Hugging Face Spaces (Docker SDK, port 7860, runs as uid 1000)
# and on Render/Railway (which inject $PORT).
FROM python:3.12-slim

# ffmpeg is needed for MP3 conversion
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Non-root user (Hugging Face Spaces runs containers as uid 1000)
RUN useradd -m -u 1000 user

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/home/user/.cache/huggingface \
    SUPERTONIC3_OUTPUT_DIR=/home/user/data \
    SUPERTONIC3_PUBLIC_MODE=1

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

# Writable dirs owned by the runtime user
RUN mkdir -p /home/user/data /home/user/.cache/huggingface \
    && chown -R user /home/user

USER user

# HF Spaces expects port 7860 (set via app_port in README). Render injects $PORT.
ENV PORT=7860
EXPOSE 7860

WORKDIR /app/src
# Single worker: ONNX engine is cached per-process and synthesis holds a lock.
# Long timeout: first request downloads the model; synthesis is CPU-bound.
CMD ["sh", "-c", "gunicorn app:app --bind 0.0.0.0:${PORT:-7860} --workers 1 --threads 4 --timeout 600"]
