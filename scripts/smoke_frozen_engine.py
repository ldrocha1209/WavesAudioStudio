from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
import time
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Exercise a real separation through the frozen Waves engine")
    parser.add_argument("engine", type=Path)
    parser.add_argument("source", type=Path)
    args = parser.parse_args()
    engine = args.engine.resolve(strict=True)
    source = args.source.resolve(strict=True)
    with tempfile.TemporaryDirectory(prefix="waves-frozen-smoke-") as destination:
        process = subprocess.Popen([engine], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        assert process.stdin is not None and process.stdout is not None
        ready = json.loads(process.stdout.readline())
        if ready.get("type") != "engine_ready":
            raise RuntimeError(f"Engine did not become ready: {ready}")
        if ready.get("engineVersion") != "1.0.0":
            raise RuntimeError(f"Unexpected frozen engine version: {ready.get('engineVersion')}")
        request = {"protocol": 1, "type": "start_job", "requestId": "smoke-start", "payload": {"jobId": "frozen-smoke", "track": {"id": "fixture", "title": "Frozen Smoke", "artist": "Waves", "duration": 3, "source": "fixture", "sourceKind": "file", "sourcePath": str(source), "peaks": [0.5]}, "stem": "instrumental", "export": {"format": "WAV", "quality": "Highest", "location": destination}, "devicePolicy": "CPU only"}}
        process.stdin.write(json.dumps(request, separators=(",", ":")) + "\n")
        process.stdin.flush()
        deadline = time.monotonic() + 240
        terminal: dict[str, object] | None = None
        while time.monotonic() < deadline:
            event = json.loads(process.stdout.readline())
            if event.get("type") in {"job_completed", "job_failed", "job_cancelled"}:
                terminal = event
                break
        if terminal is None or terminal.get("type") != "job_completed":
            diagnostics = process.stderr.read() if process.poll() is not None and process.stderr else ""
            raise RuntimeError(f"Frozen job failed: {terminal}; {diagnostics}")
        outputs = terminal.get("outputs")
        if not isinstance(outputs, list) or len(outputs) != 1 or not Path(str(outputs[0]["path"])).is_file():
            raise RuntimeError(f"Frozen job returned invalid outputs: {outputs}")
        process.stdin.write('{"protocol":1,"type":"shutdown","requestId":"smoke-stop"}\n')
        process.stdin.flush()
        process.wait(timeout=15)
        print(f"Frozen engine separation passed: {outputs[0]['filename']}")


if __name__ == "__main__":
    main()
