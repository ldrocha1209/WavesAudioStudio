from __future__ import annotations

import shutil
import tempfile
import unittest
import wave
from pathlib import Path
from unittest.mock import patch

from waves_engine.downloader import _options, cached_source, inspect_url, prepare_preview, validate_youtube_url
from waves_engine.errors import WavesEngineError


class FakeYoutubeDL:
    def __init__(self, options: dict[str, object]) -> None:
        self.options = options

    def __enter__(self) -> "FakeYoutubeDL":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def extract_info(self, url: str, download: bool) -> dict[str, object]:
        if download:
            raise AssertionError("metadata inspection must not download")
        return {"id": "abc123", "title": "Fixture", "channel": "Waves Tests", "duration": 42, "thumbnail": "https://example.invalid/art.jpg"}


class DownloaderTests(unittest.TestCase):
    def test_youtube_output_cannot_pollute_json_protocol(self) -> None:
        options = _options()
        self.assertTrue(options["quiet"])
        self.assertTrue(options["noprogress"])
        logger = options["logger"]
        for method_name in ("debug", "info", "warning", "error"):
            self.assertTrue(callable(getattr(logger, method_name)))

    def test_playlist_is_rejected(self) -> None:
        with self.assertRaises(WavesEngineError) as raised:
            validate_youtube_url("https://youtube.com/watch?v=abc123&list=playlist")
        self.assertEqual(raised.exception.code, "PLAYLIST_UNSUPPORTED")

    def test_non_youtube_url_is_rejected(self) -> None:
        with self.assertRaises(WavesEngineError):
            validate_youtube_url("https://example.com/watch?v=abc123")

    @patch("yt_dlp.YoutubeDL", FakeYoutubeDL)
    def test_metadata_is_safely_mapped(self) -> None:
        result = inspect_url("https://youtube.com/watch?v=abc123")
        self.assertEqual(result["title"], "Fixture")
        self.assertEqual(result["sourceKind"], "youtube")
        self.assertEqual(result["duration"], 42.0)

    @unittest.skipUnless(shutil.which("ffmpeg"), "FFmpeg required")
    def test_preview_is_mp3_and_processing_source_stays_unchanged(self) -> None:
        with tempfile.TemporaryDirectory() as raw_directory:
            video_id = "preview-fixture"
            directory = Path(raw_directory, "waves-audio-previews", video_id)
            directory.mkdir(parents=True)
            source = directory / "source.wav"
            with wave.open(str(source), "wb") as output:
                output.setnchannels(2)
                output.setsampwidth(2)
                output.setframerate(8_000)
                output.writeframes(b"\x00\x00\x00\x00" * 8_000)
            with patch("waves_engine.downloader.tempfile.gettempdir", return_value=raw_directory):
                preview = prepare_preview("https://youtube.com/watch?v=fixture", video_id)
                self.assertEqual(preview.name, "preview.mp3")
                self.assertGreater(preview.stat().st_size, 0)
                self.assertEqual(cached_source(video_id), source)


if __name__ == "__main__":
    unittest.main()
