from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify YouTube preview generation through a frozen Waves engine")
    parser.add_argument("engine", type=Path)
    parser.add_argument("url")
    args = parser.parse_args()
    process = subprocess.Popen(
        [args.engine.resolve(strict=True)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    assert process.stdin is not None and process.stdout is not None
    try:
        ready = json.loads(process.stdout.readline())
        if ready.get("engineVersion") != "1.0.2":
            raise RuntimeError(f"Unexpected engine handshake: {ready}")
        request = {
            "protocol": 1,
            "type": "inspect_url",
            "requestId": "frozen-youtube-preview",
            "payload": {"url": args.url},
        }
        process.stdin.write(json.dumps(request, separators=(",", ":")) + "\n")
        process.stdin.flush()
        response = json.loads(process.stdout.readline())
        track = response.get("track") if response.get("type") == "source_inspected" else None
        preview = Path(str(track.get("sourcePath"))) if isinstance(track, dict) else None
        if preview is None or preview.suffix != ".mp3" or not preview.is_file():
            raise RuntimeError(f"Frozen engine did not return a playable MP3 preview: {response}")
        sources = [path for path in preview.parent.glob("source.*") if path.is_file()]
        if len(sources) != 1 or sources[0] == preview:
            raise RuntimeError(f"Frozen engine did not retain a distinct processing source: {sources}")
        print(f"Frozen YouTube preview passed: {preview.name}; processing source: {sources[0].name}")
    finally:
        if process.poll() is None:
            process.stdin.write('{"protocol":1,"type":"shutdown","requestId":"smoke-stop"}\n')
            process.stdin.flush()
            try:
                process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                process.terminate()
                process.wait(timeout=5)


if __name__ == "__main__":
    main()
