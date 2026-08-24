from __future__ import annotations

import os
import re
import signal
import subprocess
import uuid
from pathlib import Path
from typing import Any, Callable

from .downloader import cached_preview, download_audio
from .errors import WavesEngineError
from .media import resolve_tool
from .separation import separate_audio

Progress = Callable[[str, float, float], None]
OUTPUT_ORDER = ("original", "vocals", "instrumental", "drums", "bass", "other")


def safe_name(value: str) -> str:
    cleaned = re.sub(r"[\x00-\x1f/\\:]", " ", value)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .")
    return (cleaned or "Waves Track")[:120]


def reserve_output(directory: Path, base: str, suffix: str) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    for index in range(10_000):
        name = f"{base}{f' ({index})' if index else ''}{suffix}"
        candidate = directory / name
        try:
            descriptor = os.open(candidate, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            os.close(descriptor)
            return candidate
        except FileExistsError:
            continue
    raise WavesEngineError("OUTPUT_COLLISION_LIMIT")


def _encoding_args(format_name: str, quality: str) -> tuple[str, list[str]]:
    if format_name == "WAV":
        return ".wav", ["-c:a", "pcm_s24le"]
    if format_name == "FLAC":
        return ".flac", ["-c:a", "flac", "-compression_level", "8"]
    if format_name == "MP3" and quality in {"320 kbps", "256 kbps", "192 kbps"}:
        return ".mp3", ["-c:a", "libmp3lame", "-b:a", f"{quality.split()[0]}k"]
    raise WavesEngineError("EXPORT_SETTINGS_INVALID")


def export_audio(
    source: Path,
    destination: Path,
    title: str,
    format_name: str,
    quality: str,
    duration: float,
    cancelled: Callable[[], bool],
    progress: Callable[[float], None],
) -> Path:
    suffix, encoding = _encoding_args(format_name, quality)
    final = reserve_output(destination.expanduser(), safe_name(title), suffix)
    staging = final.with_name(f".{final.stem}.waves-{uuid.uuid4().hex}{suffix}")
    command = [resolve_tool("ffmpeg"), "-nostdin", "-v", "error", "-i", os.fspath(source), "-map", "0:a:0", "-vn", *encoding, "-progress", "pipe:1", "-nostats", os.fspath(staging)]
    try:
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, start_new_session=True)
        assert process.stdout is not None
        for line in process.stdout:
            if cancelled():
                os.killpg(process.pid, signal.SIGTERM)
                try: process.wait(timeout=3)
                except subprocess.TimeoutExpired: os.killpg(process.pid, signal.SIGKILL)
                raise WavesEngineError("CANCELLED")
            if line.startswith("out_time_ms=") and duration > 0:
                progress(min(0.99, float(line.split("=", 1)[1]) / 1_000_000 / duration))
        stderr = process.stderr.read() if process.stderr else ""
        if process.wait() != 0:
            raise WavesEngineError("FFMPEG_FAILED", stderr)
        os.replace(staging, final)
        progress(1.0)
        return final
    except Exception:
        staging.unlink(missing_ok=True)
        final.unlink(missing_ok=True)
        raise
    finally:
        if "process" in locals():
            if process.stdout:
                process.stdout.close()
            if process.stderr:
                process.stderr.close()


def _selection(context: dict[str, Any]) -> list[str]:
    raw = context.get("selection")
    if not isinstance(raw, list) or not raw or any(not isinstance(item, str) or item not in OUTPUT_ORDER for item in raw):
        raise WavesEngineError("OUTPUT_SELECTION_INVALID")
    if len(set(raw)) != len(raw):
        raise WavesEngineError("OUTPUT_SELECTION_INVALID")
    return [name for name in OUTPUT_ORDER if name in raw]


def run_pipeline(context: dict[str, Any], workspace: Path, cancelled: Callable[[], bool], emit: Progress) -> list[dict[str, Any]]:
    track = context["track"]
    export = context["export"]
    selection = _selection(context)
    requested_stems = [name for name in selection if name != "original"]
    source_kind = track.get("sourceKind")
    if source_kind == "youtube":
        source = cached_preview(str(track.get("id") or ""))
        download_weight = 0.0 if source else (0.2 if requested_stems else 1 / 3)
        if source is None:
            source = download_audio(str(track.get("sourceUrl") or track.get("source", "").removeprefix("YouTube · ")), workspace, cancelled, lambda value: emit("download", value, value * download_weight))
    elif source_kind == "file":
        download_weight = 0.0
        source = Path(str(track.get("sourcePath") or track.get("path") or "")).resolve(strict=True)
    else:
        raise WavesEngineError("SOURCE_INVALID")
    destination = Path(str(export["location"]))
    labels = {"vocals": "Vocals", "instrumental": "Instrumental", "drums": "Drums", "bass": "Bass", "other": "Other"}
    outputs: list[dict[str, Any]] = []

    if not requested_stems:
        conversion_weight = 2 / 3 if source_kind == "youtube" else 0.9
        output = export_audio(source, destination, str(track["title"]), str(export["format"]), str(export["quality"]), float(track["duration"]), cancelled, lambda value: emit("convert", value, download_weight + value * conversion_weight))
        emit("export", 1.0, 1.0)
        size = output.stat().st_size
        return [{"id": "original", "label": "Original", "filename": output.name, "size": f"{size / 1024**2:.1f} MB", "path": os.fspath(output), "peaks": track.get("peaks") or [0.06] * 220}]

    convert_end = download_weight + (0.12 if "original" in selection else 0.05)
    if "original" in selection:
        original = export_audio(source, destination, str(track["title"]), str(export["format"]), str(export["quality"]), float(track["duration"]), cancelled, lambda value: emit("convert", value, download_weight + value * (convert_end - download_weight)))
        size = original.stat().st_size
        outputs.append({"id": "original", "label": "Original", "filename": original.name, "size": f"{size / 1024**2:.1f} MB", "path": os.fspath(original), "peaks": track.get("peaks") or [0.06] * 220})
    else:
        emit("convert", 1.0, convert_end)

    separation_end = 0.78
    separated, _device = separate_audio(source, workspace, str(context.get("devicePolicy") or "Automatic"), cancelled, lambda value: emit("separate", value, convert_end + value * (separation_end - convert_end)))
    for index, name in enumerate(requested_stems):
        output = export_audio(separated[name], destination, f"{track['title']} — {labels[name]}", str(export["format"]), str(export["quality"]), float(track["duration"]), cancelled, lambda value, index=index: emit("export", (index + value) / len(requested_stems), separation_end + (1 - separation_end) * (index + value) / len(requested_stems)))
        size = output.stat().st_size
        outputs.append({"id": name, "label": labels[name], "filename": output.name, "size": f"{size / 1024**2:.1f} MB", "path": os.fspath(output), "peaks": track.get("peaks") or [0.06] * 220})
    return outputs
