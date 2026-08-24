from __future__ import annotations

import time
import unittest

from waves_engine.errors import WavesEngineError
from waves_engine.jobs import JobManager


class JobManagerTests(unittest.TestCase):
    def test_job_progress_is_monotonic_and_terminal_is_unique(self) -> None:
        events: list[dict[str, object]] = []
        manager = JobManager(events.append)
        manager.start_demo("job-1", ["convert", "export"], {"track": {"id": "track-1"}})
        deadline = time.monotonic() + 3
        while manager.snapshot()["active"] is not None and time.monotonic() < deadline:
            time.sleep(0.01)
        progress = [float(event["overallProgress"]) for event in events if event["type"] == "job_progress"]
        self.assertEqual(progress, sorted(progress))
        terminals = [event for event in events if event["type"] in {"job_completed", "job_cancelled", "job_failed"}]
        self.assertEqual(len(terminals), 1)

    def test_one_active_job_and_idempotent_cleanup(self) -> None:
        events: list[dict[str, object]] = []
        manager = JobManager(events.append)
        manager.start_demo("job-1", ["convert"])
        with self.assertRaises(WavesEngineError) as raised:
            manager.start_demo("job-2", ["convert"])
        self.assertEqual(raised.exception.code, "JOB_ACTIVE")
        manager.cancel("job-1")
        deadline = time.monotonic() + 3
        while manager.snapshot()["active"] is not None and time.monotonic() < deadline:
            time.sleep(0.01)
        self.assertIsNone(manager.snapshot()["active"])


if __name__ == "__main__":
    unittest.main()
