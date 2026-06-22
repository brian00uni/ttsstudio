from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from supertonic3_engine import Supertonic3Engine

OUT_DIR = ROOT / "public" / "voice-samples"
TEXT_PATH = OUT_DIR / "voice-test-ko.txt"
VOICES = ["M1", "M2", "M3", "M4", "M5", "F1", "F2", "F3", "F4", "F5"]


def main() -> int:
    text = TEXT_PATH.read_text(encoding="utf-8")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    engine = Supertonic3Engine(output_dir=OUT_DIR)
    for voice in VOICES:
        output_path = OUT_DIR / f"{voice}.wav"
        print(f"generating {voice} -> {output_path}", flush=True)
        engine.synthesize_to_file(
            text=text,
            output_path=output_path,
            voice=voice,
            lang="ko",
            speed=1.05,
            total_step=8,
            max_chunk_length=120,
            silence_duration=0.3,
            verbose=False,
        )
    print("done", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
