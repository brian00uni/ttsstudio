import io
import json
import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
import sys
sys.path.insert(0, str(ROOT / "src"))


class FakeEngine:
    def __init__(self, output_dir=None):
        self.output_dir = Path(output_dir or tempfile.mkdtemp())

    def options(self):
        from supertonic3_engine import option_metadata
        return option_metadata()

    def list_voices(self):
        return ["M1", "M2", "M3", "M4", "M5", "F1", "F2", "F3", "F4", "F5"]

    def synthesize_to_file(self, *, text, output_path=None, voice="M1", lang="ko", speed=1.05, total_step=8, **kwargs):
        out = Path(output_path) if output_path else self.output_dir / "fake.wav"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(b"RIFF\x24\x00\x00\x00WAVEfmt ")
        return {
            "path": str(out),
            "duration": 0.1,
            "sample_rate": 24000,
            "voice": kwargs.get("voice_style_path") or voice,
            "lang": lang,
            "model": kwargs.get("model", "supertonic-3"),
            "speed": speed,
            "total_step": total_step,
            "max_chunk_length": kwargs.get("max_chunk_length"),
            "silence_duration": kwargs.get("silence_duration", 0.3),
        }


class SupertonicLocalTTSTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["SUPERTONIC3_OUTPUT_DIR"] = self.tmp.name
        os.environ["SUPERTONIC3_AUTO_MP3"] = "0"

    def tearDown(self):
        self.tmp.cleanup()
        os.environ.pop("SUPERTONIC3_OUTPUT_DIR", None)
        os.environ.pop("SUPERTONIC3_AUTO_MP3", None)

    def test_health_reports_ready_shape_without_loading_model(self):
        from app import create_app
        app = create_app(engine_factory=lambda: FakeEngine(self.tmp.name))
        client = app.test_client()

        res = client.get("/health")

        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["ok"], True)
        self.assertEqual(data["engine"], "supertonic3-local")
        self.assertIn("output_dir", data)
        self.assertIn("versions", data)
        self.assertEqual(data["versions"].get("supertonic"), "1.3.1")

    def test_tts_api_writes_wav_and_returns_public_url(self):
        from app import create_app
        app = create_app(engine_factory=lambda: FakeEngine(self.tmp.name))
        client = app.test_client()

        res = client.post("/api/tts", json={"text": "안녕하세요. 로컬 음성 테스트입니다.", "voice": "F1", "lang": "ko"})

        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["ok"], True)
        self.assertTrue(data["audio_url"].startswith("/audio/"))
        self.assertTrue(Path(data["path"]).exists())
        self.assertEqual(data["voice"], "F1")
        self.assertTrue(Path(data["script_path"]).exists())
        self.assertTrue(Path(data["input_log_path"]).exists())
        self.assertTrue(Path(data["srt_path"]).exists())
        self.assertTrue(Path(data["vtt_path"]).exists())
        self.assertIn("1\n00:00:00,000 -->", Path(data["srt_path"]).read_text(encoding="utf-8"))
        self.assertIn("WEBVTT", Path(data["vtt_path"]).read_text(encoding="utf-8"))

    def test_tts_api_removes_emoji_before_synthesis(self):
        captured = {}

        class RecordingEngine(FakeEngine):
            def synthesize_to_file(self, **kwargs):
                captured["text"] = kwargs["text"]
                return super().synthesize_to_file(**kwargs)

        from app import create_app
        app = create_app(engine_factory=lambda: RecordingEngine(self.tmp.name))
        client = app.test_client()

        res = client.post("/api/tts", json={"text": "📝 이모지로 시작하는 대본입니다.", "voice": "F1", "lang": "ko"})

        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["ok"], True)
        self.assertEqual(captured["text"], "이모지로 시작하는 대본입니다.")
        self.assertNotIn("📝", Path(data["script_path"]).read_text(encoding="utf-8"))

    def test_options_api_exposes_full_supertonic_controls(self):
        from app import create_app
        app = create_app(engine_factory=lambda: FakeEngine(self.tmp.name))
        client = app.test_client()

        res = client.get("/api/options")

        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("supertonic-3", data["models"])
        self.assertIn({"code": "na", "name": "Unknown fallback"}, data["languages"])
        self.assertIn("<laugh>", data["expression_tags"])
        self.assertIn("<surprise>", data["expression_tags"])
        self.assertIn("<throatclear>", data["expression_tags"])
        self.assertIn("<yawn>", data["expression_tags"])
        self.assertIn("max_chunk_length", data["limits"])
        self.assertEqual(data["defaults"]["verbose"], True)
        self.assertEqual(data["defaults"]["whisper_refine"], False)

    def test_license_notices_route_serves_root_notice(self):
        from app import create_app
        app = create_app(engine_factory=lambda: FakeEngine(self.tmp.name))
        client = app.test_client()

        res = client.get("/license-notices")

        self.assertEqual(res.status_code, 200)
        text = res.get_data(as_text=True)
        self.assertIn("License and copyright notices", text)
        self.assertIn("무료로 실행할 수 있다는 사실과 공개 콘텐츠에 자유롭게 사용할 수 있다는 사실은 별개입니다.", text)
        self.assertIn("Gyan FFmpeg builds: GPLv3", text)
        self.assertIn("https://min-inter.co.kr/youtube-curator-danbi/columns/supertonic3-free-local-tts-zip-guide", text)
        self.assertIn("http://127.0.0.1:3093/license-notices", text)
        res.close()

    def test_public_cpu_image_is_served(self):
        from app import create_app
        app = create_app(engine_factory=lambda: FakeEngine(self.tmp.name))
        client = app.test_client()

        res = client.get("/public/only-cpu-can-generate.jpg")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.mimetype, "image/jpeg")
        res.close()

    def test_public_supertonic_3_image_is_served(self):
        from app import create_app
        app = create_app(engine_factory=lambda: FakeEngine(self.tmp.name))
        client = app.test_client()

        res = client.get("/public/supertonic_3.jpg")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.mimetype, "image/jpeg")
        res.close()

    def test_public_paperlogy_font_is_served(self):
        from app import create_app
        app = create_app(engine_factory=lambda: FakeEngine(self.tmp.name))
        client = app.test_client()

        res = client.get("/public/font/Paperlogy-4Regular.ttf")

        self.assertEqual(res.status_code, 200)
        self.assertGreater(len(res.data), 1000)
        res.close()

    def test_public_script_catalog_is_served(self):
        from app import create_app
        app = create_app(engine_factory=lambda: FakeEngine(self.tmp.name))
        client = app.test_client()

        res = client.get("/public/scripts.json")

        self.assertEqual(res.status_code, 200)
        data = json.loads(res.get_data(as_text=True))
        self.assertGreaterEqual(len(data["scripts"]), 1)
        self.assertIn("text", data["scripts"][0])
        self.assertTrue(any(script["id"] == "long-story-sewing-basket-ko" for script in data["scripts"]))
        res.close()

    def test_public_voice_samples_are_served(self):
        from app import create_app
        app = create_app(engine_factory=lambda: FakeEngine(self.tmp.name))
        client = app.test_client()

        manifest = client.get("/public/voice-samples.json")

        self.assertEqual(manifest.status_code, 200)
        data = json.loads(manifest.get_data(as_text=True))
        self.assertEqual(len(data["samples"]), 10)
        self.assertTrue(any(sample["voice"] == "M1" for sample in data["samples"]))
        self.assertTrue(any(sample["voice"] == "F5" for sample in data["samples"]))

        wav = client.get("/public/voice-samples/M1.wav")
        self.assertEqual(wav.status_code, 200)
        self.assertEqual(wav.data[:4], b"RIFF")
        self.assertGreater(len(wav.data), 1000)
        manifest.close()
        wav.close()

    def test_public_long_story_sample_is_served(self):
        from app import create_app
        app = create_app(engine_factory=lambda: FakeEngine(self.tmp.name))
        client = app.test_client()

        res = client.get("/public/sample-long-story-ko.txt")

        self.assertEqual(res.status_code, 200)
        self.assertIn("반짇고리", res.get_data(as_text=True))
        res.close()

    def test_tts_api_accepts_advanced_options(self):
        from app import create_app
        app = create_app(engine_factory=lambda: FakeEngine(self.tmp.name))
        client = app.test_client()

        res = client.post("/api/tts", json={
            "text": "Advanced option test.",
            "model": "supertonic-3",
            "voice": "M2",
            "lang": "auto",
            "speed": 1.2,
            "total_step": 12,
            "max_chunk_length": 120,
            "silence_duration": 0.15,
            "verbose": True,
        })

        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["model"], "supertonic-3")
        self.assertIsNone(data["lang"])
        self.assertEqual(data["speed"], 1.2)
        self.assertEqual(data["total_step"], 12)
        self.assertEqual(data["max_chunk_length"], 120)
        self.assertEqual(data["silence_duration"], 0.15)

    def test_refine_subtitles_api_returns_whisper_download_urls(self):
        from app import create_app
        app = create_app(engine_factory=lambda: FakeEngine(self.tmp.name))
        client = app.test_client()
        audio = Path(self.tmp.name) / "sample.wav"
        audio.write_bytes(b"RIFF\x24\x00\x00\x00WAVEfmt ")
        srt = Path(self.tmp.name) / "sample_whisper.srt"
        vtt = Path(self.tmp.name) / "sample_whisper.vtt"
        txt = Path(self.tmp.name) / "sample_whisper.txt"
        log = Path(self.tmp.name) / "sample_whisper_log.txt"

        with patch("app._run_whisper_refiner", return_value={
            "ok": True,
            "srt": str(srt),
            "vtt": str(vtt),
            "txt": str(txt),
            "log": str(log),
            "cues": 1,
            "text_source": "reference",
        }):
            res = client.post("/api/refine-subtitles", json={"audio_path": str(audio), "language": "ko"})

        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["ok"], True)
        self.assertEqual(data["whisper_srt_url"], "/audio/sample_whisper.srt")
        self.assertEqual(data["whisper_vtt_url"], "/audio/sample_whisper.vtt")
        self.assertEqual(data["whisper_txt_url"], "/audio/sample_whisper.txt")
        self.assertEqual(data["whisper_log_url"], "/audio/sample_whisper_log.txt")

    def test_tts_api_auto_mp3_uses_ffmpeg_when_enabled(self):
        from app import create_app
        app = create_app(engine_factory=lambda: FakeEngine(self.tmp.name))
        client = app.test_client()

        def fake_run(command, **kwargs):
            Path(command[-1]).write_bytes(b"ID3 fake mp3")
            class Result:
                returncode = 0
                stdout = ""
                stderr = ""
            return Result()

        with patch.dict(os.environ, {"SUPERTONIC3_AUTO_MP3": "1"}), patch(
            "app.shutil.which", return_value="ffmpeg"
        ), patch("app.subprocess.run", side_effect=fake_run):
            res = client.post("/api/tts", json={"text": "MP3 자동 변환 테스트", "voice": "F1", "lang": "ko"})

        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["audio_format"], "mp3")
        self.assertTrue(data["audio_url"].endswith(".mp3"))
        self.assertTrue(Path(data["wav_path"]).exists())
        self.assertTrue(Path(data["path"]).exists())
        self.assertTrue(Path(data["path"]).suffix == ".mp3")

    def test_convert_mp3_api_uses_ffmpeg_and_returns_download_url(self):
        from app import create_app
        app = create_app(engine_factory=lambda: FakeEngine(self.tmp.name))
        client = app.test_client()
        audio = Path(self.tmp.name) / "sample.wav"
        audio.write_bytes(b"RIFF\x24\x00\x00\x00WAVEfmt ")

        def fake_run(command, **kwargs):
            Path(command[-1]).write_bytes(b"ID3 fake mp3")
            class Result:
                returncode = 0
                stdout = ""
                stderr = ""
            return Result()

        with patch("app.shutil.which", return_value="ffmpeg"), patch("app.subprocess.run", side_effect=fake_run) as run:
            res = client.post("/api/convert-mp3", json={"audio_path": str(audio)})

        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["ok"], True)
        self.assertEqual(data["mp3_url"], "/audio/sample.mp3")
        self.assertEqual(data["mp3_convert_log_url"], "/audio/sample_mp3_convert_log.txt")
        self.assertTrue(Path(data["mp3_path"]).exists())
        self.assertIn("개인 사용 OK", data["notice"])
        self.assertIn("ZIP에 ffmpeg 미포함", data["notice"])
        self.assertIn("재배포 시 라이선스 확인", data["notice"])
        self.assertIn("-codec:a", run.call_args.args[0])

    def test_convert_mp3_api_reports_missing_ffmpeg(self):
        from app import create_app
        app = create_app(engine_factory=lambda: FakeEngine(self.tmp.name))
        client = app.test_client()
        audio = Path(self.tmp.name) / "sample.wav"
        audio.write_bytes(b"RIFF\x24\x00\x00\x00WAVEfmt ")

        with patch("app.shutil.which", return_value=None):
            res = client.post("/api/convert-mp3", json={"audio_path": str(audio)})

        self.assertEqual(res.status_code, 503)
        self.assertIn("ffmpeg", res.get_json()["error"])

    def test_tts_job_api_runs_generation_in_background(self):
        from app import create_app
        app = create_app(engine_factory=lambda: FakeEngine(self.tmp.name))
        client = app.test_client()

        res = client.post("/api/tts-job", json={"text": "긴 대본 백그라운드 생성 테스트입니다.", "voice": "F1", "lang": "ko"})

        self.assertEqual(res.status_code, 202)
        started = res.get_json()
        self.assertEqual(started["ok"], True)
        self.assertIn("job_id", started)

        data = None
        for _ in range(20):
            status = client.get(f"/api/tts-job/{started['job_id']}")
            self.assertEqual(status.status_code, 200)
            data = status.get_json()
            if data["status"] == "done":
                break
            time.sleep(0.02)

        self.assertIsNotNone(data)
        self.assertEqual(data["status"], "done")
        self.assertTrue(data["result"]["audio_url"].startswith("/audio/"))

    def test_latest_output_api_restores_download_urls(self):
        from app import create_app
        app = create_app(engine_factory=lambda: FakeEngine(self.tmp.name))
        client = app.test_client()
        output_dir = Path(self.tmp.name)
        older = output_dir / "older.wav"
        latest = output_dir / "latest.wav"
        older.write_bytes(b"RIFF\x24\x00\x00\x00WAVEfmt ")
        latest.write_bytes(b"RIFF\x24\x00\x00\x00WAVEfmt ")
        for path in [
            output_dir / "latest_script.txt",
            output_dir / "latest_input_log.txt",
            output_dir / "latest.srt",
            output_dir / "latest.vtt",
            output_dir / "latest_whisper.srt",
            output_dir / "latest_whisper.vtt",
            output_dir / "latest_whisper.txt",
            output_dir / "latest_whisper_log.txt",
            output_dir / "latest.mp3",
            output_dir / "latest_mp3_convert_log.txt",
        ]:
            path.write_text("ok\n", encoding="utf-8")
        now = time.time()
        os.utime(older, (now - 10, now - 10))
        os.utime(latest, (now, now))

        res = client.get("/api/latest-output")

        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["ok"], True)
        result = data["result"]
        self.assertEqual(result["audio_url"], "/audio/latest.wav")
        self.assertEqual(result["script_url"], "/audio/latest_script.txt")
        self.assertEqual(result["input_log_url"], "/audio/latest_input_log.txt")
        self.assertEqual(result["srt_url"], "/audio/latest.srt")
        self.assertEqual(result["vtt_url"], "/audio/latest.vtt")
        self.assertEqual(result["whisper_srt_url"], "/audio/latest_whisper.srt")
        self.assertEqual(result["whisper_vtt_url"], "/audio/latest_whisper.vtt")
        self.assertEqual(result["whisper_txt_url"], "/audio/latest_whisper.txt")
        self.assertEqual(result["whisper_log_url"], "/audio/latest_whisper_log.txt")
        self.assertEqual(result["mp3_url"], "/audio/latest.mp3")
        self.assertEqual(result["mp3_convert_log_url"], "/audio/latest_mp3_convert_log.txt")

    def test_script_request_api_writes_request_and_latest_json(self):
        from app import create_app
        app = create_app(engine_factory=lambda: FakeEngine(self.tmp.name))
        client = app.test_client()

        res = client.post("/api/script-requests", json={
            "topic": "퇴근길에 듣는 위로 낭독문",
            "tone": "따뜻함",
            "length": "5분",
            "audience": "직장인",
            "notes": "너무 과장하지 말 것",
            "language": "ko",
        })

        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data["ok"], True)
        request_path = Path(data["request_path"])
        latest_path = Path(data["latest_path"])
        self.assertTrue(request_path.exists())
        self.assertTrue(latest_path.exists())
        self.assertTrue(data["request_relative_path"].startswith("script_requests/"))
        self.assertEqual(data["latest_relative_path"], "script_requests/latest.json")
        self.assertEqual(Path(data["output_dir"]).resolve(), Path(self.tmp.name).resolve())
        saved = json.loads(latest_path.read_text(encoding="utf-8"))
        self.assertEqual(saved["topic"], "퇴근길에 듣는 위로 낭독문")
        self.assertEqual(saved["tone"], "따뜻함")
        self.assertIn("recommended_output", saved)
        self.assertEqual(saved["expression_tag_mode"], "none")
        self.assertEqual(saved["use_expression_tags"], False)
        self.assertEqual(saved["expression_tags"], [])
        self.assertIn("expression_tag_guidance", saved)
        self.assertIn("넣지 않는다", "\n".join(saved["ai_workflow"]))
        self.assertIn("표현 태그는 넣지 않는다", saved["prompt_for_ai"])
        self.assertIn("public/scripts.json", saved["target_catalog"])

        latest = client.get("/api/script-requests/latest")
        self.assertEqual(latest.status_code, 200)
        self.assertEqual(latest.get_json()["request"]["id"], saved["id"])

    def test_script_request_api_can_enable_expression_tags(self):
        from app import create_app
        app = create_app(engine_factory=lambda: FakeEngine(self.tmp.name))
        client = app.test_client()

        res = client.post("/api/script-requests", json={
            "topic": "연기톤 테스트",
            "expression_tag_mode": "use",
        })

        self.assertEqual(res.status_code, 201)
        saved = res.get_json()["request"]
        self.assertEqual(saved["expression_tag_mode"], "use")
        self.assertEqual(saved["use_expression_tags"], True)
        self.assertIn("<surprise>", saved["expression_tags"])
        self.assertIn("<throatclear>", saved["expression_tags"])
        self.assertIn("표현 태그", "\n".join(saved["ai_workflow"]))
        self.assertIn("<yawn>", saved["prompt_for_ai"])

    def test_script_customs_api_lists_and_loads_txt_files(self):
        from app import create_app
        custom_dir = Path(self.tmp.name) / "script_customs"
        custom_dir.mkdir(parents=True, exist_ok=True)
        script_path = custom_dir / "local-sample.txt"
        script_path.write_text("로컬 TXT 대본입니다.\n두 번째 문장입니다.\n", encoding="utf-8")
        (custom_dir / "ignore.md").write_text("not listed", encoding="utf-8")

        app = create_app(engine_factory=lambda: FakeEngine(self.tmp.name))
        client = app.test_client()

        listed = client.get("/api/script-customs")
        self.assertEqual(listed.status_code, 200)
        data = listed.get_json()
        self.assertEqual(data["ok"], True)
        self.assertEqual(len(data["scripts"]), 1)
        self.assertEqual(data["scripts"][0]["name"], "local-sample.txt")
        self.assertEqual(data["scripts"][0]["relative_path"], "script_customs/local-sample.txt")
        self.assertIn("updated_at", data["scripts"][0])

        loaded = client.get("/api/script-customs/local-sample.txt")
        self.assertEqual(loaded.status_code, 200)
        loaded_data = loaded.get_json()
        self.assertEqual(loaded_data["name"], "local-sample.txt")
        self.assertIn("로컬 TXT 대본입니다.", loaded_data["text"])

        blocked = client.get("/api/script-customs/ignore.md")
        self.assertEqual(blocked.status_code, 400)

    def test_tts_api_rejects_empty_text(self):
        from app import create_app
        app = create_app(engine_factory=lambda: FakeEngine(self.tmp.name))
        client = app.test_client()

        res = client.post("/api/tts", json={"text": "   "})

        self.assertEqual(res.status_code, 400)
        self.assertIn("text", res.get_json()["error"].lower())

    def test_cli_generates_audio_from_input_file(self):
        from supertonic3_cli import run_cli
        text_file = Path(self.tmp.name) / "input.txt"
        output_file = Path(self.tmp.name) / "out.wav"
        text_file.write_text("헤르메스 채팅에서 호출되는 로컬 TTS입니다.", encoding="utf-8")

        code = run_cli(["--input", str(text_file), "--output", str(output_file), "--voice", "M1", "--lang", "ko"], engine_factory=lambda: FakeEngine(self.tmp.name))

        self.assertEqual(code, 0)
        self.assertTrue(output_file.exists())
        self.assertGreater(output_file.stat().st_size, 8)

    def test_ui_contains_expected_controls(self):
        ui = (ROOT / "ui" / "index.html").read_text(encoding="utf-8")
        self.assertIn('<html lang="ko" data-theme="light">', ui)
        self.assertIn("Supertonic Studio", ui)
        self.assertIn("20260520-text-scale-slider", ui)
        self.assertIn("themeToggle", ui)
        self.assertIn("https://min-inter.co.kr/youtube-curator-danbi/columns/supertonic3-free-local-tts-zip-guide", ui)
        self.assertIn("/license-notices", ui)
        self.assertIn("https://github.com/supertone-inc/supertonic", ui)
        self.assertIn("https://github.com/SYSTRAN/faster-whisper", ui)
        self.assertIn("https://www.ffmpeg.org/legal.html", ui)
        self.assertIn("https://www.gyan.dev/ffmpeg/builds/", ui)
        self.assertIn("topbar-link-row", ui)
        self.assertIn("topbar-state-card", ui)
        self.assertIn("topbar-main", ui)
        self.assertIn("header-utility-row", ui)
        self.assertIn("header-preset-row", ui)
        self.assertIn("header-preset-title", ui)
        self.assertIn("header-preset-controls", ui)
        self.assertIn("미포함된 소스코드", ui)
        self.assertIn("FFmpeg 선택설치 소스(Gyan)", ui)
        self.assertIn("FFmpeg 라이선스(Legal)", ui)
        self.assertIn("출처: 큐레이터 단비's 웹앱 아이디어 창고 - 배포 안내(Guide)", ui)
        self.assertIn("affiliation-notice", ui)
        self.assertIn("sticky-toolbox", ui)
        self.assertIn("ℹ️ 비공식 개발 고지", ui)
        self.assertIn("🎙️ 목소리 10종 빠른 선택", ui)
        self.assertIn("본 프로그램은 슈퍼톤(하이브)의", ui)
        self.assertIn("슈퍼토닉3 깃헙 모델", ui)
        self.assertNotIn("본 페이지 개발자는 슈퍼톤과 관련이 없습니다.", ui)
        self.assertIn("textarea", ui)
        self.assertIn("textScale", ui)
        self.assertIn("textScaleValue", ui)
        self.assertIn("편집 글자 크기", ui)
        self.assertIn('type="range" min="90" max="180" step="5" value="115"', ui)
        self.assertIn('<output id="textScaleValue" for="textScale">115%</output>', ui)
        self.assertIn("<output id=\"textScaleValue\"", ui)
        self.assertIn("scriptCatalog", ui)
        self.assertIn("scriptTabApi", ui)
        self.assertIn("scriptPanelApi", ui)
        self.assertIn("무료 API(Free API)", ui)
        self.assertIn("apiGuideAiContract", ui)
        self.assertIn("apiGuideCurlTts", ui)
        self.assertIn("scriptTabManual", ui)
        self.assertIn("scriptPanelManual", ui)
        self.assertIn("scriptTabCustom", ui)
        self.assertIn("customScriptList", ui)
        self.assertIn("visually-hidden", ui)
        self.assertIn("customScriptCards", ui)
        self.assertIn("custom-script-card-panel", ui)
        self.assertIn("customScriptSearch", ui)
        self.assertIn("data-custom-sort=\"latest\"", ui)
        self.assertIn("data-custom-sort=\"name_asc\"", ui)
        self.assertIn("custom-script-toolbar-line", ui)
        self.assertIn("placeholder=\"검색\"", ui)
        self.assertIn("reloadCustomScripts", ui)
        self.assertIn("scriptTabAssist", ui)
        self.assertIn("scriptPanelAssist", ui)
        self.assertIn("대본 요청 &amp; 샘플(Request &amp; Samples)", ui)
        self.assertIn("script-path-guide", ui)
        self.assertLess(ui.index("Supertonic Studio"), ui.index("script-path-guide"))
        self.assertLess(ui.index("script-path-guide"), ui.index("topbar-actions"))
        self.assertIn("로컬 TXT 파일 위치", ui)
        self.assertIn("data/script_customs/*.txt", ui)
        self.assertIn("대본 요청 파일 위치", ui)
        self.assertIn("data/script_requests/latest.json", ui)
        self.assertIn("샘플 목록 파일 위치", ui)
        self.assertIn("public/scripts.json", ui)
        self.assertIn("생성 결과 파일 위치", ui)
        self.assertIn("data/*.mp3 · *.srt · *.vtt · *.txt", ui)
        self.assertLess(ui.index("scriptTabApi"), ui.index("scriptTabManual"))
        self.assertLess(ui.index("scriptTabManual"), ui.index("scriptTabCustom"))
        self.assertLess(ui.index("scriptTabCustom"), ui.index("scriptTabAssist"))
        self.assertIn("scriptRequestTopic", ui)
        self.assertIn("scriptPanelRequest", ui)
        self.assertIn("scriptRequestExpressionMode", ui)
        self.assertIn('<option value="none" selected>없음(None)</option>', ui)
        self.assertIn("scriptRequestSubmit", ui)
        self.assertIn("reloadScripts", ui)
        self.assertIn("voice", ui)
        self.assertIn("voicePreviewCurrent", ui)
        self.assertIn("voiceSamplePlayer", ui)
        self.assertIn("voiceSampleGrid", ui)
        self.assertLess(ui.index("sticky-toolbox"), ui.index("voiceSampleGrid"))
        self.assertLess(ui.index("voiceSampleGrid"), ui.index("affiliation-notice"))
        self.assertIn("maxChunkLength", ui)
        self.assertIn("voiceStylePath", ui)
        self.assertIn("only-cpu-can-generate.jpg", ui)
        self.assertIn("supertonic_3.jpg", ui)
        self.assertIn("reference-grid", ui)
        self.assertIn("projectGuide", ui)
        self.assertIn("supertonic-upstream", ui)
        self.assertIn("supertonic3-local-tts", ui)
        self.assertIn("31개 언어", ui)
        self.assertIn("presetSlot", ui)
        self.assertLess(ui.index("header-preset-row"), ui.index("scriptTabManual"))
        self.assertIn("speedPreset", ui)
        self.assertIn('readonly aria-readonly="true"', ui)
        self.assertIn('data-locked-input="true"', ui)
        self.assertIn("srtDownload", ui)
        self.assertIn("whisperRefine", ui)
        self.assertIn('<details class="advanced" open>', ui)
        self.assertIn('<input id="verbose" type="checkbox" checked', ui)
        self.assertIn('<input id="whisperRefine" type="checkbox" />', ui)
        self.assertIn("refineExisting", ui)
        self.assertIn("output-format-note", ui)
        self.assertIn("whisperSrtDownload", ui)
        self.assertIn("whisperVttDownload", ui)
        self.assertIn("inputLogDownload", ui)
        js = (ROOT / "ui" / "main.js").read_text(encoding="utf-8")
        self.assertIn("/api/tts", js)
        self.assertIn("/api/tts-job", js)
        self.assertIn("/api/latest-output", js)
        self.assertIn("/api/script-requests", js)
        self.assertIn("/api/script-customs", js)
        self.assertIn("loadCustomScripts", js)
        self.assertIn("applyCustomScript", js)
        self.assertIn("CUSTOM_SCRIPT_SORT", js)
        self.assertIn("visibleCustomScripts", js)
        self.assertIn("splitFileLabel", js)
        self.assertIn("renderFileLabel", js)
        self.assertIn("updateCustomSortButtons", js)
        self.assertIn("customScriptCards", js)
        self.assertIn("customScriptSearch", js)
        self.assertIn("custom-script-card", js)
        self.assertIn("renderFileLabel(button, script.name);", js)
        self.assertIn("initApiGuide", js)
        self.assertIn("renderApiGuideExamples", js)
        self.assertIn("apiGuideContract", js)
        self.assertIn("setScriptTab(\"manual\")", js)
        self.assertIn("expression_tag_mode", js)
        self.assertIn("/api/refine-subtitles", js)
        self.assertIn("/api/convert-mp3", js)
        self.assertIn("audio_format", js)
        self.assertIn("whisperAudioPath", js)
        self.assertIn("MP3 자동 변환 실패", js)
        self.assertIn("/public/scripts.json", js)
        self.assertIn("/public/voice-samples.json", js)
        self.assertIn("text_url", js)
        self.assertIn("applyScript", js)
        self.assertIn("playVoiceSample", js)
        self.assertIn("selectVoiceSample", js)
        self.assertIn("const sample = voiceSampleFor(voice);", js)
        self.assertIn("shortVoiceLabel", js)
        self.assertIn("return `남성 ${voice}`;", js)
        self.assertIn("return `여성 ${voice}`;", js)
        self.assertIn("playButton.textContent = shortVoiceLabel(sample.voice);", js)
        self.assertIn("playButton.title =", js)
        self.assertIn('selectButton.textContent = "선택";', js)
        self.assertNotIn("선택(Select)", js)
        self.assertNotIn("const sample = selectVoiceSample(voice, { shouldLog: false });", js)
        self.assertIn("ACTIVE_JOB_KEY", js)
        self.assertIn("THEME_KEY", js)
        self.assertIn("TEXT_SCALE_KEY", js)
        self.assertIn("applyTextScale", js)
        self.assertIn("initTextScale", js)
        self.assertIn('localStorage.getItem(TEXT_SCALE_KEY) || "115"', js)
        self.assertIn("--text-editor-font-size", js)
        self.assertIn("output.textContent = `${scale}%`", js)
        self.assertIn('addEventListener("input", () => applyTextScale', js)
        self.assertIn('const THEME_KEY = "supertonic3-local-tts-theme-v2";', js)
        self.assertIn('return theme === "dark" ? "dark" : "light";', js)
        self.assertIn('button.textContent = isLight ? "라이트(Light)" : "다크(Dark)";', js)
        self.assertIn("toggleTheme", js)
        self.assertIn("설정 ${slot}: 비어 있음", js)
        self.assertIn("프리셋 외 값(custom)", js)
        self.assertIn("initWheelGuards", js)
        self.assertIn("passive: false", js)
        self.assertIn("resumeLastGeneration", js)
        self.assertIn("refineCurrentOutput", js)
        self.assertIn("localStorage", js)
        css = (ROOT / "ui" / "style.css").read_text(encoding="utf-8")
        self.assertIn("Paperlogy", css)
        self.assertIn(":root[data-theme=\"light\"]", css)
        self.assertIn("/public/font/Paperlogy-4Regular.ttf", css)
        self.assertIn("font-weight: 800", css)
        self.assertIn("--card-shadow", css)
        self.assertIn("box-shadow: var(--card-shadow)", css)
        self.assertIn("box-shadow: var(--image-shadow)", css)
        self.assertIn(".topbar-main", css)
        self.assertIn("--text-editor-font-size: 16px", css)
        self.assertIn(".text-field-head", css)
        self.assertIn(".text-scale-control", css)
        self.assertIn('input[type="range"]', css)
        self.assertIn(".text-scale-control output", css)
        self.assertIn("font-size: var(--text-editor-font-size)", css)
        self.assertIn(".header-utility-row", css)
        self.assertIn(".header-preset-row", css)
        self.assertIn(".header-preset-title", css)
        self.assertIn(".header-preset-controls", css)
        self.assertIn("grid-template-columns: repeat(4, 108px)", css)
        self.assertIn("grid-template-columns: minmax(116px, 1fr) repeat(3, auto)", css)
        self.assertIn("voice-sample-control", css)
        self.assertIn("grid-template-columns: minmax(0, 2fr) minmax(72px, 1fr)", css)
        self.assertIn(".script-panel[hidden]", css)
        self.assertIn("display: none !important", css)
        self.assertIn(".visually-hidden", css)
        self.assertIn(".custom-script-card-panel", css)
        self.assertIn(".custom-script-compact-head", css)
        self.assertIn(".custom-script-toolbar-line", css)
        self.assertIn(".custom-sort-button", css)
        self.assertIn(".custom-script-search", css)
        self.assertIn(".custom-script-cards", css)
        self.assertIn(".custom-script-card", css)
        self.assertIn(".custom-script-card-line", css)
        self.assertIn(".custom-script-card.is-long-name", css)
        self.assertIn(".custom-script-card.is-active", css)
        self.assertIn(".custom-reload-button", css)
        self.assertIn("flex-wrap: wrap", css)
        self.assertIn("overflow: visible", css)
        self.assertIn("grid-template-columns: repeat(3, minmax(0, 1fr))", css)
        self.assertIn("grid-template-columns: repeat(4, minmax(0, 1fr))", css)
        self.assertIn(".script-panel-stack", css)
        self.assertIn(".script-path-guide", css)
        self.assertIn("--path-guide-bg: #241f12", css)
        self.assertIn("--path-guide-bg: #fff1c9", css)
        self.assertIn("--path-guide-border", css)
        self.assertIn("border-left-width: 8px", css)
        self.assertIn("background: var(--path-guide-bg)", css)
        self.assertIn("background: var(--path-guide-card-bg)", css)
        self.assertIn("margin-top: 12px", css)
        self.assertIn("font-size: 11px", css)
        self.assertIn("overflow-wrap: anywhere", css)
        self.assertIn("min-height: 68px", css)
        self.assertIn("padding: 18px 20px", css)
        self.assertIn(".sticky-toolbox", css)
        self.assertIn(".affiliation-notice", css)
        self.assertIn("position: fixed", css)
        self.assertIn("left: 50%", css)
        self.assertIn("bottom: 12px", css)
        self.assertIn("width: min(1680px, calc(100vw - 12px))", css)
        self.assertIn("grid-template-columns: minmax(0, 1fr) minmax(220px, 0.2fr)", css)
        self.assertIn("grid-template-columns: minmax(330px, 0.34fr) minmax(0, 1fr)", css)
        self.assertIn("transform: translateX(-50%)", css)
        self.assertIn("max-height: 28vh", css)
        self.assertIn(".sticky-toolbox .voice-sample-grid", css)
        self.assertIn("grid-template-columns: repeat(5, minmax(0, 1fr))", css)
        self.assertIn("width: min(100%, 390px)", css)
        self.assertIn("height: 34px", css)
        self.assertIn("max-height: 34px", css)
        self.assertIn("minmax(50px, 0.58fr)", css)
        self.assertIn("min-width: 50px", css)
        self.assertIn("text-overflow: clip", css)
        self.assertIn("line-height: 1.42", css)
        self.assertIn("data-locked-input", css)
        self.assertIn("--zone-composer-bg", css)
        self.assertIn("--zone-output-bg", css)
        self.assertIn("--zone-reference-bg", css)
        self.assertIn("border-left-width: 8px", css)
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("대본 요청함 로직", readme)
        self.assertIn("https://github.com/supertone-inc/supertonic", readme)
        self.assertIn("https://github.com/SYSTRAN/faster-whisper", readme)
        self.assertIn("https://min-inter.co.kr/youtube-curator-danbi/columns/supertonic3-free-local-tts-zip-guide", readme)
        self.assertIn("http://127.0.0.1:3093/license-notices", readme)
        self.assertIn("data/script_requests/latest.json", readme)
        self.assertIn("최신 대본 요청 처리해줘", readme)
        self.assertIn("<throatclear>", readme)
        self.assertIn("LICENSE_NOTICES.txt", readme)
        self.assertIn("scripts/create_release_zip.py", readme)

        root_readme = (ROOT.parent / "README.md").read_text(encoding="utf-8")
        self.assertIn("https://min-inter.co.kr/youtube-curator-danbi/columns/supertonic3-free-local-tts-zip-guide", root_readme)
        self.assertIn("http://127.0.0.1:3093/license-notices", root_readme)

        notices = (ROOT.parent / "LICENSE_NOTICES.txt").read_text(encoding="utf-8")
        self.assertIn("Supertonic GitHub example code", notices)
        self.assertIn("BigScience Open RAIL-M", notices)
        self.assertIn("Copyright (c) 2025 Supertone Inc.", notices)
        self.assertIn("Copyright (c) 2026 Supertone Inc.", notices)
        self.assertIn("Copyright (c) 2023 SYSTRAN", notices)
        self.assertIn("무료로 실행할 수 있다는 사실과 공개 콘텐츠에 자유롭게 사용할 수 있다는 사실은 별개입니다.", notices)
        self.assertIn("This ZIP does not bundle FFmpeg binaries", notices)
        self.assertIn("Gyan FFmpeg builds: GPLv3", notices)
        self.assertIn("https://huggingface.co/Supertone/supertonic-3/blob/main/LICENSE", notices)
        self.assertIn("https://min-inter.co.kr/youtube-curator-danbi/columns/supertonic3-free-local-tts-zip-guide", notices)
        self.assertIn("http://127.0.0.1:3093/license-notices", notices)


if __name__ == "__main__":
    unittest.main()
