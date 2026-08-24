from __future__ import annotations

import http.server
import os
import signal
import socketserver
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path


def terminate_group(process: subprocess.Popen[bytes], timeout: float = 5) -> None:
    group = os.getpgid(process.pid)
    os.killpg(group, signal.SIGTERM)
    try:
        process.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        os.killpg(group, signal.SIGKILL)
        process.wait(timeout=timeout)
    if process.poll() is None:
        raise RuntimeError("process did not terminate")
    try:
        os.killpg(group, 0)
    except ProcessLookupError:
        return
    raise RuntimeError("process group still exists after cancellation")


def test_ffmpeg(ffmpeg: str) -> None:
    with tempfile.TemporaryDirectory(prefix="waves-ffmpeg-cancel-") as directory:
        output = Path(directory) / "partial.wav"
        process = subprocess.Popen(
            [
                ffmpeg,
                "-hide_banner",
                "-loglevel",
                "error",
                "-re",
                "-f",
                "lavfi",
                "-i",
                "sine=frequency=440:duration=60",
                "-y",
                os.fspath(output),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        time.sleep(0.5)
        terminate_group(process)
        output.unlink(missing_ok=True)


def test_demucs(engine_root: Path, fixture: Path, torch_home: Path) -> None:
    output = engine_root / ".phase0-cancel-output"
    env = {**os.environ, "TORCH_HOME": os.fspath(torch_home)}
    process = subprocess.Popen(
        [
            os.fspath(engine_root / ".venv/bin/python"),
            "-m",
            "demucs.separate",
            "-n",
            "htdemucs",
            "-d",
            "cpu",
            "--segment",
            "2",
            "-o",
            os.fspath(output),
            os.fspath(fixture),
        ],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    time.sleep(2)
    terminate_group(process)
    if output.exists():
        import shutil

        shutil.rmtree(output)


class SlowFileHandler(http.server.SimpleHTTPRequestHandler):
    source: Path

    def log_message(self, _format: str, *args: object) -> None:
        return

    def do_GET(self) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", str(self.source.stat().st_size))
        self.end_headers()
        with self.source.open("rb") as source:
            while block := source.read(16 * 1024):
                try:
                    self.wfile.write(block)
                    self.wfile.flush()
                except (BrokenPipeError, ConnectionResetError):
                    break
                time.sleep(0.01)


def test_ytdlp(engine_root: Path, fixture: Path) -> None:
    from yt_dlp import YoutubeDL
    from yt_dlp.utils import DownloadCancelled

    SlowFileHandler.source = fixture
    with socketserver.TCPServer(("127.0.0.1", 0), SlowFileHandler) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        with tempfile.TemporaryDirectory(prefix="waves-ytdlp-cancel-") as directory:
            def cancel_on_progress(status: dict[str, object]) -> None:
                if status.get("status") == "downloading":
                    raise DownloadCancelled("phase0 cancellation")

            options = {
                "outtmpl": os.fspath(Path(directory) / "download.%(ext)s"),
                "progress_hooks": [cancel_on_progress],
                "quiet": True,
                "noplaylist": True,
            }
            try:
                with YoutubeDL(options) as downloader:
                    downloader.download([f"http://127.0.0.1:{server.server_address[1]}/fixture.wav"])
            except DownloadCancelled:
                pass
            leftovers = [path for path in Path(directory).iterdir() if path.suffix != ".part"]
            if leftovers:
                raise RuntimeError(f"yt-dlp cancellation published files: {leftovers}")
        server.shutdown()


def main() -> None:
    project_root = Path(__file__).resolve().parents[1]
    engine_root = project_root / "engine"
    fixture = engine_root / "phase0-fixtures/synthetic.wav"
    ffmpeg = os.environ.get("WAVES_FFMPEG", "/usr/local/bin/ffmpeg")
    test_ffmpeg(ffmpeg)
    test_ytdlp(engine_root, fixture)
    test_demucs(engine_root, fixture, engine_root / ".model-cache")
    print("ffmpeg=cancelled yt-dlp=cancelled demucs=cancelled process-groups=clean")


if __name__ == "__main__":
    main()
