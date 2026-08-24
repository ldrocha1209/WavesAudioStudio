from __future__ import annotations

import argparse
import tempfile
from pathlib import Path

from waves_engine.downloader import download_audio, inspect_url


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the optional live Waves YouTube smoke test")
    parser.add_argument("url")
    args = parser.parse_args()
    metadata = inspect_url(args.url)
    with tempfile.TemporaryDirectory(prefix="waves-youtube-smoke-") as directory:
        output = download_audio(args.url, Path(directory), lambda: False, lambda _value: None)
        print(f"Downloaded {metadata['title']!r}: {output.stat().st_size} bytes")


if __name__ == "__main__":
    main()
