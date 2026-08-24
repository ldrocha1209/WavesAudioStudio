from __future__ import annotations

import tempfile
import time
import unittest
import wave
from pathlib import Path

from waves_engine.errors import WavesEngineError
from waves_engine.separation import choose_device, separate_audio


class SeparationPolicyTests(unittest.TestCase):
    def test_cpu_policy_is_deterministic(self) -> None:
        self.assertEqual(choose_device("CPU only"), "cpu")

    def test_worker_can_be_cancelled_during_model_load(self) -> None:
        with tempfile.TemporaryDirectory() as raw_directory:
            directory = Path(raw_directory)
            source = directory / "source.wav"
            with wave.open(str(source), "wb") as output:
                output.setnchannels(2)
                output.setsampwidth(2)
                output.setframerate(8_000)
                output.writeframes(b"\x00\x00\x00\x00" * 8_000)
            started = time.monotonic()
            with self.assertRaises(WavesEngineError) as raised:
                separate_audio(source, directory, "CPU only", lambda: time.monotonic() - started > 0.5, lambda _value: None)
            self.assertEqual(raised.exception.code, "CANCELLED")
            self.assertLess(time.monotonic() - started, 8)


if __name__ == "__main__":
    unittest.main()
