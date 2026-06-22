from __future__ import annotations

import os
import sys
import unicodedata
from pathlib import Path
from typing import Any


def _configure_utf8_stdio() -> None:
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if not hasattr(stream, "reconfigure"):
            continue
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass


_configure_utf8_stdio()


def default_output_dir() -> Path:
    return Path(os.environ.get("SUPERTONIC3_OUTPUT_DIR", Path(__file__).resolve().parents[1] / "data")).resolve()


AVAILABLE_MODELS = ["supertonic", "supertonic-2", "supertonic-3"]
DEFAULT_MODEL = "supertonic-3"
DEFAULT_VOICES = ["M1", "M2", "M3", "M4", "M5", "F1", "F2", "F3", "F4", "F5"]
EXPRESSION_TAGS = [
    "<laugh>",
    "<breath>",
    "<surprise>",
    "<sigh>",
    "<scream>",
    "<throatclear>",
    "<sad>",
    "<angry>",
    "<cough>",
    "<yawn>",
]
LANGUAGES = [
    ("en", "English"),
    ("ko", "Korean"),
    ("ja", "Japanese"),
    ("ar", "Arabic"),
    ("bg", "Bulgarian"),
    ("cs", "Czech"),
    ("da", "Danish"),
    ("de", "German"),
    ("el", "Greek"),
    ("es", "Spanish"),
    ("et", "Estonian"),
    ("fi", "Finnish"),
    ("fr", "French"),
    ("hi", "Hindi"),
    ("hr", "Croatian"),
    ("hu", "Hungarian"),
    ("id", "Indonesian"),
    ("it", "Italian"),
    ("lt", "Lithuanian"),
    ("lv", "Latvian"),
    ("nl", "Dutch"),
    ("pl", "Polish"),
    ("pt", "Portuguese"),
    ("ro", "Romanian"),
    ("ru", "Russian"),
    ("sk", "Slovak"),
    ("sl", "Slovenian"),
    ("sv", "Swedish"),
    ("tr", "Turkish"),
    ("uk", "Ukrainian"),
    ("vi", "Vietnamese"),
    ("na", "Unknown fallback"),
]

DEFAULT_OPTIONS: dict[str, Any] = {
    "model": DEFAULT_MODEL,
    "voice": "M1",
    "lang": "ko",
    "speed": 1.05,
    "total_step": 8,
    "max_chunk_length": None,
    "silence_duration": 0.3,
    "auto_download": True,
    "verbose": True,
    "whisper_refine": False,
}

LIMITS: dict[str, Any] = {
    "speed": {"min": 0.7, "max": 2.0, "step": 0.05},
    "total_step": {"min": 1, "max": 100, "step": 1},
    "max_chunk_length": {"min": 10, "max": 100000, "step": 10},
    "silence_duration": {"min": 0.0, "max": 30.0, "step": 0.05},
}


def option_metadata() -> dict[str, Any]:
    return {
        "models": list(AVAILABLE_MODELS),
        "voices": list(DEFAULT_VOICES),
        "languages": [{"code": code, "name": name} for code, name in LANGUAGES],
        "expression_tags": list(EXPRESSION_TAGS),
        "defaults": dict(DEFAULT_OPTIONS),
        "limits": dict(LIMITS),
    }


def sanitize_tts_text(text: str) -> str:
    cleaned: list[str] = []
    for char in text or "":
        if char in "\n\r\t":
            cleaned.append(char)
            continue
        category = unicodedata.category(char)
        if category.startswith("C"):
            continue
        if ord(char) > 0xFFFF:
            continue
        cleaned.append(char)
    return "".join(cleaned).strip()


class Supertonic3Engine:
    """Lazy Supertonic local TTS engine based on the official PyPI SDK."""

    DEFAULT_VOICES = DEFAULT_VOICES

    def __init__(
        self,
        output_dir: str | Path | None = None,
        auto_download: bool = True,
        model: str = DEFAULT_MODEL,
        model_dir: str | Path | None = None,
        intra_op_num_threads: int | None = None,
        inter_op_num_threads: int | None = None,
    ):
        self.output_dir = Path(output_dir) if output_dir else default_output_dir()
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.auto_download = auto_download
        self.model = model
        self.model_dir = Path(model_dir).expanduser() if model_dir else None
        self.intra_op_num_threads = intra_op_num_threads
        self.inter_op_num_threads = inter_op_num_threads
        self._tts_cache: dict[tuple[Any, ...], Any] = {}

    def _load(
        self,
        *,
        model: str | None = None,
        model_dir: str | Path | None = None,
        auto_download: bool | None = None,
        intra_op_num_threads: int | None = None,
        inter_op_num_threads: int | None = None,
    ):
        resolved_model = model or self.model
        resolved_model_dir = Path(model_dir).expanduser() if model_dir else self.model_dir
        resolved_auto_download = self.auto_download if auto_download is None else bool(auto_download)
        resolved_intra = self.intra_op_num_threads if intra_op_num_threads is None else intra_op_num_threads
        resolved_inter = self.inter_op_num_threads if inter_op_num_threads is None else inter_op_num_threads
        cache_key = (
            resolved_model,
            str(resolved_model_dir.resolve()) if resolved_model_dir else None,
            resolved_auto_download,
            resolved_intra,
            resolved_inter,
        )
        if cache_key not in self._tts_cache:
            try:
                from supertonic import TTS
            except ModuleNotFoundError as exc:
                raise RuntimeError(
                    "supertonic 패키지가 없습니다. requirements.txt 설치 후 다시 시도하세요. "
                    f"(Docker: docker compose build supertonic3)"
                ) from exc
            except Exception as exc:  # pragma: no cover - integration path
                raise RuntimeError(
                    "supertonic 로드 실패. onnxruntime·huggingface-hub 설치와 Docker 재빌드를 확인하세요. "
                    f"원인: {type(exc).__name__}: {exc}"
                ) from exc
            self._tts_cache[cache_key] = TTS(
                model=resolved_model,
                model_dir=resolved_model_dir,
                auto_download=resolved_auto_download,
                intra_op_num_threads=resolved_intra,
                inter_op_num_threads=resolved_inter,
            )
        return self._tts_cache[cache_key]

    def options(self) -> dict[str, Any]:
        return option_metadata()

    def list_voices(self) -> list[str]:
        # Keep this fast and avoid model loading for the UI unless synthesis is requested.
        return list(self.DEFAULT_VOICES)

    def synthesize_to_file(
        self,
        *,
        text: str,
        output_path: str | Path | None = None,
        model: str | None = None,
        model_dir: str | Path | None = None,
        auto_download: bool | None = None,
        intra_op_num_threads: int | None = None,
        inter_op_num_threads: int | None = None,
        voice: str = "M1",
        voice_style_path: str | Path | None = None,
        lang: str | None = "ko",
        speed: float = 1.05,
        total_step: int = 8,
        max_chunk_length: int | None = None,
        silence_duration: float = 0.3,
        verbose: bool = True,
    ) -> dict[str, Any]:
        text = sanitize_tts_text(text)
        if not text:
            raise ValueError("text is required")

        selected_model = model or self.model
        if selected_model not in AVAILABLE_MODELS:
            raise ValueError(f"Unsupported model '{selected_model}'. Use one of: {', '.join(AVAILABLE_MODELS)}")
        if not (LIMITS["speed"]["min"] <= float(speed) <= LIMITS["speed"]["max"]):
            raise ValueError("speed must be between 0.7 and 2.0")
        if not (LIMITS["total_step"]["min"] <= int(total_step) <= LIMITS["total_step"]["max"]):
            raise ValueError("total_step must be between 1 and 100")
        if max_chunk_length is not None and not (
            LIMITS["max_chunk_length"]["min"] <= int(max_chunk_length) <= LIMITS["max_chunk_length"]["max"]
        ):
            raise ValueError("max_chunk_length must be between 10 and 100000")
        if not (LIMITS["silence_duration"]["min"] <= float(silence_duration) <= LIMITS["silence_duration"]["max"]):
            raise ValueError("silence_duration must be between 0 and 30 seconds")

        out = Path(output_path) if output_path else self.output_dir / "supertonic3.wav"
        out.parent.mkdir(parents=True, exist_ok=True)

        tts = self._load(
            model=selected_model,
            model_dir=model_dir,
            auto_download=auto_download,
            intra_op_num_threads=intra_op_num_threads,
            inter_op_num_threads=inter_op_num_threads,
        )
        if voice_style_path:
            style_path = Path(voice_style_path).expanduser()
            if not style_path.exists():
                raise ValueError(f"voice_style_path does not exist: {style_path}")
            style = tts.get_voice_style_from_path(style_path)
            voice_label = style_path.name
        else:
            available_voices = list(getattr(tts, "voice_style_names", None) or self.DEFAULT_VOICES)
            if voice not in available_voices:
                raise ValueError(f"Unsupported voice '{voice}'. Use one of: {', '.join(available_voices)}")
            style = tts.get_voice_style(voice_name=voice)
            voice_label = voice

        wav, duration = tts.synthesize(
            text,
            voice_style=style,
            total_steps=int(total_step),
            speed=float(speed),
            max_chunk_length=max_chunk_length,
            silence_duration=float(silence_duration),
            lang=lang,
            verbose=bool(verbose),
        )
        tts.save_audio(wav, str(out))
        return {
            "path": str(out),
            "duration": _scalar(duration),
            "sample_rate": getattr(tts, "sample_rate", 24000),
            "model": getattr(tts, "model_name", selected_model),
            "voice": voice_label,
            "voice_style_path": str(voice_style_path) if voice_style_path else None,
            "lang": lang,
            "speed": float(speed),
            "total_step": int(total_step),
            "max_chunk_length": max_chunk_length,
            "silence_duration": float(silence_duration),
        }


def _scalar(value: Any) -> float | None:
    try:
        if hasattr(value, "item"):
            return float(value.item())
        if hasattr(value, "__len__") and len(value):
            first = value[0]
            return float(first.item() if hasattr(first, "item") else first)
        return float(value)
    except Exception:
        return None
