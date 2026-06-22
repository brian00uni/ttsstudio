from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Callable, Any

from supertonic3_engine import AVAILABLE_MODELS, Supertonic3Engine


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Supertonic 3 local TTS CLI for Hermes command provider")
    parser.add_argument("--input", "--text-path", dest="input_path", required=True, help="UTF-8 text input file")
    parser.add_argument("--output", "--output-path", dest="output_path", required=True, help="Audio output path, usually .wav")
    parser.add_argument("--model", choices=AVAILABLE_MODELS, default="supertonic-3")
    parser.add_argument("--model-dir", default=None, help="Directory containing model files")
    parser.add_argument("--voice", default="M1", help="Voice preset: M1-M5 or F1-F5")
    parser.add_argument("--voice-style-path", "--custom-style-path", dest="voice_style_path", default=None, help="Custom voice style JSON path")
    parser.add_argument("--lang", default="ko", help="Language code, e.g. ko/en/ja/na. Use 'auto' for SDK default")
    parser.add_argument("--speed", type=float, default=1.05)
    parser.add_argument("--total-step", "--steps", dest="total_step", type=int, default=8)
    parser.add_argument("--max-chunk-length", type=int, default=None)
    parser.add_argument("--silence-duration", type=float, default=0.3)
    parser.add_argument("--intra-op-num-threads", type=int, default=None)
    parser.add_argument("--inter-op-num-threads", type=int, default=None)
    parser.add_argument("--no-auto-download", dest="auto_download", action="store_false", default=True)
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--json", action="store_true", help="Print JSON result")
    return parser


def run_cli(argv: list[str] | None = None, engine_factory: Callable[[], Any] | None = None) -> int:
    args = build_parser().parse_args(argv)
    text_path = Path(args.input_path)
    text = text_path.read_text(encoding="utf-8").strip()
    if not text:
        print("Input text file is empty", file=sys.stderr)
        return 2
    engine = engine_factory() if engine_factory else Supertonic3Engine(output_dir=Path(args.output_path).parent)
    info = engine.synthesize_to_file(
        text=text,
        output_path=args.output_path,
        model=args.model,
        model_dir=args.model_dir,
        auto_download=args.auto_download,
        intra_op_num_threads=args.intra_op_num_threads,
        inter_op_num_threads=args.inter_op_num_threads,
        voice=args.voice,
        voice_style_path=args.voice_style_path,
        lang=None if args.lang == "auto" else args.lang,
        speed=args.speed,
        total_step=args.total_step,
        max_chunk_length=args.max_chunk_length,
        silence_duration=args.silence_duration,
        verbose=args.verbose,
    )
    if args.json:
        print(json.dumps({"ok": True, **info}, ensure_ascii=False))
    else:
        print(info["path"])
    return 0


if __name__ == "__main__":
    raise SystemExit(run_cli())
