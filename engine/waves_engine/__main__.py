from __future__ import annotations

import os
import platform
import shutil
import subprocess
import sys
import threading
import time
import traceback
from pathlib import Path
from typing import Any

from . import ENGINE_VERSION
from .errors import WavesEngineError
from .jobs import JobManager
from .media import inspect_file
from .protocol import ProtocolError, Request, parse_request, write_message


class Engine:
    def __init__(self) -> None:
        self._write_lock = threading.Lock()
        self._jobs_lock = threading.Lock()
        self._jobs: dict[str, threading.Event] = {}
        self.job_manager = JobManager(self.emit)

    def emit(self, message: dict[str, Any]) -> None:
        with self._write_lock:
            write_message(sys.stdout, message)

    def error(self, request_id: str | None, code: str, detail: str | None = None) -> None:
        error: dict[str, Any] = {"code": code}
        if detail:
            error["detail"] = detail[:500]
        self.emit({"type": "error", "requestId": request_id, "error": error})

    def handle(self, request: Request) -> None:
        handlers = {
            "ping": self._ping,
            "inspect_tools": self._inspect_tools,
            "run_demo": self._run_demo,
            "cancel": self._cancel,
            "probe_media": self._probe_media,
            "inspect_file": self._inspect_file,
            "inspect_url": self._inspect_url,
            "start_job": self._start_job,
            "job_snapshot": self._job_snapshot,
            "capabilities": self._capabilities,
            "shutdown": self._shutdown,
        }
        handler = handlers.get(request.type)
        if handler is None:
            self.error(request.request_id, "UNKNOWN_REQUEST")
            return
        handler(request)

    def _ping(self, request: Request) -> None:
        self.emit({"type": "pong", "requestId": request.request_id})

    def _inspect_tools(self, request: Request) -> None:
        self.emit(
            {
                "type": "tools",
                "requestId": request.request_id,
                "tools": {"ffmpeg": shutil.which("ffmpeg"), "ffprobe": shutil.which("ffprobe")},
            }
        )

    def _run_demo(self, request: Request) -> None:
        job_id = request.payload.get("jobId")
        steps = request.payload.get("steps", 10)
        delay_ms = request.payload.get("delayMs", 50)
        if not isinstance(job_id, str) or not job_id or len(job_id) > 128:
            self.error(request.request_id, "INVALID_JOB")
            return
        if not isinstance(steps, int) or not 1 <= steps <= 1000:
            self.error(request.request_id, "INVALID_STEPS")
            return
        if not isinstance(delay_ms, int) or not 1 <= delay_ms <= 10_000:
            self.error(request.request_id, "INVALID_DELAY")
            return

        token = threading.Event()
        with self._jobs_lock:
            if job_id in self._jobs:
                self.error(request.request_id, "JOB_EXISTS")
                return
            self._jobs[job_id] = token

        threading.Thread(
            target=self._demo_worker,
            args=(request.request_id, job_id, steps, delay_ms, token),
            daemon=True,
        ).start()

    def _demo_worker(
        self,
        request_id: str,
        job_id: str,
        steps: int,
        delay_ms: int,
        token: threading.Event,
    ) -> None:
        self.emit({"type": "job_started", "requestId": request_id, "jobId": job_id})
        terminal = "completed"
        try:
            for step in range(steps):
                if token.wait(delay_ms / 1000):
                    terminal = "cancelled"
                    break
                self.emit(
                    {
                        "type": "job_progress",
                        "jobId": job_id,
                        "seq": step + 1,
                        "stage": "proof",
                        "progress": (step + 1) / steps,
                    }
                )
        finally:
            with self._jobs_lock:
                self._jobs.pop(job_id, None)
            self.emit({"type": f"job_{terminal}", "jobId": job_id})

    def _cancel(self, request: Request) -> None:
        job_id = request.payload.get("jobId")
        try:
            if isinstance(job_id, str) and self.job_manager.snapshot()["active"] is not None:
                self.job_manager.cancel(job_id)
                self.emit({"type": "cancel_accepted", "requestId": request.request_id, "jobId": job_id})
                return
        except WavesEngineError as exc:
            self.error(request.request_id, exc.code, exc.detail)
            return
        with self._jobs_lock:
            token = self._jobs.get(job_id) if isinstance(job_id, str) else None
        if token is None:
            self.error(request.request_id, "JOB_NOT_FOUND")
            return
        token.set()
        self.emit({"type": "cancel_accepted", "requestId": request.request_id, "jobId": job_id})

    def _inspect_file(self, request: Request) -> None:
        raw_path = request.payload.get("path")
        if not isinstance(raw_path, str) or not raw_path:
            self.error(request.request_id, "INVALID_PATH")
            return
        try:
            track = inspect_file(raw_path)
        except WavesEngineError as exc:
            self.error(request.request_id, exc.code, exc.detail)
            return
        self.emit({"type": "source_inspected", "requestId": request.request_id, "track": track})

    def _inspect_url(self, request: Request) -> None:
        self.error(request.request_id, "URL_PIPELINE_NOT_READY")

    def _start_job(self, request: Request) -> None:
        job_id = request.payload.get("jobId")
        track = request.payload.get("track")
        stem = request.payload.get("stem")
        if not isinstance(job_id, str) or not isinstance(track, dict) or not isinstance(stem, str):
            self.error(request.request_id, "INVALID_JOB")
            return
        source_kind = track.get("sourceKind")
        stages = (["download"] if source_kind == "youtube" else []) + ["convert"]
        if stem != "original":
            stages.append("separate")
        stages.append("export")
        try:
            self.job_manager.start_demo(job_id, stages, request.payload)
        except WavesEngineError as exc:
            self.error(request.request_id, exc.code, exc.detail)
            return
        self.emit({"type": "job_accepted", "requestId": request.request_id, "jobId": job_id})

    def _job_snapshot(self, request: Request) -> None:
        self.emit({"type": "job_snapshot", "requestId": request.request_id, **self.job_manager.snapshot()})

    def _probe_media(self, request: Request) -> None:
        raw_path = request.payload.get("path")
        if not isinstance(raw_path, str) or not raw_path:
            self.error(request.request_id, "INVALID_PATH")
            return
        try:
            path = Path(raw_path).resolve(strict=True)
        except OSError as exc:
            self.error(request.request_id, "SOURCE_UNREADABLE", str(exc))
            return
        ffprobe = shutil.which("ffprobe")
        if not ffprobe:
            self.error(request.request_id, "FFPROBE_MISSING")
            return
        result = subprocess.run(
            [
                ffprobe,
                "-v",
                "error",
                "-show_entries",
                "format=duration,format_name",
                "-of",
                "json",
                os.fspath(path),
            ],
            check=False,
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0:
            self.error(request.request_id, "FFPROBE_FAILED", result.stderr)
            return
        self.emit(
            {"type": "media_probe", "requestId": request.request_id, "result": result.stdout.strip()}
        )

    def _capabilities(self, request: Request) -> None:
        capabilities: dict[str, Any] = {
            "python": platform.python_version(),
            "architecture": platform.machine(),
            "torch": False,
            "mpsBuilt": False,
            "mpsAvailable": False,
            "cudaAvailable": False,
        }
        try:
            import torch

            capabilities.update(
                {
                    "torch": torch.__version__,
                    "mpsBuilt": bool(torch.backends.mps.is_built()),
                    "mpsAvailable": bool(torch.backends.mps.is_available()),
                    "cudaAvailable": bool(torch.cuda.is_available()),
                }
            )
        except ImportError:
            pass
        self.emit({"type": "capabilities", "requestId": request.request_id, **capabilities})

    def _shutdown(self, request: Request) -> None:
        with self._jobs_lock:
            for token in self._jobs.values():
                token.set()
        self.emit({"type": "shutdown_accepted", "requestId": request.request_id})
        raise SystemExit(0)


def main() -> None:
    engine = Engine()
    engine.emit(
        {
            "type": "engine_ready",
            "engineVersion": ENGINE_VERSION,
            "python": platform.python_version(),
            "architecture": platform.machine(),
            "pid": os.getpid(),
        }
    )
    for raw_line in sys.stdin:
        line = raw_line.rstrip("\n")
        if not line:
            continue
        try:
            engine.handle(parse_request(line))
        except ProtocolError as exc:
            engine.error(None, "PROTOCOL_ERROR", str(exc))
        except SystemExit:
            return
        except Exception:
            traceback.print_exc(file=sys.stderr)
            engine.error(None, "ENGINE_INTERNAL")


if __name__ == "__main__":
    main()
