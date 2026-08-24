from __future__ import annotations

import hashlib
import shutil
import tempfile
import unittest
import wave
from pathlib import Path

from waves_engine.errors import WavesEngineError
from waves_engine.media import inspect_file


@unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "FFmpeg tools required")
class MediaInspectionTests(unittest.TestCase):
    def test_wav_metadata_and_source_immutability(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory, "Tone.wav")
            with wave.open(str(path), "wb") as output:
                output.setnchannels(1)
                output.setsampwidth(2)
                output.setframerate(8_000)
                output.writeframes(b"\x00\x00" * 8_000)
            before = hashlib.sha256(path.read_bytes()).digest()
            result = inspect_file(str(path))
            after = hashlib.sha256(path.read_bytes()).digest()
            self.assertEqual(result["title"], "Tone")
            self.assertAlmostEqual(result["duration"], 1.0, places=2)
            self.assertEqual(len(result["peaks"]), 220)
            self.assertEqual(before, after)

    def test_unsupported_extension_is_rejected(self) -> None:
        with tempfile.NamedTemporaryFile(suffix=".txt") as source:
            with self.assertRaises(WavesEngineError) as raised:
                inspect_file(source.name)
        self.assertEqual(raised.exception.code, "SOURCE_UNSUPPORTED")


if __name__ == "__main__":
    unittest.main()
