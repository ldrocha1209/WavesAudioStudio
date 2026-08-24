from __future__ import annotations

import argparse
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

from waves_engine.separation import STEMS, separate_audio


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Waves Demucs smoke test")
    parser.add_argument("source", type=Path)
    parser.add_argument("--device", default="CPU only")
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="waves-separation-smoke-") as directory:
        paths, device = separate_audio(args.source.resolve(strict=True), Path(directory), args.device, lambda: False, lambda _value: None)
        audio = {name: sf.read(paths[name], dtype="float32", always_2d=True)[0] for name in STEMS}
        instrumental = sf.read(paths["instrumental"], dtype="float32", always_2d=True)[0]
        difference = float(np.max(np.abs(instrumental - (audio["drums"] + audio["bass"] + audio["other"]))))
        if difference > 1e-6:
            raise RuntimeError(f"Instrumental reconstruction mismatch: {difference}")
        print(f"Separated {len(audio)} stems on {device}; instrumental max difference {difference}")


if __name__ == "__main__":
    main()
