from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_DIR = ROOT / "supertonic3-local-tts" / "data"


@dataclass
class Cue:
    index: int
    start: float
    end: float
    text: str


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Refine Supertonic 3 subtitles with faster-whisper timing.",
    )
    parser.add_argument("--audio", default=None, help="WAV/audio file to transcribe")
    parser.add_argument(
        "--latest-from",
        default=str(DEFAULT_DATA_DIR),
        help="Folder to search for the newest WAV when --audio is omitted",
    )
    parser.add_argument("--output-prefix", default=None, help="Output path prefix without extension")
    parser.add_argument("--reference-text", default=None, help="Optional original script text file")
    parser.add_argument(
        "--text-source",
        choices=["auto", "whisper", "reference"],
        default="auto",
        help="Use Whisper transcript, reference script, or reference when available",
    )
    parser.add_argument("--model", default="medium", help="Whisper model name: small, medium, large-v3, ...")
    parser.add_argument("--device", default="cpu", help="faster-whisper device")
    parser.add_argument("--compute-type", default="int8", help="Recommended CPU value: int8")
    parser.add_argument("--language", default="ko", help="Language code. Use auto for detection")
    parser.add_argument("--beam-size", type=int, default=5)
    parser.add_argument("--cpu-threads", type=int, default=min(os.cpu_count() or 4, 8))
    parser.add_argument("--num-workers", type=int, default=1)
    parser.add_argument("--vad-filter", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument("--vad-threshold", type=float, default=0.5)
    parser.add_argument("--vad-min-silence-ms", type=int, default=500)
    parser.add_argument("--word-timestamps", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument("--initial-prompt", default="다음은 한국어 음성입니다.")
    parser.add_argument("--temperature", type=float, default=0.0)
    parser.add_argument("--compression-ratio-threshold", type=float, default=2.4)
    parser.add_argument("--no-speech-threshold", type=float, default=0.6)
    parser.add_argument("--max-cue-chars", type=int, default=80)
    parser.add_argument("--max-line-chars", type=int, default=42)
    parser.add_argument("--max-cue-duration", type=float, default=6.0)
    parser.add_argument("--min-cue-duration", type=float, default=0.35)
    return parser


def run(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        audio_path = resolve_audio_path(args)
        reference_path = resolve_reference_path(args, audio_path)
        output_prefix = resolve_output_prefix(args, audio_path)
        segments, info = transcribe_audio(args, audio_path)
        cues = build_cues(segments, args.max_cue_chars, args.max_cue_duration)
        cues = merge_short_cues(cues, args.min_cue_duration, args.max_cue_chars)

        text_source = args.text_source
        reference_text = reference_path.read_text(encoding="utf-8").strip() if reference_path else ""
        if text_source == "auto":
            text_source = "reference" if reference_text else "whisper"
        if text_source == "reference" and reference_text:
            cues = apply_reference_text(cues, reference_text)

        write_outputs(output_prefix, audio_path, cues, info, args, reference_path, text_source)
    except MissingDependencyError as exc:
        print(str(exc), file=sys.stderr)
        return 3
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    return 0


class MissingDependencyError(RuntimeError):
    pass


def resolve_audio_path(args: argparse.Namespace) -> Path:
    if args.audio:
        path = Path(args.audio).expanduser().resolve()
    else:
        path = latest_wav(Path(args.latest_from).expanduser().resolve())
    if not path.exists():
        raise FileNotFoundError(f"Audio file not found: {path}")
    return path


def latest_wav(directory: Path) -> Path:
    if not directory.exists():
        raise FileNotFoundError(f"Audio folder not found: {directory}")
    wavs = [path for path in directory.glob("*.wav") if path.is_file()]
    if not wavs:
        raise FileNotFoundError(f"No WAV files found in: {directory}")
    return max(wavs, key=lambda path: path.stat().st_mtime)


def resolve_reference_path(args: argparse.Namespace, audio_path: Path) -> Path | None:
    if args.reference_text:
        path = Path(args.reference_text).expanduser().resolve()
        if not path.exists():
            raise FileNotFoundError(f"Reference text not found: {path}")
        return path
    candidate = audio_path.with_name(f"{audio_path.stem}_script.txt")
    return candidate if candidate.exists() else None


def resolve_output_prefix(args: argparse.Namespace, audio_path: Path) -> Path:
    if args.output_prefix:
        return Path(args.output_prefix).expanduser().resolve()
    return audio_path.with_name(f"{audio_path.stem}_whisper")


def transcribe_audio(args: argparse.Namespace, audio_path: Path) -> tuple[list[Any], Any]:
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise MissingDependencyError(
            "faster-whisper is not installed. Install it with: python -m pip install -r requirements.txt"
        ) from exc

    model_kwargs: dict[str, Any] = {
        "device": args.device,
        "compute_type": args.compute_type,
        "num_workers": args.num_workers,
    }
    if args.device == "cpu" and args.cpu_threads:
        model_kwargs["cpu_threads"] = args.cpu_threads

    model = WhisperModel(args.model, **model_kwargs)
    vad_parameters = {
        "threshold": args.vad_threshold,
        "min_silence_duration_ms": args.vad_min_silence_ms,
    }
    language = None if args.language == "auto" else args.language
    segments, info = model.transcribe(
        str(audio_path),
        language=language,
        beam_size=args.beam_size,
        vad_filter=args.vad_filter,
        vad_parameters=vad_parameters,
        word_timestamps=args.word_timestamps,
        initial_prompt=args.initial_prompt or None,
        temperature=args.temperature,
        compression_ratio_threshold=args.compression_ratio_threshold,
        no_speech_threshold=args.no_speech_threshold,
    )
    return list(segments), info


def build_cues(segments: list[Any], max_cue_chars: int, max_cue_duration: float) -> list[Cue]:
    cues: list[Cue] = []
    for segment in segments:
        words = list(getattr(segment, "words", None) or [])
        if words:
            cues.extend(cues_from_words(words, max_cue_chars, max_cue_duration))
        else:
            cues.extend(cues_from_segment(segment, max_cue_chars))
    return reindex_cues(cues)


def cues_from_words(words: list[Any], max_cue_chars: int, max_cue_duration: float) -> list[Cue]:
    cues: list[Cue] = []
    tokens: list[str] = []
    start: float | None = None
    end = 0.0

    for word in words:
        token = normalize_text(str(getattr(word, "word", "") or ""))
        if not token:
            continue
        word_start = float(getattr(word, "start", end) or end)
        word_end = float(getattr(word, "end", word_start) or word_start)
        candidate = join_tokens(tokens + [token])
        duration = word_end - (start if start is not None else word_start)
        should_flush = bool(tokens) and (len(candidate) > max_cue_chars or duration > max_cue_duration)
        if should_flush:
            cues.append(Cue(0, start if start is not None else word_start, max(end, word_start), join_tokens(tokens)))
            tokens = [token]
            start = word_start
        else:
            if start is None:
                start = word_start
            tokens.append(token)
        end = word_end

    if tokens and start is not None:
        cues.append(Cue(0, start, max(end, start + 0.05), join_tokens(tokens)))
    return cues


def cues_from_segment(segment: Any, max_cue_chars: int) -> list[Cue]:
    text = normalize_text(str(getattr(segment, "text", "") or ""))
    start = float(getattr(segment, "start", 0.0) or 0.0)
    end = float(getattr(segment, "end", start + 0.05) or start + 0.05)
    chunks = split_text_by_chars(text, max_cue_chars)
    if not chunks:
        return []
    weights = [max(len(chunk), 1) for chunk in chunks]
    total = sum(weights)
    duration = max(end - start, 0.05)
    cursor = start
    cues: list[Cue] = []
    for index, (chunk, weight) in enumerate(zip(chunks, weights), start=1):
        cue_end = end if index == len(chunks) else cursor + duration * weight / total
        cues.append(Cue(0, cursor, max(cue_end, cursor + 0.05), chunk))
        cursor = cue_end
    return cues


def merge_short_cues(cues: list[Cue], min_duration: float, max_cue_chars: int) -> list[Cue]:
    merged: list[Cue] = []
    for cue in cues:
        duration = cue.end - cue.start
        if merged and duration < min_duration and len(merged[-1].text) + len(cue.text) + 1 <= max_cue_chars:
            previous = merged[-1]
            previous.end = max(previous.end, cue.end)
            previous.text = normalize_text(f"{previous.text} {cue.text}")
        else:
            merged.append(cue)
    return reindex_cues(merged)


def apply_reference_text(cues: list[Cue], reference_text: str) -> list[Cue]:
    text = normalize_text(reference_text)
    if not cues or not text:
        return cues
    weights = [max(len(cue.text), 1) for cue in cues]
    chunks = split_reference_by_weights(text, weights)
    replaced = [
        Cue(index=cue.index, start=cue.start, end=cue.end, text=chunk or cue.text)
        for cue, chunk in zip(cues, chunks)
    ]
    return reindex_cues(replaced)


def split_reference_by_weights(text: str, weights: list[int]) -> list[str]:
    if len(weights) <= 1:
        return [text]
    chunks: list[str] = []
    cursor = 0
    total_weight = sum(weights)
    consumed_weight = 0
    for index, weight in enumerate(weights, start=1):
        consumed_weight += weight
        if index == len(weights):
            chunks.append(text[cursor:].strip())
            break
        target = round(len(text) * consumed_weight / total_weight)
        end = choose_boundary(text, cursor, target)
        chunks.append(text[cursor:end].strip())
        cursor = end
    return chunks


def choose_boundary(text: str, cursor: int, target: int) -> int:
    target = max(cursor + 1, min(target, len(text) - 1))
    window_start = max(cursor + 1, target - 35)
    window_end = min(len(text) - 1, target + 35)
    punctuation = ".!?。！？"
    candidates: list[tuple[int, int]] = []
    for pos in range(window_start, window_end + 1):
        char = text[pos - 1]
        if char in punctuation:
            candidates.append((abs(pos - target), pos))
        elif char.isspace():
            candidates.append((abs(pos - target) + 10, pos))
    if candidates:
        return min(candidates)[1]
    return target


def split_text_by_chars(text: str, max_chars: int) -> list[str]:
    text = normalize_text(text)
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]
    words = text.split()
    if len(words) <= 1:
        return [text[index : index + max_chars].strip() for index in range(0, len(text), max_chars)]
    chunks: list[str] = []
    line = ""
    for word in words:
        candidate = normalize_text(f"{line} {word}")
        if len(candidate) <= max_chars:
            line = candidate
        else:
            if line:
                chunks.append(line)
            line = word
    if line:
        chunks.append(line)
    return chunks


def join_tokens(tokens: list[str]) -> str:
    return normalize_text(" ".join(token.strip() for token in tokens if token.strip()))


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def reindex_cues(cues: list[Cue]) -> list[Cue]:
    return [Cue(index=index, start=cue.start, end=max(cue.end, cue.start + 0.05), text=cue.text) for index, cue in enumerate(cues, 1)]


def write_outputs(
    output_prefix: Path,
    audio_path: Path,
    cues: list[Cue],
    info: Any,
    args: argparse.Namespace,
    reference_path: Path | None,
    text_source: str,
) -> None:
    output_prefix.parent.mkdir(parents=True, exist_ok=True)
    srt_path = output_prefix.with_suffix(".srt")
    vtt_path = output_prefix.with_suffix(".vtt")
    txt_path = output_prefix.with_suffix(".txt")
    json_path = output_prefix.with_suffix(".json")
    log_path = output_prefix.with_name(f"{output_prefix.name}_log.txt")

    srt_path.write_text(format_srt(cues, args.max_line_chars), encoding="utf-8")
    vtt_path.write_text(format_vtt(cues, args.max_line_chars), encoding="utf-8")
    txt_path.write_text("\n".join(wrap_text(cue.text, args.max_line_chars) for cue in cues) + "\n", encoding="utf-8")
    json_path.write_text(
        json.dumps(
            {
                "ok": True,
                "created_at": datetime.now().isoformat(timespec="seconds"),
                "audio_path": str(audio_path),
                "reference_path": str(reference_path) if reference_path else None,
                "text_source": text_source,
                "info": whisper_info(info),
                "options": vars(args),
                "cues": [asdict(cue) for cue in cues],
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    log_path.write_text(format_log(audio_path, output_prefix, info, args, reference_path, text_source, cues), encoding="utf-8")
    print(json.dumps({
        "ok": True,
        "audio": str(audio_path),
        "srt": str(srt_path),
        "vtt": str(vtt_path),
        "txt": str(txt_path),
        "json": str(json_path),
        "log": str(log_path),
        "cues": len(cues),
        "text_source": text_source,
    }, ensure_ascii=False))


def whisper_info(info: Any) -> dict[str, Any]:
    keys = [
        "language",
        "language_probability",
        "duration",
        "duration_after_vad",
        "all_language_probs",
        "transcription_options",
        "vad_options",
    ]
    result: dict[str, Any] = {}
    for key in keys:
        value = getattr(info, key, None)
        if value is not None:
            result[key] = stringify_unknown(value)
    return result


def stringify_unknown(value: Any) -> Any:
    try:
        json.dumps(value)
        return value
    except TypeError:
        if isinstance(value, (list, tuple)):
            return [stringify_unknown(item) for item in value]
        if hasattr(value, "__dict__"):
            return {key: stringify_unknown(val) for key, val in vars(value).items()}
        return str(value)


def format_log(
    audio_path: Path,
    output_prefix: Path,
    info: Any,
    args: argparse.Namespace,
    reference_path: Path | None,
    text_source: str,
    cues: list[Cue],
) -> str:
    lines = [
        f"created_at: {datetime.now().isoformat(timespec='seconds')}",
        f"audio_path: {audio_path}",
        f"output_prefix: {output_prefix}",
        f"reference_path: {reference_path or ''}",
        f"text_source: {text_source}",
        f"cue_count: {len(cues)}",
        "",
        "[whisper_info]",
    ]
    for key, value in whisper_info(info).items():
        lines.append(f"{key}: {value}")
    lines.extend(["", "[options]"])
    for key, value in sorted(vars(args).items()):
        lines.append(f"{key}: {value}")
    return "\n".join(lines) + "\n"


def format_srt(cues: list[Cue], max_line_chars: int = 42) -> str:
    blocks = []
    for cue in cues:
        blocks.append(f"{cue.index}\n{timestamp(cue.start, ',')} --> {timestamp(cue.end, ',')}\n{wrap_text(cue.text, max_line_chars)}")
    return "\n\n".join(blocks) + "\n"


def format_vtt(cues: list[Cue], max_line_chars: int = 42) -> str:
    blocks = ["WEBVTT", ""]
    for cue in cues:
        blocks.append(f"{timestamp(cue.start, '.')} --> {timestamp(cue.end, '.')}\n{wrap_text(cue.text, max_line_chars)}\n")
    return "\n".join(blocks)


def wrap_text(text: str, max_line_chars: int) -> str:
    return "\n".join(split_text_by_chars(text, max_line_chars))


def timestamp(seconds: float, separator: str) -> str:
    milliseconds = max(0, round(seconds * 1000))
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    secs, millis = divmod(remainder, 1000)
    return f"{hours:02}:{minutes:02}:{secs:02}{separator}{millis:03}"


if __name__ == "__main__":
    raise SystemExit(run())
