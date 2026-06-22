"""Anonymous TTS usage log (SQLite). No IP, text body, or user identifiers."""

from __future__ import annotations

import os
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_SCHEMA = """
CREATE TABLE IF NOT EXISTS usage_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    action TEXT NOT NULL,
    status TEXT NOT NULL,
    voice TEXT,
    lang TEXT,
    text_length INTEGER,
    duration_sec REAL,
    audio_format TEXT,
    elapsed_ms INTEGER,
    http_status INTEGER,
    error_kind TEXT
);
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON usage_events(created_at DESC);
"""

_ALLOWED_ACTIONS = {"tts", "tts_job", "convert_mp3", "refine_subtitles"}
_ALLOWED_STATUS = {"ok", "error"}


def default_usage_log_path(output_dir: Path) -> Path:
    override = os.environ.get("SUPERTONIC3_USAGE_LOG_DB", "").strip()
    if override:
        return Path(override)
    return output_dir / "usage_log.sqlite"


class UsageLogStore:
    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path
        self._lock = threading.Lock()
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path, timeout=10, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

    def _init_db(self) -> None:
        with self._lock:
            with self._connect() as conn:
                conn.executescript(_SCHEMA)
                conn.commit()

    def record(
        self,
        *,
        action: str,
        status: str,
        voice: str | None = None,
        lang: str | None = None,
        text_length: int | None = None,
        duration_sec: float | None = None,
        audio_format: str | None = None,
        elapsed_ms: int | None = None,
        http_status: int | None = None,
        error_kind: str | None = None,
    ) -> None:
        if action not in _ALLOWED_ACTIONS:
            raise ValueError(f"unsupported action: {action}")
        if status not in _ALLOWED_STATUS:
            raise ValueError(f"unsupported status: {status}")

        created_at = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
        with self._lock:
            with self._connect() as conn:
                conn.execute(
                    """
                    INSERT INTO usage_events (
                        created_at, action, status, voice, lang, text_length,
                        duration_sec, audio_format, elapsed_ms, http_status, error_kind
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        created_at,
                        action,
                        status,
                        voice,
                        lang,
                        text_length,
                        duration_sec,
                        audio_format,
                        elapsed_ms,
                        http_status,
                        error_kind,
                    ),
                )
                conn.commit()

    def recent(self, *, limit: int = 20) -> list[dict[str, Any]]:
        safe_limit = max(1, min(int(limit), 100))
        with self._lock:
            with self._connect() as conn:
                rows = conn.execute(
                    """
                    SELECT
                        id, created_at, action, status, voice, lang, text_length,
                        duration_sec, audio_format, elapsed_ms, http_status, error_kind
                    FROM usage_events
                    ORDER BY id DESC
                    LIMIT ?
                    """,
                    (safe_limit,),
                ).fetchall()
        return [dict(row) for row in rows]

    def summary(self) -> dict[str, int]:
        today_prefix = datetime.now().astimezone().date().isoformat()
        with self._lock:
            with self._connect() as conn:
                total = int(conn.execute("SELECT COUNT(*) FROM usage_events").fetchone()[0])
                today = int(
                    conn.execute(
                        "SELECT COUNT(*) FROM usage_events WHERE created_at LIKE ?",
                        (f"{today_prefix}%",),
                    ).fetchone()[0]
                )
                today_ok = int(
                    conn.execute(
                        "SELECT COUNT(*) FROM usage_events WHERE created_at LIKE ? AND status = 'ok'",
                        (f"{today_prefix}%",),
                    ).fetchone()[0]
                )
        return {
            "total": total,
            "today": today,
            "today_ok": today_ok,
            "today_error": today - today_ok,
        }
