from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from whisper_subtitle_refiner import (
    Cue,
    apply_reference_text,
    format_srt,
    format_vtt,
    latest_wav,
    split_text_by_chars,
    timestamp,
)


class WhisperSubtitleRefinerTest(unittest.TestCase):
    def test_timestamp_formats_srt_and_vtt(self):
        self.assertEqual(timestamp(3661.234, ","), "01:01:01,234")
        self.assertEqual(timestamp(1.2, "."), "00:00:01.200")

    def test_format_srt_and_vtt(self):
        cues = [Cue(1, 0.0, 1.5, "안녕하세요. 테스트입니다.")]
        self.assertIn("00:00:00,000 --> 00:00:01,500", format_srt(cues))
        self.assertTrue(format_vtt(cues).startswith("WEBVTT"))

    def test_split_text_by_chars_keeps_short_lines(self):
        chunks = split_text_by_chars("짧은 문장 하나와 조금 더 긴 문장 둘입니다.", 12)
        self.assertGreaterEqual(len(chunks), 2)
        self.assertTrue(all(len(chunk) <= 12 for chunk in chunks))

    def test_apply_reference_text_preserves_cue_times(self):
        cues = [
            Cue(1, 0.0, 1.0, "whisper one"),
            Cue(2, 1.0, 2.0, "whisper two"),
        ]
        replaced = apply_reference_text(cues, "원본 대본 첫 문장입니다. 원본 대본 둘째 문장입니다.")
        self.assertEqual(replaced[0].start, 0.0)
        self.assertEqual(replaced[1].end, 2.0)
        self.assertIn("원본", replaced[0].text)

    def test_latest_wav_picks_newest_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            old = root / "old.wav"
            new = root / "new.wav"
            old.write_bytes(b"old")
            new.write_bytes(b"new")
            old.touch()
            new.touch()
            self.assertEqual(latest_wav(root).name, "new.wav")


if __name__ == "__main__":
    unittest.main()
