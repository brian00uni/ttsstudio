from __future__ import annotations

import argparse
import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


FIXED_ZIP_TIME = (2026, 5, 16, 0, 0, 0)
ROOT_DIR = Path(__file__).resolve().parents[1]
DIST_DIR = ROOT_DIR / "dist"
PUBLIC_SOURCE_DIR_NAME = "002_Public"
PRIVATE_SERVER_DIR_NAME = "001_Server"


def assert_public_packaging_root() -> None:
    """Packaging must run only from 002_Public — never 001_Server."""
    if ROOT_DIR.name != PUBLIC_SOURCE_DIR_NAME:
        raise SystemExit(
            f"create_release_zip.py must use ROOT_DIR={PUBLIC_SOURCE_DIR_NAME}, "
            f"got {ROOT_DIR.name!r}. 001_Server is private Docker only. Never package it.",
        )
    root_text = str(ROOT_DIR).replace("\\", "/")
    if f"/{PRIVATE_SERVER_DIR_NAME}/" in root_text or root_text.endswith(f"/{PRIVATE_SERVER_DIR_NAME}"):
        raise SystemExit(
            f"Packaging path must not include {PRIVATE_SERVER_DIR_NAME}: {ROOT_DIR}",
        )

INCLUDE_ROOT_FILES = [
    "README.md",
    "README-ZIP-\ubc30\ud3ec.md",
    "README-Ver-\uc5c5\ub370\uc774\ud2b8\ud604\ud669.txt",
    "README-\ub9e5-\uc0ac\uc6a9\uc790-\ud544\ub3c5.txt",
    "LICENSE_NOTICES.txt",
    "sample.txt",
    "start-mac.sh",
    "\uc2e4\ud589.bat",
]

INCLUDE_DIRS = [
    "supertonic-upstream",
    "supertonic3-local-tts",
    "supertonic3-whisper-subtitles",
    "scripts",
]

EXCLUDED_DIR_NAMES = {
    ".git",
    ".venv",
    ".venv-win",
    "__pycache__",
    "docs",
    ".pytest_cache",
    ".mypy_cache",
    "node_modules",
    "dist",
    "docker",
}

EXCLUDED_FILE_NAMES = {
    ".gitattributes",
    ".gitignore",
    "README-ZIP-\ubc30\ud3ec-\ubc29\ubc95-\ud604\ud669.md",
    "ads.txt",
    "server.log",
    "server.err",
    "server_stdout.log",
    "server_stderr.log",
    "usage_log.sqlite",
}

EXCLUDED_SUFFIXES = {
    ".pyc",
    ".pyo",
    ".log",
    ".sqlite",
    ".tmp",
}

EXCLUDED_RELATIVE_PREFIXES: set[str] = {
    "docker/",
}

PATH_PLACEHOLDER_ROOT = "<\ubc30\ud3ec_\ub8e8\ud2b8>"
PATH_PLACEHOLDER_HOME = "<\uc0ac\uc6a9\uc790_\ud648>"

# Windows cmd.exe requires CRLF in .bat/.cmd — LF-only lines drop the first character per line.
WINDOWS_BATCH_SUFFIXES = {".bat", ".cmd"}

EXAMPLE_DATA_SOURCE = (
    ROOT_DIR / "docs" / "supertonic3-local-tts-20260517-r4" / "supertonic3-local-tts" / "data"
)

TEXT_SUFFIXES = {
    ".txt",
    ".json",
    ".md",
    ".py",
    ".ps1",
    ".sh",
    ".bat",
    ".html",
    ".js",
    ".css",
    ".toml",
    ".yml",
    ".yaml",
    ".ini",
    ".cfg",
}


@dataclass(frozen=True)
class ReleaseEntry:
    source: Path
    rel_path: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create a clean release ZIP with SHA256 files.")
    parser.add_argument(
        "--version",
        default=datetime.now(timezone.utc).strftime("%Y%m%d"),
        help="Release version label used in the ZIP filename.",
    )
    parser.add_argument(
        "--name",
        default="supertonic3-local-tts",
        help="Base release name.",
    )
    parser.add_argument(
        "--output-dir",
        default="",
        help="Optional output directory for ZIP, manifest, and sha256 files.",
    )
    parser.add_argument(
        "--no-example-data",
        action="store_true",
        help="Skip overlay of demo outputs from docs snapshot when missing locally.",
    )
    return parser.parse_args()


def should_include(path: Path, *, base_dir: Path = ROOT_DIR) -> bool:
    rel = path.relative_to(base_dir).as_posix()
    parts = set(path.relative_to(base_dir).parts)
    if parts & EXCLUDED_DIR_NAMES:
        return False
    if path.name in EXCLUDED_FILE_NAMES:
        return False
    if path.name.startswith("usage_log.sqlite"):
        return False
    if path.suffix.lower() in {".shm", ".wal"}:
        return False
    if path.suffix.lower() in EXCLUDED_SUFFIXES:
        return False
    if any(rel.startswith(prefix) for prefix in EXCLUDED_RELATIVE_PREFIXES):
        return False
    try:
        return path.is_file()
    except OSError:
        return False


def iter_example_overlay_entries(existing_rel_paths: set[str]) -> list[ReleaseEntry]:
    if not EXAMPLE_DATA_SOURCE.is_dir():
        return []
    entries: list[ReleaseEntry] = []
    for path in EXAMPLE_DATA_SOURCE.rglob("*"):
        if not should_include(path, base_dir=EXAMPLE_DATA_SOURCE):
            continue
        rel = path.relative_to(EXAMPLE_DATA_SOURCE).as_posix()
        target_rel = f"supertonic3-local-tts/data/{rel}"
        if target_rel in existing_rel_paths:
            continue
        entries.append(ReleaseEntry(source=path, rel_path=target_rel))
    return entries


def iter_release_entries(include_example_data: bool) -> list[ReleaseEntry]:
    entries: list[ReleaseEntry] = []
    seen_rel_paths: set[str] = set()

    for name in INCLUDE_ROOT_FILES:
        path = ROOT_DIR / name
        if path.is_file() and should_include(path):
            rel = path.relative_to(ROOT_DIR).as_posix()
            entries.append(ReleaseEntry(source=path, rel_path=rel))
            seen_rel_paths.add(rel)

    for dirname in INCLUDE_DIRS:
        root = ROOT_DIR / dirname
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if not should_include(path):
                continue
            rel = path.relative_to(ROOT_DIR).as_posix()
            entries.append(ReleaseEntry(source=path, rel_path=rel))
            seen_rel_paths.add(rel)

    if include_example_data:
        entries.extend(iter_example_overlay_entries(seen_rel_paths))

    unique: dict[str, ReleaseEntry] = {}
    for entry in entries:
        unique[entry.rel_path.lower()] = entry
    return sorted(unique.values(), key=lambda item: item.rel_path.lower())


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def release_bytes(path: Path) -> bytes:
    data = path.read_bytes()
    if path.suffix.lower() not in TEXT_SUFFIXES:
        return data
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        return data
    root_native = str(ROOT_DIR)
    root_posix = ROOT_DIR.as_posix()
    root_json = root_native.replace("\\", "\\\\")
    home_native = str(Path.home())
    home_posix = Path.home().as_posix()
    home_json = home_native.replace("\\", "\\\\")
    text = text.replace(root_json, PATH_PLACEHOLDER_ROOT)
    text = text.replace(root_native, PATH_PLACEHOLDER_ROOT)
    text = text.replace(root_posix, PATH_PLACEHOLDER_ROOT)
    text = text.replace(home_json, PATH_PLACEHOLDER_HOME)
    text = text.replace(home_native, PATH_PLACEHOLDER_HOME)
    text = text.replace(home_posix, PATH_PLACEHOLDER_HOME)
    text = re.sub(r"[A-Za-z]:\\Users\\[^\\\r\n]+", PATH_PLACEHOLDER_HOME, text)
    if path.suffix.lower() in WINDOWS_BATCH_SUFFIXES:
        text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\n", "\r\n")
    return text.encode("utf-8")


def write_zip(entries: list[ReleaseEntry], zip_path: Path, top_dir: str) -> list[dict[str, object]]:
    manifest: list[dict[str, object]] = []
    with ZipFile(zip_path, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for entry in entries:
            arcname = f"{top_dir}/{entry.rel_path}"
            info = ZipInfo(arcname, date_time=FIXED_ZIP_TIME)
            info.compress_type = ZIP_DEFLATED
            mode = 0o755 if entry.source.suffix.lower() == ".sh" else 0o644
            info.external_attr = mode << 16
            data = release_bytes(entry.source)
            archive.writestr(info, data)
            manifest.append({
                "path": entry.rel_path,
                "size": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
                "source": entry.source.relative_to(ROOT_DIR).as_posix()
                if entry.source.is_relative_to(ROOT_DIR)
                else str(entry.source),
            })
    return manifest


def assert_studio_source_ui() -> None:
    ui_path = ROOT_DIR / "supertonic3-local-tts" / "ui" / "index.html"
    if not ui_path.is_file():
        raise SystemExit(f"Missing Studio UI source: {ui_path}")
    text = ui_path.read_text(encoding="utf-8")
    if "Supertonic Studio" not in text and "슈퍼토닉 스튜디오" not in text:
        raise SystemExit(
            "002_Public ui/index.html is not Supertonic Studio. "
            "Do not copy from 001_Server. See separation.md",
        )
    for marker in (
        "Personal TTS API",
        "전용 TTS 서버",
        "googlesyndication.com/pagead/js/adsbygoogle",
    ):
        if marker in text:
            raise SystemExit(
                f"001_Server UI marker in 002_Public source ({marker!r}). Fix before packaging.",
            )


def main() -> int:
    assert_public_packaging_root()
    assert_studio_source_ui()
    args = parse_args()
    release_name = f"{args.name}-{args.version}"
    output_dir = Path(args.output_dir).resolve() if args.output_dir else DIST_DIR
    output_dir.mkdir(parents=True, exist_ok=True)

    zip_path = output_dir / f"{release_name}.zip"
    manifest_path = output_dir / f"{release_name}.manifest.json"
    sha_path = output_dir / f"{release_name}.zip.sha256"

    entries = iter_release_entries(include_example_data=not args.no_example_data)
    manifest = write_zip(entries, zip_path, release_name)
    zip_hash = sha256_file(zip_path)

    manifest_doc = {
        "release_name": release_name,
        "created_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "zip": zip_path.name,
        "zip_sha256": zip_hash,
        "file_count": len(manifest),
        "example_data_source": str(EXAMPLE_DATA_SOURCE.relative_to(ROOT_DIR))
        if EXAMPLE_DATA_SOURCE.is_dir()
        else None,
        "excludes": {
            "directories": sorted(EXCLUDED_DIR_NAMES),
            "file_names": sorted(EXCLUDED_FILE_NAMES),
            "suffixes": sorted(EXCLUDED_SUFFIXES),
            "relative_prefixes": sorted(EXCLUDED_RELATIVE_PREFIXES),
        },
        "files": manifest,
    }
    manifest_path.write_text(json.dumps(manifest_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    sha_path.write_text(f"{zip_hash}  {zip_path.name}\n", encoding="utf-8")

    print(json.dumps({
        "ok": True,
        "zip": str(zip_path),
        "sha256": zip_hash,
        "sha256_file": str(sha_path),
        "manifest": str(manifest_path),
        "file_count": len(manifest),
        "size_bytes": zip_path.stat().st_size,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
