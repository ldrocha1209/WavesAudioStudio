from __future__ import annotations

import shutil
import tempfile
import unittest
import wave
from pathlib import Path
from unittest.mock import patch

from waves_engine.errors import WavesEngineError
from waves_engine.pipeline import run_pipeline, safe_name


@unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "FFmpeg tools required")
class ExportPipelineTests(unittest.TestCase):
    def make_source(self, directory: Path) -> Path:
        path = directory / "source.wav"
        with wave.open(str(path), "wb") as output:
            output.setnchannels(2)
            output.setsampwidth(2)
            output.setframerate(8_000)
            output.writeframes(b"\x00\x00\x00\x00" * 8_000)
        return path

    def test_export_matrix_and_collision_naming(self) -> None:
        with tempfile.TemporaryDirectory() as raw_directory:
            directory = Path(raw_directory)
            source = self.make_source(directory)
            for format_name, quality, suffix in (("WAV", "Highest", ".wav"), ("FLAC", "Highest", ".flac"), ("MP3", "320 kbps", ".mp3"), ("MP3", "256 kbps", ".mp3"), ("MP3", "192 kbps", ".mp3")):
                destination = directory / f"out-{format_name}-{quality}"
                context = {"track": {"sourceKind": "file", "sourcePath": str(source), "title": "A/B: Track", "duration": 1, "peaks": [0.5]}, "selection": ["original"], "export": {"location": str(destination), "format": format_name, "quality": quality}}
                first = run_pipeline(context, directory / "workspace", lambda: False, lambda *_args: None)[0]
                second = run_pipeline(context, directory / "workspace", lambda: False, lambda *_args: None)[0]
                self.assertTrue(Path(first["path"]).is_file())
                self.assertTrue(str(first["filename"]).endswith(suffix))
                self.assertIn("(1)", str(second["filename"]))

    def test_filename_sanitization(self) -> None:
        self.assertEqual(safe_name("  ../A:B\\C  "), "A B C")

    def test_empty_and_duplicate_output_selections_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as raw_directory:
            directory = Path(raw_directory)
            source = self.make_source(directory)
            base = {"track": {"sourceKind": "file", "sourcePath": str(source), "title": "Track", "duration": 1}, "export": {"location": str(directory), "format": "WAV", "quality": "Highest"}}
            for selection in ([], ["vocals", "vocals"], ["unknown"]):
                with self.subTest(selection=selection), self.assertRaises(WavesEngineError) as raised:
                    run_pipeline({**base, "selection": selection}, directory, lambda: False, lambda *_args: None)
                self.assertEqual(raised.exception.code, "OUTPUT_SELECTION_INVALID")

    def test_all_stems_uses_one_inference_and_publishes_all_five_outputs(self) -> None:
        with tempfile.TemporaryDirectory() as raw_directory:
            directory = Path(raw_directory)
            source = self.make_source(directory)
            stems = {name: source for name in ("vocals", "instrumental", "drums", "bass", "other")}
            exported: list[Path] = []

            def fake_export(*_args: object, **_kwargs: object) -> Path:
                path = directory / f"output-{len(exported)}.wav"
                path.write_bytes(b"fixture")
                exported.append(path)
                return path

            context = {"track": {"sourceKind": "file", "sourcePath": str(source), "title": "Track", "duration": 1, "peaks": [0.5]}, "selection": ["vocals", "instrumental", "drums", "bass", "other"], "devicePolicy": "CPU only", "export": {"location": str(directory), "format": "WAV", "quality": "Highest"}}
            with patch("waves_engine.pipeline.separate_audio", return_value=(stems, "cpu")) as separate, patch("waves_engine.pipeline.export_audio", side_effect=fake_export):
                outputs = run_pipeline(context, directory, lambda: False, lambda *_args: None)
            separate.assert_called_once()
            self.assertEqual([output["id"] for output in outputs], ["vocals", "instrumental", "drums", "bass", "other"])

    def test_original_and_custom_stems_share_one_job_and_one_inference(self) -> None:
        with tempfile.TemporaryDirectory() as raw_directory:
            directory = Path(raw_directory)
            source = self.make_source(directory)
            stems = {name: source for name in ("vocals", "instrumental", "drums", "bass", "other")}
            exported: list[Path] = []

            def fake_export(*_args: object, **_kwargs: object) -> Path:
                path = directory / f"custom-output-{len(exported)}.wav"
                path.write_bytes(b"fixture")
                exported.append(path)
                return path

            context = {"track": {"sourceKind": "file", "sourcePath": str(source), "title": "Track", "duration": 1, "peaks": [0.5]}, "selection": ["original", "vocals", "drums"], "devicePolicy": "CPU only", "export": {"location": str(directory), "format": "WAV", "quality": "Highest"}}
            with patch("waves_engine.pipeline.separate_audio", return_value=(stems, "cpu")) as separate, patch("waves_engine.pipeline.export_audio", side_effect=fake_export):
                outputs = run_pipeline(context, directory, lambda: False, lambda *_args: None)
            separate.assert_called_once()
            self.assertEqual([output["id"] for output in outputs], ["original", "vocals", "drums"])


if __name__ == "__main__":
    unittest.main()
