from __future__ import annotations

import array
import hashlib
import json
import math
import os
import shutil
import stat
import subprocess
from pathlib import Path
from typing import Any

from .errors import WavesEngineError

SUPPORTED_EXTENSIONS = {".mp3", ".wav", ".flac", ".aiff", ".aif", ".m4a"}
MAX_SOURCE_BYTES = 20 * 1024**3
MAX_DURATION_SECONDS = 6 * 60 * 60


def resolve_tool(name: str) -> str:
    configured = os.environ.get(f"WAVES_{name.upper()}")
    if configured and Path(configured).is_file():
        return configured
    located = shutil.which(name)
    if located:
        return located
    raise WavesEngineError(f"{name.upper()}_MISSING")


def _run(args: list[str], timeout: int = 30) -> subprocess.CompletedProcess[bytes]:
    try:
        return subprocess.run(args, check=False, capture_output=True, timeout=timeout)
    except subprocess.TimeoutExpired as exc:
        raise WavesEngineError("SOURCE_PROBE_TIMEOUT") from exc


def _peaks(path: Path, duration: float, count: int = 220) -> list[float]:
    ffmpeg = resolve_tool("ffmpeg")
    sample_rate = max(20, math.ceil(count / max(duration, 1)))
    result = _run(
        [
            ffmpeg,
            "-v",
            "error",
            "-i",
            os.fspath(path),
            "-map",
            "0:a:0",
            "-ac",
            "1",
            "-ar",
            str(sample_rate),
            "-f",
            "f32le",
            "pipe:1",
        ],
        timeout=60,
    )
    if result.returncode != 0:
        raise WavesEngineError("SOURCE_DECODE_FAILED", result.stderr.decode(errors="replace"))
    samples = array.array("f")
    samples.frombytes(result.stdout[: len(result.stdout) - (len(result.stdout) % 4)])
    if not samples:
        return [0.06] * count
    bucket = max(1, math.ceil(len(samples) / count))
    values = [max(abs(value) for value in samples[i : i + bucket]) for i in range(0, len(samples), bucket)]
    peak = max(values) or 1.0
    normalized = [max(0.04, min(1.0, value / peak)) for value in values[:count]]
    return normalized + [0.04] * (count - len(normalized))


def inspect_file(raw_path: str) -> dict[str, Any]:
    try:
        path = Path(raw_path).expanduser().resolve(strict=True)
        info = path.stat()
    except OSError as exc:
        raise WavesEngineError("SOURCE_UNREADABLE", str(exc)) from exc
    if not stat.S_ISREG(info.st_mode):
        raise WavesEngineError("SOURCE_NOT_FILE")
    if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        raise WavesEngineError("SOURCE_UNSUPPORTED")
    if info.st_size > MAX_SOURCE_BYTES:
        raise WavesEngineError("SOURCE_TOO_LARGE")

    result = _run(
        [
            resolve_tool("ffprobe"),
            "-v",
            "error",
            "-show_entries",
            "format=duration,format_name:format_tags=title,artist,album_artist:stream=index,codec_type,codec_name,sample_rate,channels",
            "-of",
            "json",
            os.fspath(path),
        ]
    )
    if result.returncode != 0:
        raise WavesEngineError("SOURCE_CORRUPT", result.stderr.decode(errors="replace"))
    try:
        probe = json.loads(result.stdout)
        audio = next(stream for stream in probe.get("streams", []) if stream.get("codec_type") == "audio")
        duration = float(probe["format"]["duration"])
    except (KeyError, StopIteration, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise WavesEngineError("SOURCE_UNSUPPORTED") from exc
    if not 0 < duration <= MAX_DURATION_SECONDS:
        raise WavesEngineError("SOURCE_DURATION_UNSUPPORTED")
    tags = probe.get("format", {}).get("tags", {})
    title = str(tags.get("title") or path.stem)
    artist = str(tags.get("artist") or tags.get("album_artist") or "Local audio")
    return {
        "id": hashlib.sha256(os.fspath(path).encode()).hexdigest()[:16],
        "title": title[:200],
        "artist": artist[:200],
        "duration": duration,
        "source": f"Local file · {path.name}",
        "sourceKind": "file",
        "path": os.fspath(path),
        "sizeBytes": info.st_size,
        "codec": audio.get("codec_name"),
        "sampleRate": int(audio["sample_rate"]) if audio.get("sample_rate") else None,
        "channels": audio.get("channels"),
        "peaks": _peaks(path, duration),
    }
