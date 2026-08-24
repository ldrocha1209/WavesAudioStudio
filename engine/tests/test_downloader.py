from __future__ import annotations

import unittest
from unittest.mock import patch

from waves_engine.downloader import inspect_url, validate_youtube_url
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


if __name__ == "__main__":
    unittest.main()
