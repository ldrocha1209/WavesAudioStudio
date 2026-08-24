import json
import os
import queue
import subprocess
import sys
import threading
import time
import unittest


class EngineProcessTests(unittest.TestCase):
    def setUp(self):
        env = {**os.environ, "PYTHONPATH": os.path.dirname(os.path.dirname(__file__))}
        self.process = subprocess.Popen(
            [sys.executable, "-m", "waves_engine"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env,
        )
        self.events = queue.Queue()
        assert self.process.stdout
        self.reader = threading.Thread(
            target=lambda: [self.events.put(line) for line in self.process.stdout],
            daemon=True,
        )
        self.reader.start()
        self.assertEqual(self.read()["type"], "engine_ready")

    def tearDown(self):
        if self.process.poll() is None:
            self.process.terminate()
            self.process.wait(timeout=5)
        for stream in (self.process.stdin, self.process.stdout, self.process.stderr):
            if stream:
                stream.close()

    def send(self, message):
        assert self.process.stdin
        self.process.stdin.write(json.dumps({"protocol": 1, **message}) + "\n")
        self.process.stdin.flush()

    def read(self, timeout=3):
        try:
            line = self.events.get(timeout=timeout)
        except queue.Empty:
            self.fail("engine did not emit an event in time")
        return json.loads(line)

    def test_ping(self):
        self.send({"type": "ping", "requestId": "r-ping"})
        self.assertEqual(
            self.read(),
            {"protocol": 1, "type": "pong", "requestId": "r-ping"},
        )

    def test_demo_progress_completes_once(self):
        self.send(
            {
                "type": "run_demo",
                "requestId": "r-demo",
                "payload": {"jobId": "j-demo", "steps": 3, "delayMs": 5},
            }
        )
        events = [self.read() for _ in range(5)]
        self.assertEqual(events[0]["type"], "job_started")
        self.assertEqual([event["seq"] for event in events[1:4]], [1, 2, 3])
        self.assertEqual(events[-1]["type"], "job_completed")

    def test_demo_can_be_cancelled(self):
        self.send(
            {
                "type": "run_demo",
                "requestId": "r-demo",
                "payload": {"jobId": "j-cancel", "steps": 50, "delayMs": 20},
            }
        )
        self.assertEqual(self.read()["type"], "job_started")
        self.send(
            {"type": "cancel", "requestId": "r-cancel", "payload": {"jobId": "j-cancel"}}
        )
        terminal = []
        deadline = time.monotonic() + 3
        while time.monotonic() < deadline and not terminal:
            event = self.read()
            if event["type"] in {"job_completed", "job_cancelled"}:
                terminal.append(event["type"])
        self.assertEqual(terminal, ["job_cancelled"])


if __name__ == "__main__":
    unittest.main()
