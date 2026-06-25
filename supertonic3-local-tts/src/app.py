from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

from flask import Flask, jsonify, request, send_from_directory

from rate_limit import job_trackers, limits_snapshot, register_public_guards
from privacy import (
    ephemeral_audio_enabled,
    ephemeral_audio_ttl_sec,
    no_text_persist_enabled,
    privacy_snapshot,
    schedule_ephemeral_cleanup,
    sweep_stale_artifacts,
)
from supertonic3_engine import EXPRESSION_TAGS, Supertonic3Engine, default_output_dir, option_metadata, sanitize_tts_text
from usage_log import UsageLogStore, default_usage_log_path


def _public_deploy_enabled() -> bool:
    """001_Server Docker only. Local ZIP (002_Public) must leave this unset/false."""
    raw = os.environ.get("SUPERTONIC3_PUBLIC_MODE", "").strip().lower()
    return raw in {"1", "true", "yes", "on"}


ALLOWED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".srt", ".vtt", ".txt", ".json"}


def _package_version(distribution: str) -> str | None:
    try:
        from importlib.metadata import version

        return version(distribution)
    except Exception:
        return None


def _runtime_versions() -> dict[str, str | None]:
    return {
        "python": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "flask": _package_version("flask"),
        "supertonic": _package_version("supertonic"),
        "numpy": _package_version("numpy"),
        "soundfile": _package_version("soundfile"),
        "onnxruntime": _package_version("onnxruntime"),
        "huggingface_hub": _package_version("huggingface_hub"),
    }


def _supertonic_import_status() -> dict[str, Any]:
    try:
        from supertonic import TTS  # noqa: F401

        return {"ok": True}
    except Exception as exc:
        return {"ok": False, "error": f"{type(exc).__name__}: {exc}"}


def create_app(engine_factory: Callable[[], Any] | None = None) -> Flask:
    root = Path(__file__).resolve().parents[1]
    ui_dir = root / "ui"
    public_dir = root / "public"
    output_dir = default_output_dir()
    factory = engine_factory or (lambda: Supertonic3Engine(output_dir=output_dir))
    engine_cache: dict[str, Any] = {}
    engine_lock = threading.Lock()
    jobs: dict[str, dict[str, Any]] = {}
    jobs_lock = threading.Lock()
    usage_log_store = UsageLogStore(default_usage_log_path(output_dir))

    def log_usage(**fields: Any) -> None:
        try:
            usage_log_store.record(**fields)
        except Exception:
            pass

    app = Flask(__name__, static_folder=None)
    app.config["JSON_AS_ASCII"] = False
    if _public_deploy_enabled():
        register_public_guards(app)
    else:
        app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024

    if ephemeral_audio_enabled():
        threading.Thread(
            target=sweep_stale_artifacts,
            args=(output_dir,),
            name="ephemeral-sweep-startup",
            daemon=True,
        ).start()

    def get_engine():
        if "engine" not in engine_cache:
            engine_cache["engine"] = factory()
        return engine_cache["engine"]

    def run_tts_generation(text: str, params: dict[str, Any]) -> dict[str, Any]:
        tts_text = sanitize_tts_text(text)
        if not tts_text:
            raise ValueError("text is empty after removing unsupported characters")
        filename = f"ts_{time.strftime('%m%d')}_{uuid.uuid4().hex[:4]}.wav"
        out = output_dir / filename
        with engine_lock:
            info = get_engine().synthesize_to_file(
                text=tts_text,
                output_path=out,
                **params,
            )
        path = Path(info["path"])
        sidecars = _write_sidecar_files(path, tts_text, params, info)
        payload = _tts_response_payload(path, sidecars, params, info)
        payload = _enrich_audio_delivery(output_dir, path, payload)
        schedule_ephemeral_cleanup(path)
        return payload

    @app.get("/")
    def index():
        return send_from_directory(ui_dir, "index.html")

    @app.get("/license-notices")
    def license_notices():
        return send_from_directory(root.parent, "LICENSE_NOTICES.txt", mimetype="text/plain; charset=utf-8")

    if _public_deploy_enabled():

        @app.get("/license")
        def license_page():
            return send_from_directory(ui_dir, "license.html")

        @app.get("/api/license-info")
        def license_info():
            ffmpeg = _ffmpeg_runtime_info()
            return jsonify({
                "ok": True,
                "service_mode": "saas_no_distribution",
                "service_url": "https://tts.min-inter.co.kr",
                "license_page": "/license",
                "license_notices": "/license-notices",
                "ffmpeg_distributed_to_users": False,
                "docker_image_distributed": False,
                "auto_mp3": _auto_mp3_enabled(),
                "ffmpeg": ffmpeg,
                "upstream": {
                    "ffmpeg_legal": "https://www.ffmpeg.org/legal.html",
                    "supertonic": "https://github.com/supertone-inc/supertonic",
                    "supertonic3_model": "https://huggingface.co/Supertone/supertonic-3/blob/main/LICENSE",
                },
            })

    @app.get("/assets/<path:name>")
    def assets(name: str):
        return send_from_directory(ui_dir, name)

    @app.get("/public/<path:name>")
    def public_files(name: str):
        return send_from_directory(public_dir, name)

    if _public_deploy_enabled():

        @app.get("/ads.txt")
        def ads_txt():
            return send_from_directory(public_dir, "ads.txt", mimetype="text/plain; charset=utf-8")

    if _public_deploy_enabled():

        @app.get("/api/usage-log")
        def usage_log_api():
            raw_limit = request.args.get("limit", "20")
            try:
                limit = int(raw_limit)
            except (TypeError, ValueError):
                limit = 20
            return jsonify({
                "ok": True,
                "privacy": "IP·본문·식별정보 미수집 · sidecar 미저장 · TTL 자동삭제",
                "policy": privacy_snapshot(),
                "summary": usage_log_store.summary(),
                "events": usage_log_store.recent(limit=limit),
            })

    @app.get("/health")
    def health():
        supertonic_status = _supertonic_import_status()
        versions = _runtime_versions()
        return jsonify({
            "ok": supertonic_status.get("ok", False),
            "engine": "supertonic3-local",
            "mode": "public_api" if _public_deploy_enabled() else "local",
            "output_dir": str(output_dir),
            "model_loaded": "engine" in engine_cache,
            "default_model": "supertonic-3",
            "auto_mp3": _auto_mp3_enabled(),
            "public": _public_deploy_enabled(),
            "privacy": privacy_snapshot() if _public_deploy_enabled() else {"mode": "local_zip"},
            "supertonic_import": supertonic_status,
            "rate_limits": limits_snapshot() if _public_deploy_enabled() else {},
            "versions": versions,
        })

    @app.get("/api/options")
    def options():
        try:
            engine = get_engine()
            data = engine.options() if hasattr(engine, "options") else option_metadata()
            return jsonify({"ok": True, **data})
        except Exception as exc:
            return jsonify({"ok": False, "error": str(exc)}), 500

    @app.get("/api/voices")
    def voices():
        try:
            voices = get_engine().list_voices()
            return jsonify({"ok": True, "voices": voices})
        except Exception as exc:
            return jsonify({"ok": False, "error": str(exc)}), 500

    @app.post("/api/tts")
    def tts():
        payload = request.get_json(silent=True) or {}
        text = str(payload.get("text") or "").strip()
        if not text:
            return jsonify({"ok": False, "error": "text is required"}), 400

        try:
            params = _parse_tts_payload(payload)
        except (TypeError, ValueError) as exc:
            return jsonify({"ok": False, "error": str(exc)}), 400

        started = time.perf_counter()
        try:
            result = run_tts_generation(text, params)
            log_usage(
                action="tts",
                status="ok",
                voice=str(result.get("voice") or params.get("voice") or ""),
                lang=str(result.get("lang") or params.get("lang") or ""),
                text_length=len(text),
                duration_sec=_optional_float(result.get("duration")),
                audio_format=_optional_str(result.get("audio_format")),
                elapsed_ms=int((time.perf_counter() - started) * 1000),
                http_status=200,
            )
            return jsonify(result)
        except Exception as exc:
            log_usage(
                action="tts",
                status="error",
                voice=str(params.get("voice") or ""),
                lang=str(params.get("lang") or ""),
                text_length=len(text),
                elapsed_ms=int((time.perf_counter() - started) * 1000),
                http_status=500,
                error_kind=_usage_error_kind(exc),
            )
            return jsonify({"ok": False, "error": str(exc)}), 500

    @app.post("/api/tts-job")
    def create_tts_job():
        payload = request.get_json(silent=True) or {}
        text = str(payload.get("text") or "").strip()
        if not text:
            return jsonify({"ok": False, "error": "text is required"}), 400

        try:
            params = _parse_tts_payload(payload)
        except (TypeError, ValueError) as exc:
            return jsonify({"ok": False, "error": str(exc)}), 400

        job_id = uuid.uuid4().hex
        now = datetime.now().isoformat(timespec="seconds")
        with jobs_lock:
            jobs[job_id] = {
                "ok": True,
                "job_id": job_id,
                "status": "queued",
                "message": "대기 중(Queued)",
                "created_at": now,
                "updated_at": now,
                "text_length": len(text),
            }

        reserve_job, release_job = job_trackers(app)
        if not reserve_job():
            return jsonify({"ok": False, "error": "too many active jobs, try later"}), 429

        def worker():
            started = time.perf_counter()
            _update_job(jobs, jobs_lock, job_id, status="running", message="음성 생성 중(Generating audio)")
            try:
                result = run_tts_generation(text, params)
                _update_job(
                    jobs,
                    jobs_lock,
                    job_id,
                    status="done",
                    message="완료(Done)",
                    result=result,
                )
                log_usage(
                    action="tts_job",
                    status="ok",
                    voice=str(result.get("voice") or params.get("voice") or ""),
                    lang=str(result.get("lang") or params.get("lang") or ""),
                    text_length=len(text),
                    duration_sec=_optional_float(result.get("duration")),
                    audio_format=_optional_str(result.get("audio_format")),
                    elapsed_ms=int((time.perf_counter() - started) * 1000),
                    http_status=200,
                )
            except Exception as exc:
                _update_job(
                    jobs,
                    jobs_lock,
                    job_id,
                    status="error",
                    message=str(exc),
                    error=str(exc),
                )
                log_usage(
                    action="tts_job",
                    status="error",
                    voice=str(params.get("voice") or ""),
                    lang=str(params.get("lang") or ""),
                    text_length=len(text),
                    elapsed_ms=int((time.perf_counter() - started) * 1000),
                    http_status=500,
                    error_kind=_usage_error_kind(exc),
                )
            finally:
                release_job()

        thread = threading.Thread(target=worker, name=f"tts-job-{job_id[:8]}", daemon=True)
        thread.start()
        return jsonify(jobs[job_id]), 202

    @app.get("/api/tts-job/<job_id>")
    def get_tts_job(job_id: str):
        with jobs_lock:
            job = jobs.get(job_id)
            if not job:
                return jsonify({"ok": False, "error": "job not found"}), 404
            return jsonify(job)

    @app.get("/api/latest-output")
    def latest_output():
        result = _latest_output_payload(output_dir)
        if not result:
            return jsonify({"ok": False, "error": "no output found"}), 404
        return jsonify({"ok": True, "status": "done", "result": result})

    @app.get("/api/script-customs")
    def list_script_customs():
        try:
            return jsonify({"ok": True, "scripts": _list_script_customs(output_dir)})
        except Exception as exc:
            return jsonify({"ok": False, "error": str(exc)}), 500

    @app.get("/api/script-customs/<path:name>")
    def get_script_custom(name: str):
        try:
            path = _resolve_script_custom_path(output_dir, name)
            return jsonify({
                "ok": True,
                "name": path.name,
                "title": path.stem,
                "text": _read_text_with_fallback(path),
                "path": str(path),
                "relative_path": _output_relative_path(output_dir, path),
            })
        except FileNotFoundError as exc:
            return jsonify({"ok": False, "error": str(exc)}), 404
        except (TypeError, ValueError) as exc:
            return jsonify({"ok": False, "error": str(exc)}), 400
        except Exception as exc:
            return jsonify({"ok": False, "error": str(exc)}), 500

    @app.post("/api/script-requests")
    def create_script_request():
        if no_text_persist_enabled():
            return jsonify({
                "ok": False,
                "error": "script-requests disabled while SUPERTONIC3_NO_TEXT_PERSIST is enabled",
            }), 403
        payload = request.get_json(silent=True) or {}
        try:
            data, path, latest_path = _write_script_request(output_dir, payload)
            return jsonify({
                "ok": True,
                "request": data,
                "request_path": str(path),
                "latest_path": str(latest_path),
                "request_relative_path": _output_relative_path(output_dir, path),
                "latest_relative_path": _output_relative_path(output_dir, latest_path),
                "output_dir": str(output_dir),
                "message": "대본 요청이 로컬 요청함에 저장되었습니다.",
            }), 201
        except ValueError as exc:
            return jsonify({"ok": False, "error": str(exc)}), 400
        except Exception as exc:
            return jsonify({"ok": False, "error": str(exc)}), 500

    @app.get("/api/script-requests/latest")
    def latest_script_request():
        latest_path = _script_request_dir(output_dir) / "latest.json"
        if not latest_path.exists():
            return jsonify({"ok": False, "error": "no script request found"}), 404
        try:
            return jsonify({"ok": True, "request": json.loads(latest_path.read_text(encoding="utf-8"))})
        except ValueError as exc:
            return jsonify({"ok": False, "error": str(exc)}), 500

    @app.post("/api/refine-subtitles")
    def refine_subtitles():
        payload = request.get_json(silent=True) or {}
        started = time.perf_counter()
        try:
            audio_path = _resolve_whisper_audio_path(
                output_dir,
                payload.get("audio_path") or payload.get("wav_path") or payload.get("path"),
            )
            result = _run_whisper_refiner(root, output_dir, audio_path, payload)
            result.update(_whisper_download_urls(output_dir, result))
            log_usage(
                action="refine_subtitles",
                status="ok",
                elapsed_ms=int((time.perf_counter() - started) * 1000),
                http_status=200,
            )
            return jsonify(result)
        except FileNotFoundError as exc:
            log_usage(
                action="refine_subtitles",
                status="error",
                elapsed_ms=int((time.perf_counter() - started) * 1000),
                http_status=404,
                error_kind=_usage_error_kind(exc),
            )
            return jsonify({"ok": False, "error": str(exc)}), 404
        except (TypeError, ValueError) as exc:
            log_usage(
                action="refine_subtitles",
                status="error",
                elapsed_ms=int((time.perf_counter() - started) * 1000),
                http_status=400,
                error_kind=_usage_error_kind(exc),
            )
            return jsonify({"ok": False, "error": str(exc)}), 400
        except RuntimeError as exc:
            log_usage(
                action="refine_subtitles",
                status="error",
                elapsed_ms=int((time.perf_counter() - started) * 1000),
                http_status=503,
                error_kind=_usage_error_kind(exc),
            )
            return jsonify({"ok": False, "error": str(exc)}), 503
        except Exception as exc:
            log_usage(
                action="refine_subtitles",
                status="error",
                elapsed_ms=int((time.perf_counter() - started) * 1000),
                http_status=500,
                error_kind=_usage_error_kind(exc),
            )
            return jsonify({"ok": False, "error": str(exc)}), 500

    @app.post("/api/convert-mp3")
    def convert_mp3():
        payload = request.get_json(silent=True) or {}
        started = time.perf_counter()
        try:
            audio_path = _resolve_whisper_audio_path(
                output_dir,
                payload.get("audio_path") or payload.get("wav_path") or payload.get("path"),
            )
            result = _convert_wav_to_mp3(output_dir, audio_path, force=_bool(payload.get("force", False)))
            log_usage(
                action="convert_mp3",
                status="ok",
                audio_format="mp3",
                elapsed_ms=int((time.perf_counter() - started) * 1000),
                http_status=200,
            )
            return jsonify(result)
        except FileNotFoundError as exc:
            log_usage(
                action="convert_mp3",
                status="error",
                elapsed_ms=int((time.perf_counter() - started) * 1000),
                http_status=404,
                error_kind=_usage_error_kind(exc),
            )
            return jsonify({"ok": False, "error": str(exc)}), 404
        except (TypeError, ValueError) as exc:
            log_usage(
                action="convert_mp3",
                status="error",
                elapsed_ms=int((time.perf_counter() - started) * 1000),
                http_status=400,
                error_kind=_usage_error_kind(exc),
            )
            return jsonify({"ok": False, "error": str(exc)}), 400
        except RuntimeError as exc:
            log_usage(
                action="convert_mp3",
                status="error",
                elapsed_ms=int((time.perf_counter() - started) * 1000),
                http_status=503,
                error_kind=_usage_error_kind(exc),
            )
            return jsonify({"ok": False, "error": str(exc)}), 503
        except Exception as exc:
            log_usage(
                action="convert_mp3",
                status="error",
                elapsed_ms=int((time.perf_counter() - started) * 1000),
                http_status=500,
                error_kind=_usage_error_kind(exc),
            )
            return jsonify({"ok": False, "error": str(exc)}), 500

    @app.get("/audio/<path:name>")
    def audio(name: str):
        filename = Path(name).name
        if not filename or Path(filename).suffix.lower() not in ALLOWED_AUDIO_EXTENSIONS:
            return jsonify({"ok": False, "error": "not found"}), 404
        return send_from_directory(output_dir, filename, as_attachment=False)

    return app


def _parse_tts_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "model": _optional_str(payload.get("model")) or "supertonic-3",
        "model_dir": _optional_str(payload.get("model_dir")),
        "auto_download": _bool(payload.get("auto_download", True)),
        "intra_op_num_threads": _optional_int(payload.get("intra_op_num_threads")),
        "inter_op_num_threads": _optional_int(payload.get("inter_op_num_threads")),
        "voice": _optional_str(payload.get("voice")) or "M1",
        "voice_style_path": _optional_str(payload.get("voice_style_path") or payload.get("custom_style_path")),
        "lang": _parse_lang(payload),
        "speed": float(payload.get("speed", 1.05)),
        "total_step": int(payload.get("total_step", payload.get("steps", 8))),
        "max_chunk_length": _optional_int(payload.get("max_chunk_length")),
        "silence_duration": float(payload.get("silence_duration", 0.3)),
        "verbose": _bool(payload.get("verbose", True)),
    }


def _parse_lang(payload: dict[str, Any]) -> str | None:
    if "lang" not in payload:
        return "ko"
    lang = _optional_str(payload.get("lang"))
    if lang in (None, "auto"):
        return None
    return lang


def _optional_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _optional_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    return int(value)


def _optional_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    return float(value)


def _usage_error_kind(exc: BaseException) -> str:
    if isinstance(exc, ValueError):
        return "validation"
    if isinstance(exc, FileNotFoundError):
        return "not_found"
    if isinstance(exc, RuntimeError):
        return "runtime"
    return "internal"


def _parse_expression_tag_mode(payload: dict[str, Any]) -> str:
    raw = payload.get("expression_tag_mode", payload.get("expression_tags_mode"))
    if raw is None and "use_expression_tags" in payload:
        return "use" if _bool(payload.get("use_expression_tags")) else "none"
    value = (_optional_str(raw) or "none").lower()
    if value in {"use", "yes", "true", "on", "1", "있음", "사용", "tags"}:
        return "use"
    return "none"


def _expression_tag_guidance(use_expression_tags: bool) -> dict[str, Any]:
    if not use_expression_tags:
        return {
            "purpose": "표현 태그를 사용하지 않고 일반 문장만 작성한다.",
            "rules": [
                "<laugh>, <breath>, <sigh> 같은 꺾쇠괄호 표현 태그를 대본에 넣지 않는다.",
                "호흡, 감정, 멈춤은 문장 길이, 문장부호, 자연어 표현으로만 조절한다.",
                "사용자가 추가 요청에 별도로 태그 사용을 적어도 expression_tag_mode가 none이면 태그 금지를 우선한다.",
            ],
            "examples": [
                "사용 가능: 오늘도 수고 많았습니다. 잠시 숨을 고르고 천천히 이어갑니다.",
                "사용 금지: 오늘도 수고 많았습니다. <breath>",
            ],
        }
    return {
        "purpose": "Supertonic 3가 감정과 호흡을 표현하도록 대본 안에 필요한 위치에만 삽입한다.",
        "rules": [
            "태그는 원문 흐름을 깨지 않게 문장 사이 또는 감정이 바뀌는 지점에만 사용한다.",
            "짧은 대본은 1~3개, 긴 대본은 장면 전환마다 소량만 사용해 과하게 반복하지 않는다.",
            "일반 설명문은 <breath>, <sigh> 위주로 쓰고, 대화/연기 대본은 감정에 맞춰 <laugh>, <surprise>, <sad>, <angry> 등을 섞는다.",
            "기침, 하품, 목 가다듬기는 의도가 있을 때만 <cough>, <yawn>, <throatclear>를 사용한다.",
            "비명이나 강한 반응은 필요한 장면에서만 <scream>을 사용한다.",
        ],
        "examples": [
            "문장 사이 자연스러운 호흡: 오늘도 수고 많았습니다. <breath>",
            "아쉬움이나 회상: 잠시 말이 멈췄습니다. <sigh>",
            "밝은 반응: 정말 잘했어요. <laugh>",
        ],
    }


def _bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() not in {"0", "false", "no", "off"}
    return bool(value)


def _tts_response_payload(path: Path, sidecars: dict[str, Path], params: dict[str, Any], info: dict[str, Any]) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "ok": True,
        "audio_url": f"/audio/{path.name}",
        "path": str(path),
        "duration": info.get("duration"),
        "sample_rate": info.get("sample_rate"),
        "model": info.get("model", params.get("model")),
        "voice": info.get("voice", params.get("voice")),
        "voice_style_path": info.get("voice_style_path", params.get("voice_style_path")),
        "lang": info.get("lang", params.get("lang")),
        "speed": info.get("speed", params.get("speed")),
        "total_step": info.get("total_step", params.get("total_step")),
        "max_chunk_length": info.get("max_chunk_length", params.get("max_chunk_length")),
        "silence_duration": info.get("silence_duration", params.get("silence_duration")),
        "privacy": privacy_snapshot(),
    }
    if sidecars:
        payload["script_url"] = f"/audio/{sidecars['script'].name}"
        payload["input_log_url"] = f"/audio/{sidecars['input_log'].name}"
        payload["srt_url"] = f"/audio/{sidecars['srt'].name}"
        payload["vtt_url"] = f"/audio/{sidecars['vtt'].name}"
        payload["script_path"] = str(sidecars["script"])
        payload["input_log_path"] = str(sidecars["input_log"])
        payload["srt_path"] = str(sidecars["srt"])
        payload["vtt_path"] = str(sidecars["vtt"])
    if ephemeral_audio_enabled():
        payload["expires_in_sec"] = ephemeral_audio_ttl_sec()
    return payload


def _latest_output_payload(output_dir: Path) -> dict[str, Any] | None:
    if not output_dir.exists():
        return None
    candidates = [path for path in output_dir.glob("*.wav") if path.is_file()]
    if not candidates:
        return None
    latest = max(candidates, key=lambda path: path.stat().st_mtime)
    payload = _artifact_payload(output_dir, latest)
    return _enrich_audio_delivery(output_dir, latest, payload)


def _artifact_payload(output_dir: Path, audio_path: Path) -> dict[str, Any]:
    output_root = output_dir.resolve()
    audio = audio_path.resolve()
    if os.path.commonpath([str(output_root), str(audio)]) != str(output_root):
        raise ValueError("audio_path must be inside the output directory")

    stem = audio.stem
    payload: dict[str, Any] = {
        "ok": True,
        "artifact_source": "latest-output",
        "audio_url": f"/audio/{audio.name}",
        "path": str(audio),
        "updated_at": datetime.fromtimestamp(audio.stat().st_mtime).isoformat(timespec="seconds"),
    }
    sidecars = {
        "script": audio.with_name(f"{stem}_script.txt"),
        "input_log": audio.with_name(f"{stem}_input_log.txt"),
        "srt": audio.with_suffix(".srt"),
        "vtt": audio.with_suffix(".vtt"),
        "whisper_srt": audio.with_name(f"{stem}_whisper.srt"),
        "whisper_vtt": audio.with_name(f"{stem}_whisper.vtt"),
        "whisper_txt": audio.with_name(f"{stem}_whisper.txt"),
        "whisper_json": audio.with_name(f"{stem}_whisper.json"),
        "whisper_log": audio.with_name(f"{stem}_whisper_log.txt"),
        "mp3": audio.with_suffix(".mp3"),
        "mp3_convert_log": audio.with_name(f"{stem}_mp3_convert_log.txt"),
    }
    for key, path in sidecars.items():
        if not path.exists():
            continue
        payload[f"{key}_path"] = str(path)
        payload[f"{key}_url"] = f"/audio/{path.name}"
    if audio.suffix.lower() == ".wav":
        return _enrich_audio_delivery(output_dir, audio, payload)
    return payload


def _script_request_dir(output_dir: Path) -> Path:
    return output_dir / "script_requests"


def _script_custom_dir(output_dir: Path) -> Path:
    return output_dir / "script_customs"


def _list_script_customs(output_dir: Path) -> list[dict[str, Any]]:
    custom_dir = _script_custom_dir(output_dir)
    custom_dir.mkdir(parents=True, exist_ok=True)
    scripts: list[dict[str, Any]] = []
    for path in sorted(custom_dir.glob("*.txt"), key=lambda item: item.name.lower()):
        if not path.is_file():
            continue
        scripts.append({
            "name": path.name,
            "title": path.stem,
            "size": path.stat().st_size,
            "updated_at": datetime.fromtimestamp(path.stat().st_mtime).isoformat(timespec="seconds"),
            "relative_path": _output_relative_path(output_dir, path),
        })
    return scripts


def _resolve_script_custom_path(output_dir: Path, name: Any) -> Path:
    text = _optional_str(name)
    if not text:
        raise ValueError("script name is required")
    candidate = _script_custom_dir(output_dir) / Path(text).name
    resolved = candidate.resolve()
    custom_root = _script_custom_dir(output_dir).resolve()
    if os.path.commonpath([str(custom_root), str(resolved)]) != str(custom_root):
        raise ValueError("script path must be inside script_customs")
    if resolved.suffix.lower() != ".txt":
        raise ValueError("only .txt scripts are supported")
    if not resolved.exists():
        raise FileNotFoundError(f"Script file not found: {resolved.name}")
    return resolved


def _read_text_with_fallback(path: Path) -> str:
    for encoding in ("utf-8-sig", "utf-8", "cp949"):
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
    return path.read_text(encoding="utf-8", errors="replace")


def _write_script_request(output_dir: Path, payload: dict[str, Any]) -> tuple[dict[str, Any], Path, Path]:
    topic = _optional_str(payload.get("topic"))
    if not topic:
        raise ValueError("topic is required")

    now = datetime.now()
    request_id = f"script_request_{now.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
    request_dir = _script_request_dir(output_dir)
    request_dir.mkdir(parents=True, exist_ok=True)
    expression_tag_mode = _parse_expression_tag_mode(payload)
    use_expression_tags = expression_tag_mode == "use"
    expression_tag_guidance = _expression_tag_guidance(use_expression_tags)
    ai_workflow = [
        "이 JSON을 읽고 Supertonic TTS용 한국어 대본을 작성한다.",
        "대본 텍스트 파일을 recommended_output.text_file 경로에 저장한다.",
        "public/scripts.json에 recommended_output.catalog_id로 새 항목을 추가한다.",
        "웹 UI에서 대본 새로고침(Reload)을 누르면 선택 가능해야 한다.",
    ]
    if use_expression_tags:
        ai_workflow.insert(1, "expression_tags와 expression_tag_guidance를 참고해 표현 태그를 대본에 자연스럽게 삽입한다.")
        prompt_for_ai = (
            "최신 대본 요청함 JSON을 읽고, 조건에 맞는 Supertonic TTS용 대본 TXT를 만든 뒤 "
            "public/scripts.json에 등록해줘. TTS가 자연스럽게 읽도록 문장을 너무 길게 만들지 말고, "
            "expression_tags에 있는 <laugh>, <breath>, <surprise>, <sigh>, <scream>, "
            "<throatclear>, <sad>, <angry>, <cough>, <yawn> 태그를 장면과 감정에 맞게 적절히 삽입해줘. "
            "단, 태그를 과하게 반복하지 말고 expression_tag_guidance의 규칙을 따른다."
        )
    else:
        ai_workflow.insert(1, "expression_tag_mode가 none이므로 <> 표현 태그를 대본에 넣지 않는다.")
        prompt_for_ai = (
            "최신 대본 요청함 JSON을 읽고, 조건에 맞는 Supertonic TTS용 대본 TXT를 만든 뒤 "
            "public/scripts.json에 등록해줘. TTS가 자연스럽게 읽도록 문장을 너무 길게 만들지 말고, "
            "expression_tag_mode가 none이므로 <laugh>, <breath>, <sigh> 같은 <> 표현 태그는 넣지 않는다. "
            "호흡과 감정은 문장 길이, 문장부호, 자연스러운 표현으로만 조절한다."
        )
    data = {
        "id": request_id,
        "type": "script_request",
        "status": "pending",
        "created_at": now.isoformat(timespec="seconds"),
        "topic": topic,
        "tone": _optional_str(payload.get("tone")) or "차분함",
        "length": _optional_str(payload.get("length")) or "3분",
        "audience": _optional_str(payload.get("audience")) or "일반 청취자",
        "language": _optional_str(payload.get("language")) or "ko",
        "notes": _optional_str(payload.get("notes")) or "",
        "target_catalog": "public/scripts.json",
        "recommended_output": {
            "text_file": f"public/{request_id}.txt",
            "catalog_id": request_id.replace("_", "-"),
        },
        "expression_tag_mode": expression_tag_mode,
        "use_expression_tags": use_expression_tags,
        "expression_tags": list(EXPRESSION_TAGS) if use_expression_tags else [],
        "expression_tag_guidance": expression_tag_guidance,
        "ai_workflow": ai_workflow,
        "prompt_for_ai": prompt_for_ai,
    }
    path = request_dir / f"{request_id}.json"
    latest_path = request_dir / "latest.json"
    text = json.dumps(data, ensure_ascii=False, indent=2)
    path.write_text(text + "\n", encoding="utf-8")
    latest_path.write_text(text + "\n", encoding="utf-8")
    return data, path, latest_path


def _output_relative_path(output_dir: Path, path: Path) -> str:
    try:
        return path.resolve().relative_to(output_dir.resolve()).as_posix()
    except ValueError:
        return str(path)


def _update_job(jobs: dict[str, dict[str, Any]], jobs_lock: threading.Lock, job_id: str, **updates: Any) -> None:
    with jobs_lock:
        job = jobs.get(job_id)
        if not job:
            return
        job.update(updates)
        job["updated_at"] = datetime.now().isoformat(timespec="seconds")


def _resolve_output_path(output_dir: Path, value: Any) -> Path:
    text = _optional_str(value)
    if not text:
        raise ValueError("audio_path is required")
    path = Path(text)
    if not path.is_absolute():
        path = output_dir / path.name
    resolved = path.resolve()
    output_root = output_dir.resolve()
    if os.path.commonpath([str(output_root), str(resolved)]) != str(output_root):
        raise ValueError("audio_path must be inside the output directory")
    if not resolved.exists():
        raise FileNotFoundError(f"Audio file not found: {resolved}")
    return resolved


MP3_LICENSE_NOTICE = (
    "서버 내부 FFmpeg로 MP3 변환\n"
    "FFmpeg 바이너리는 사용자에게 제공하지 않음\n"
    "배포 없는 SaaS 운영\n"
    "자세한 고지: /license"
)


def _ffmpeg_runtime_info() -> dict[str, str | None]:
    try:
        ffmpeg = _ffmpeg_path()
    except RuntimeError:
        return {
            "available": False,
            "path": None,
            "version_line": None,
            "configuration": None,
        }

    try:
        completed = subprocess.run(
            [ffmpeg, "-version"],
            capture_output=True,
            text=True,
            timeout=8,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return {
            "available": True,
            "path": ffmpeg,
            "version_line": None,
            "configuration": None,
        }

    output = completed.stdout or completed.stderr or ""
    lines = output.splitlines()
    version_line = lines[0] if lines else None
    configuration: str | None = None
    for line in lines:
        if line.startswith("configuration:"):
            configuration = line.removeprefix("configuration:").strip()
            break

    return {
        "available": True,
        "path": ffmpeg,
        "version_line": version_line,
        "configuration": configuration,
    }


def _auto_mp3_enabled() -> bool:
    raw = os.environ.get("SUPERTONIC3_AUTO_MP3", "1")
    return _bool(raw)


def _enrich_audio_delivery(output_dir: Path, wav_path: Path, payload: dict[str, Any]) -> dict[str, Any]:
    wav_path = wav_path.resolve()
    payload["wav_path"] = str(wav_path)
    payload["wav_url"] = f"/audio/{wav_path.name}"
    if wav_path.suffix.lower() != ".wav":
        payload["audio_format"] = wav_path.suffix.lstrip(".").lower() or "audio"
        return payload
    if not _auto_mp3_enabled():
        payload["audio_format"] = "wav"
        return payload
    try:
        mp3_info = _convert_wav_to_mp3(output_dir, wav_path, force=False)
    except RuntimeError as exc:
        payload["audio_format"] = "wav"
        payload["mp3_error"] = str(exc)
        return payload
    payload["audio_format"] = "mp3"
    payload["audio_url"] = mp3_info["mp3_url"]
    payload["path"] = mp3_info["mp3_path"]
    payload["mp3_url"] = mp3_info["mp3_url"]
    payload["mp3_path"] = mp3_info["mp3_path"]
    if mp3_info.get("mp3_convert_log_url"):
        payload["mp3_convert_log_url"] = mp3_info["mp3_convert_log_url"]
    if mp3_info.get("mp3_convert_log_path"):
        payload["mp3_convert_log_path"] = mp3_info["mp3_convert_log_path"]
    payload["mp3_converted"] = mp3_info.get("converted", False)
    return payload


def _resolve_whisper_audio_path(output_dir: Path, raw: Any) -> Path:
    resolved = _resolve_output_path(output_dir, raw)
    if resolved.suffix.lower() == ".mp3":
        wav = resolved.with_suffix(".wav")
        if wav.exists():
            return wav
        raise FileNotFoundError(f"WAV source not found for MP3: {resolved.name}")
    return resolved


def _ffmpeg_path() -> str:
    configured = _optional_str(os.environ.get("SUPERTONIC3_FFMPEG"))
    if configured:
        path = Path(configured)
        if path.exists():
            return str(path)
    found = shutil.which("ffmpeg")
    if found:
        return found
    raise RuntimeError("ffmpeg가 없습니다. MP3 변환은 선택 설치 파일 ffmpeg가 필요합니다.")


def _convert_wav_to_mp3(output_dir: Path, audio_path: Path, *, force: bool = False) -> dict[str, Any]:
    if audio_path.suffix.lower() != ".wav":
        raise ValueError("MP3 변환은 WAV 파일만 지원합니다.")

    output_root = output_dir.resolve()
    audio = audio_path.resolve()
    if os.path.commonpath([str(output_root), str(audio)]) != str(output_root):
        raise ValueError("audio_path must be inside the output directory")

    mp3_path = audio.with_suffix(".mp3")
    log_path = audio.with_name(f"{audio.stem}_mp3_convert_log.txt")
    converted = False
    stdout = ""
    stderr = ""

    if force or not mp3_path.exists() or mp3_path.stat().st_mtime < audio.stat().st_mtime:
        ffmpeg = _ffmpeg_path()
        command = [
            ffmpeg,
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(audio),
            "-vn",
            "-codec:a",
            "libmp3lame",
            "-q:a",
            "2",
            str(mp3_path),
        ]
        completed = subprocess.run(
            command,
            cwd=output_dir,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
        stdout = completed.stdout.strip()
        stderr = completed.stderr.strip()
        if completed.returncode != 0:
            detail = stderr or stdout or f"ffmpeg exited with code {completed.returncode}"
            raise RuntimeError(detail)
        converted = True

        if not no_text_persist_enabled():
            log_path.write_text(
                "\n".join([
                    f"created_at: {datetime.now().isoformat(timespec='seconds')}",
                    f"source_wav: {audio}",
                    f"mp3_path: {mp3_path}",
                    "",
                    "[license_notice]",
                    MP3_LICENSE_NOTICE,
                    "",
                    "[command]",
                    " ".join(command),
                    "",
                    "[stdout]",
                    stdout,
                    "",
                    "[stderr]",
                    stderr,
                    "",
                ]),
                encoding="utf-8",
            )

    include_log = not no_text_persist_enabled() and log_path.exists()
    return {
        "ok": True,
        "converted": converted,
        "audio": str(audio),
        "audio_url": f"/audio/{audio.name}",
        "mp3_path": str(mp3_path),
        "mp3_url": f"/audio/{mp3_path.name}",
        "mp3_convert_log_path": str(log_path) if include_log else None,
        "mp3_convert_log_url": f"/audio/{log_path.name}" if include_log else None,
        "notice": MP3_LICENSE_NOTICE,
        "stdout": stdout,
        "stderr": stderr,
    }


def _run_whisper_refiner(root: Path, output_dir: Path, audio_path: Path, payload: dict[str, Any]) -> dict[str, Any]:
    refiner_dir = Path(os.environ.get("SUPERTONIC3_WHISPER_DIR") or root.parent / "supertonic3-whisper-subtitles").resolve()
    script_path = refiner_dir / "whisper_subtitle_refiner.py"
    if not script_path.exists():
        raise RuntimeError(f"Whisper refiner not found: {script_path}")

    python_path = _whisper_python(refiner_dir)
    command = [
        str(python_path),
        str(script_path),
        "--audio",
        str(audio_path),
        "--model",
        _optional_str(payload.get("whisper_model") or payload.get("model")) or "medium",
        "--device",
        _optional_str(payload.get("whisper_device") or payload.get("device")) or "cpu",
        "--compute-type",
        _optional_str(payload.get("compute_type")) or "int8",
        "--language",
        _optional_str(payload.get("language") or payload.get("lang")) or "ko",
        "--beam-size",
        str(_optional_int(payload.get("beam_size")) or 5),
        "--cpu-threads",
        str(_optional_int(payload.get("cpu_threads")) or min(os.cpu_count() or 4, 8)),
        "--text-source",
        _optional_str(payload.get("text_source")) or "auto",
    ]
    if _optional_str(payload.get("initial_prompt")):
        command.extend(["--initial-prompt", _optional_str(payload.get("initial_prompt")) or ""])

    env = os.environ.copy()
    env.setdefault("PYTHONIOENCODING", "utf-8")
    env.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
    timeout = float(payload.get("timeout") or os.environ.get("SUPERTONIC3_WHISPER_TIMEOUT") or 3600)
    completed = subprocess.run(
        command,
        cwd=refiner_dir,
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
        check=False,
    )
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "").strip()
        raise RuntimeError(detail or f"Whisper refiner exited with code {completed.returncode}")

    data = _parse_refiner_stdout(completed.stdout)
    data.update(_whisper_download_urls(output_dir, data))
    data["stdout"] = completed.stdout.strip()
    data["stderr"] = completed.stderr.strip()
    return data


def _whisper_python(refiner_dir: Path) -> Path:
    configured = _optional_str(os.environ.get("SUPERTONIC3_WHISPER_PYTHON"))
    if configured:
        path = Path(configured).resolve()
        if path.exists():
            return path
    candidates = [
        refiner_dir / ".venv-win" / "Scripts" / "python.exe",
        refiner_dir / ".venv" / "Scripts" / "python.exe",
        refiner_dir / ".venv" / "bin" / "python",
    ]
    for path in candidates:
        if path.exists():
            return path.resolve()
    return Path(sys.executable).resolve()


def _parse_refiner_stdout(stdout: str) -> dict[str, Any]:
    for line in reversed(stdout.splitlines()):
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            data = json_loads(line)
        except ValueError:
            continue
        if isinstance(data, dict):
            return data
    raise RuntimeError("Whisper refiner did not return JSON output")


def json_loads(text: str) -> Any:
    import json

    return json.loads(text)


def _whisper_download_urls(output_dir: Path, data: dict[str, Any]) -> dict[str, str]:
    mapping = {
        "whisper_srt_url": "srt",
        "whisper_vtt_url": "vtt",
        "whisper_txt_url": "txt",
        "whisper_json_url": "json",
        "whisper_log_url": "log",
    }
    urls: dict[str, str] = {}
    output_root = output_dir.resolve()
    for url_key, data_key in mapping.items():
        value = data.get(data_key)
        if not value:
            continue
        path = Path(str(value)).resolve()
        if os.path.commonpath([str(output_root), str(path)]) == str(output_root):
            urls[url_key] = f"/audio/{path.name}"
    return urls


def _write_sidecar_files(audio_path: Path, text: str, params: dict[str, Any], info: dict[str, Any]) -> dict[str, Path]:
    stem = audio_path.stem
    script_path = audio_path.with_name(f"{stem}_script.txt")
    input_log_path = audio_path.with_name(f"{stem}_input_log.txt")
    srt_path = audio_path.with_suffix(".srt")
    vtt_path = audio_path.with_suffix(".vtt")

    if no_text_persist_enabled():
        return {}

    transcript = text.strip()
    script_path.write_text(transcript + "\n", encoding="utf-8")
    input_log_path.write_text(_format_input_log(transcript, params, info), encoding="utf-8")

    duration = _duration_or_estimate(info.get("duration"), transcript)
    cues = _build_subtitle_cues(transcript, duration)
    srt_path.write_text(_format_srt(cues), encoding="utf-8")
    vtt_path.write_text(_format_vtt(cues), encoding="utf-8")
    return {
        "script": script_path,
        "input_log": input_log_path,
        "srt": srt_path,
        "vtt": vtt_path,
    }


def _format_input_log(text: str, params: dict[str, Any], info: dict[str, Any]) -> str:
    lines = [
        f"created_at: {datetime.now().isoformat(timespec='seconds')}",
        f"audio_path: {info.get('path', '')}",
        f"duration: {info.get('duration', '')}",
        f"sample_rate: {info.get('sample_rate', '')}",
        "",
        "[options]",
    ]
    for key in sorted(params):
        lines.append(f"{key}: {params[key]}")
    lines.extend(["", "[text]", text, ""])
    return "\n".join(lines)


def _duration_or_estimate(duration: Any, text: str) -> float:
    try:
        value = float(duration)
        if value > 0:
            return value
    except (TypeError, ValueError):
        pass
    return max(1.0, len(text) / 12)


def _build_subtitle_cues(text: str, total_duration: float) -> list[tuple[int, float, float, str]]:
    chunks = _subtitle_chunks(text)
    if not chunks:
        chunks = [text.strip() or ""]
    weights = [max(len(chunk), 1) for chunk in chunks]
    total_weight = sum(weights)
    cursor = 0.0
    cues = []
    for index, (chunk, weight) in enumerate(zip(chunks, weights), start=1):
        end = total_duration if index == len(chunks) else cursor + (total_duration * weight / total_weight)
        cues.append((index, cursor, max(cursor + 0.05, end), chunk))
        cursor = end
    return cues


def _subtitle_chunks(text: str, max_chars: int = 52) -> list[str]:
    parts = [part.strip() for part in re.split(r"(?<=[.!?])\s+|\n+", text.strip()) if part.strip()]
    chunks: list[str] = []
    for part in parts:
        if len(part) <= max_chars:
            chunks.append(part)
            continue
        words = part.split()
        if len(words) == 1:
            chunks.extend(part[i : i + max_chars] for i in range(0, len(part), max_chars))
            continue
        line = ""
        for word in words:
            candidate = f"{line} {word}".strip()
            if len(candidate) <= max_chars:
                line = candidate
            else:
                if line:
                    chunks.append(line)
                line = word
        if line:
            chunks.append(line)
    return chunks


def _format_srt(cues: list[tuple[int, float, float, str]]) -> str:
    blocks = []
    for index, start, end, text in cues:
        blocks.append(f"{index}\n{_srt_time(start)} --> {_srt_time(end)}\n{text}")
    return "\n\n".join(blocks) + "\n"


def _format_vtt(cues: list[tuple[int, float, float, str]]) -> str:
    blocks = ["WEBVTT", ""]
    for _, start, end, text in cues:
        blocks.append(f"{_vtt_time(start)} --> {_vtt_time(end)}\n{text}\n")
    return "\n".join(blocks)


def _srt_time(seconds: float) -> str:
    return _timecode(seconds, ",")


def _vtt_time(seconds: float) -> str:
    return _timecode(seconds, ".")


def _timecode(seconds: float, millis_separator: str) -> str:
    milliseconds = max(0, round(seconds * 1000))
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    secs, millis = divmod(remainder, 1000)
    return f"{hours:02}:{minutes:02}:{secs:02}{millis_separator}{millis:03}"


app = create_app()


if __name__ == "__main__":
    port = int(os.environ.get("SUPERTONIC3_PORT", "3093"))
    host = os.environ.get("SUPERTONIC3_HOST", "127.0.0.1")
    try:
        app.run(host=host, port=port)
    except OSError as exc:
        winerror = getattr(exc, "winerror", None)
        if winerror == 10013 or getattr(exc, "errno", None) in {13, 10013}:
            print(
                f"[ERROR] Cannot open http://{host}:{port}. "
                "Windows denied access to that local port. "
                "Use another SUPERTONIC3_PORT value or run 실행.bat so it can choose a fallback port.",
                file=sys.stderr,
            )
            raise SystemExit(1) from exc
        raise
