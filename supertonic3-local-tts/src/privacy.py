"""Privacy-oriented TTS artifact handling — no text persist, ephemeral audio."""

from __future__ import annotations

import os
import threading
import time
from pathlib import Path
from typing import Any

_SIDEcar_SUFFIXES = (
    "_script.txt",
    "_input_log.txt",
    "_mp3_convert_log.txt",
    "_whisper.srt",
    "_whisper.vtt",
    "_whisper.txt",
    "_whisper.json",
    "_whisper_log.txt",
)


def _bool(value: str | None, *, default: bool) -> bool:
    if value is None or not str(value).strip():
        return default
    return str(value).strip().lower() not in {"0", "false", "no", "off"}


def no_text_persist_enabled() -> bool:
    return _bool(os.environ.get("SUPERTONIC3_NO_TEXT_PERSIST"), default=False)


def ephemeral_audio_enabled() -> bool:
    return _bool(os.environ.get("SUPERTONIC3_EPHEMERAL_AUDIO"), default=False)


def ephemeral_audio_ttl_sec() -> int:
    raw = os.environ.get("SUPERTONIC3_EPHEMERAL_TTL_SEC", "3600").strip()
    try:
        return max(60, min(int(raw), 86_400))
    except ValueError:
        return 3600


def privacy_snapshot() -> dict[str, Any]:
    return {
        "no_text_persist": no_text_persist_enabled(),
        "ephemeral_audio": ephemeral_audio_enabled(),
        "ephemeral_ttl_sec": ephemeral_audio_ttl_sec() if ephemeral_audio_enabled() else None,
        "text_storage": "none" if no_text_persist_enabled() else "sidecar_files",
        "note": "합성 처리 중 메모리 접근은 불가피합니다. 본문 파일·로그 미저장·TTL 삭제만 적용됩니다.",
    }


def artifact_paths_for_audio(audio_path: Path) -> list[Path]:
    audio = audio_path.resolve()
    stem = audio.stem
    parent = audio.parent
    paths: list[Path] = [audio]

    if audio.suffix.lower() == ".wav":
        paths.append(audio.with_suffix(".mp3"))
    elif audio.suffix.lower() == ".mp3":
        paths.append(audio.with_suffix(".wav"))

    paths.extend([
        parent / f"{stem}.srt",
        parent / f"{stem}.vtt",
    ])
    for suffix in _SIDEcar_SUFFIXES:
        paths.append(parent / f"{stem}{suffix}")

    unique: list[Path] = []
    seen: set[str] = set()
    for path in paths:
        key = str(path)
        if key in seen:
            continue
        seen.add(key)
        unique.append(path)
    return unique


def delete_artifacts(paths: list[Path]) -> None:
    for path in paths:
        try:
            if path.is_file():
                path.unlink()
        except OSError:
            pass


def schedule_ephemeral_cleanup(audio_path: Path) -> None:
    if not ephemeral_audio_enabled():
        return
    ttl = ephemeral_audio_ttl_sec()
    paths = artifact_paths_for_audio(audio_path)

    def _cleanup() -> None:
        delete_artifacts(paths)

    timer = threading.Timer(ttl, _cleanup)
    timer.daemon = True
    timer.name = f"ephemeral-cleanup-{audio_path.stem[:24]}"
    timer.start()


def sweep_stale_artifacts(output_dir: Path) -> int:
    if not ephemeral_audio_enabled() or not output_dir.exists():
        return 0

    ttl = ephemeral_audio_ttl_sec()
    cutoff = time.time() - ttl
    removed = 0
    seen_stems: set[str] = set()

    for pattern in ("supertonic3_*.wav", "supertonic3_*.mp3"):
        for path in sorted(output_dir.glob(pattern), key=lambda item: item.stat().st_mtime):
            if not path.is_file():
                continue
            if path.stat().st_mtime >= cutoff:
                continue
            stem = path.stem
            if stem in seen_stems:
                continue
            seen_stems.add(stem)
            bundle = artifact_paths_for_audio(path)
            before = sum(1 for item in bundle if item.exists())
            delete_artifacts(bundle)
            removed += before

    return removed
