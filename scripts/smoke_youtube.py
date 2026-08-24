from __future__ import annotations

import argparse

from waves_engine.downloader import cached_preview, inspect_url, prepare_preview


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the optional live Waves YouTube smoke test")
    parser.add_argument("url")
    args = parser.parse_args()
    metadata = inspect_url(args.url)
    output = prepare_preview(args.url, str(metadata["id"]))
    if cached_preview(str(metadata["id"])) != output:
        raise SystemExit("preview cache lookup did not return the downloaded audio")
    print(f"Prepared playable preview for {metadata['title']!r}: {output.stat().st_size} bytes")


if __name__ == "__main__":
    main()
