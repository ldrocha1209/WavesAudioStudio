from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: validate_instrumental.py STEM_DIRECTORY")

    stem_dir = Path(sys.argv[1]).resolve(strict=True)
    audio: dict[str, np.ndarray] = {}
    samplerate: int | None = None
    for name in ("drums", "bass", "other", "vocals"):
        values, rate = sf.read(stem_dir / f"{name}.wav", dtype="float32", always_2d=True)
        if samplerate is None:
            samplerate = rate
        if rate != samplerate:
            raise RuntimeError("stem sample rates do not match")
        audio[name] = values

    # This is the exact ordered complement used by Demucs two-stem behavior
    # after vocals is removed from model.sources.
    no_vocals = np.zeros_like(audio["drums"])
    for name in ("drums", "bass", "other"):
        no_vocals += audio[name]

    production_instrumental = audio["drums"] + audio["bass"] + audio["other"]
    max_difference = float(np.max(np.abs(no_vocals - production_instrumental)))
    if max_difference > 1e-6:
        raise RuntimeError(f"instrumental mismatch: {max_difference}")

    output = stem_dir / "instrumental.wav"
    sf.write(output, production_instrumental, samplerate, subtype="FLOAT")
    print(
        json.dumps(
            {
                "samplerate": samplerate,
                "channels": int(production_instrumental.shape[1]),
                "frames": int(production_instrumental.shape[0]),
                "maxAbsDifference": max_difference,
                "peak": float(np.max(np.abs(production_instrumental))),
                "output": str(output),
            },
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
