"""Lightweight in-memory rate limits for a single public TTS instance."""

from __future__ import annotations

import os
import re
import threading
import time
from collections import defaultdict
from typing import Callable

from flask import Request, jsonify, request

_BLOCK_PATH = re.compile(
    r"(^|/)(\.env|\.git|wp-admin|wp-login|phpmyadmin|\.aws|actuator)(/|$)",
    re.I,
)


def _env_int(name: str, default: int, minimum: int = 1, maximum: int = 10_000) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return max(minimum, min(maximum, int(raw)))
    except ValueError:
        return default


def client_ip(request: Request) -> str:
    for header in ("CF-Connecting-IP", "True-Client-IP", "X-Real-IP"):
        value = (request.headers.get(header) or "").strip()
        if value:
            return value.split(",")[0].strip()
    forwarded = (request.headers.get("X-Forwarded-For") or "").strip()
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "unknown"


class SlidingWindowLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()

    def allow(self, key: str, limit: int, window_sec: float) -> tuple[bool, int]:
        if limit <= 0:
            return True, 0
        now = time.monotonic()
        cutoff = now - window_sec
        with self._lock:
            bucket = [t for t in self._hits[key] if t > cutoff]
            if len(bucket) >= limit:
                retry = max(1, int(window_sec - (now - bucket[0])))
                self._hits[key] = bucket
                return False, retry
            bucket.append(now)
            self._hits[key] = bucket
            return True, 0


_limiter = SlidingWindowLimiter()


def register_public_guards(app) -> None:
    tts_per_min = _env_int("SUPERTONIC3_RL_TTS_PER_MIN", 12, 1, 120)
    job_per_min = _env_int("SUPERTONIC3_RL_JOB_PER_MIN", 4, 1, 60)
    refine_per_min = _env_int("SUPERTONIC3_RL_REFINE_PER_MIN", 1, 1, 20)
    convert_per_min = _env_int("SUPERTONIC3_RL_CONVERT_PER_MIN", 6, 1, 60)
    write_per_min = _env_int("SUPERTONIC3_RL_WRITE_PER_MIN", 6, 1, 120)
    api_read_per_min = _env_int("SUPERTONIC3_RL_READ_PER_MIN", 120, 10, 2000)
    audio_read_per_min = _env_int("SUPERTONIC3_RL_AUDIO_PER_MIN", 240, 10, 5000)
    window_sec = float(_env_int("SUPERTONIC3_RL_WINDOW_SEC", 60, 10, 3600))
    max_body = _env_int("SUPERTONIC3_MAX_BODY_BYTES", 64_000, 1024, 2_000_000)
    max_active_jobs = _env_int("SUPERTONIC3_MAX_ACTIVE_JOBS", 2, 1, 20)

    app.config["MAX_CONTENT_LENGTH"] = max_body

    active_jobs: dict[str, int] = {"count": 0}
    jobs_lock = threading.Lock()

    @app.before_request
    def _guard_request() -> tuple | None:
        path = request.path or "/"
        if _BLOCK_PATH.search(path):
            return jsonify({"ok": False, "error": "not found"}), 404

        if request.method in {"POST", "PUT", "PATCH"}:
            length = request.content_length
            if length is not None and length > max_body:
                return jsonify({"ok": False, "error": "request body too large"}), 413

        ip = client_ip(request)
        method = request.method.upper()

        if method == "POST" and path == "/api/tts":
            ok, retry = _limiter.allow(f"tts:{ip}", tts_per_min, window_sec)
            if not ok:
                return _rate_response(retry)
        elif method == "POST" and path == "/api/tts-job":
            ok, retry = _limiter.allow(f"job:{ip}", job_per_min, window_sec)
            if not ok:
                return _rate_response(retry)
        elif method == "POST" and path == "/api/refine-subtitles":
            ok, retry = _limiter.allow(f"refine:{ip}", refine_per_min, window_sec)
            if not ok:
                return _rate_response(retry)
        elif method == "POST" and path == "/api/convert-mp3":
            ok, retry = _limiter.allow(f"convert:{ip}", convert_per_min, window_sec)
            if not ok:
                return _rate_response(retry)
        elif method == "POST" and path == "/api/script-requests":
            ok, retry = _limiter.allow(f"write:{ip}", write_per_min, window_sec)
            if not ok:
                return _rate_response(retry)
        elif path.startswith("/api/") and method in {"GET", "HEAD"}:
            ok, retry = _limiter.allow(f"read:{ip}", api_read_per_min, window_sec)
            if not ok:
                return _rate_response(retry)
        elif path.startswith("/audio/") and method in {"GET", "HEAD"}:
            ok, retry = _limiter.allow(f"audio:{ip}", audio_read_per_min, window_sec)
            if not ok:
                return _rate_response(retry)
        return None

    def try_reserve_job() -> bool:
        with jobs_lock:
            if active_jobs["count"] >= max_active_jobs:
                return False
            active_jobs["count"] += 1
            return True

    def release_job() -> None:
        with jobs_lock:
            active_jobs["count"] = max(0, active_jobs["count"] - 1)

    app.extensions["job_rate_trackers"] = {
        "reserve": try_reserve_job,
        "release": release_job,
    }


def _rate_response(retry_sec: int):
    response = jsonify({"ok": False, "error": "rate limit exceeded", "retry_after_sec": retry_sec})
    response.status_code = 429
    response.headers["Retry-After"] = str(retry_sec)
    return response


def limits_snapshot() -> dict[str, int | float]:
    return {
        "tts_per_window": _env_int("SUPERTONIC3_RL_TTS_PER_MIN", 12, 1, 120),
        "job_per_window": _env_int("SUPERTONIC3_RL_JOB_PER_MIN", 4, 1, 60),
        "refine_per_window": _env_int("SUPERTONIC3_RL_REFINE_PER_MIN", 1, 1, 20),
        "convert_per_window": _env_int("SUPERTONIC3_RL_CONVERT_PER_MIN", 6, 1, 60),
        "write_per_window": _env_int("SUPERTONIC3_RL_WRITE_PER_MIN", 6, 1, 120),
        "read_per_window": _env_int("SUPERTONIC3_RL_READ_PER_MIN", 120, 10, 2000),
        "audio_per_window": _env_int("SUPERTONIC3_RL_AUDIO_PER_MIN", 240, 10, 5000),
        "window_sec": _env_int("SUPERTONIC3_RL_WINDOW_SEC", 60, 10, 3600),
        "max_body_bytes": _env_int("SUPERTONIC3_MAX_BODY_BYTES", 64_000, 1024, 2_000_000),
        "max_active_jobs": _env_int("SUPERTONIC3_MAX_ACTIVE_JOBS", 2, 1, 20),
    }


def job_trackers(app) -> tuple[Callable[[], bool], Callable[[], None]]:
    trackers = app.extensions.get("job_rate_trackers") or {}
    return (
        trackers.get("reserve", lambda: True),
        trackers.get("release", lambda: None),
    )
