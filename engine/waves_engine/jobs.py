from __future__ import annotations

import tempfile
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from .errors import WavesEngineError


@dataclass
class Job:
    id: str
    state: str = "created"
    seq: int = 0
    stage: str | None = None
    progress: float = 0.0
    cancel: threading.Event = field(default_factory=threading.Event)
    workspace: Path | None = None
    context: dict[str, Any] = field(default_factory=dict)


class JobManager:
    def __init__(self, emit: Callable[[dict[str, Any]], None]) -> None:
        self._emit = emit
        self._lock = threading.Lock()
        self._active: Job | None = None

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            job = self._active
            if job is None:
                return {"active": None}
            return {
                "active": {
                    "jobId": job.id,
                    "state": job.state,
                    "seq": job.seq,
                    "stage": job.stage,
                    "progress": job.progress,
                    "context": job.context,
                }
            }

    def start_demo(self, job_id: str, stages: list[str], context: dict[str, Any] | None = None) -> None:
        if not job_id or len(job_id) > 128 or not stages:
            raise WavesEngineError("INVALID_JOB")
        with self._lock:
            if self._active is not None:
                raise WavesEngineError("JOB_ACTIVE")
            job = Job(job_id, state="running", context=context or {})
            self._active = job
        threading.Thread(target=self._run_demo, args=(job, stages), daemon=True).start()

    def cancel(self, job_id: str) -> None:
        with self._lock:
            if self._active is None or self._active.id != job_id:
                raise WavesEngineError("JOB_NOT_FOUND")
            self._active.state = "cancelling"
            self._active.cancel.set()

    def _event(self, job: Job, event_type: str, **payload: Any) -> None:
        job.seq += 1
        self._emit({"type": event_type, "jobId": job.id, "seq": job.seq, **payload})

    def _run_demo(self, job: Job, stages: list[str]) -> None:
        try:
            with tempfile.TemporaryDirectory(prefix=f"waves-{job.id}-") as workspace:
                job.workspace = Path(workspace)
                self._event(job, "job_started", stages=stages)
                for stage_index, stage in enumerate(stages):
                    job.stage = stage
                    for step in range(1, 11):
                        if job.cancel.wait(0.025):
                            job.state = "cancelled"
                            self._event(job, "job_cancelled")
                            return
                        stage_progress = step / 10
                        job.progress = (stage_index + stage_progress) / len(stages)
                        self._event(
                            job,
                            "job_progress",
                            stage=stage,
                            stageProgress=stage_progress,
                            overallProgress=job.progress,
                        )
                job.state = "completed"
                self._event(job, "job_completed", outputs=[])
        finally:
            with self._lock:
                if self._active is job:
                    self._active = None
