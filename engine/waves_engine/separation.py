from __future__ import annotations

import multiprocessing
import os
import queue
import sys
import time
from pathlib import Path
from typing import Any, Callable

from .errors import WavesEngineError
from .media import resolve_tool

STEMS = ("drums", "bass", "other", "vocals")
MODEL_NAME = "htdemucs"


def choose_device(policy: str) -> str:
    if policy == "CPU only":
        return "cpu"
    try:
        import torch

        if policy in {"Automatic", "GPU"} and torch.backends.mps.is_built() and torch.backends.mps.is_available():
            return "mps"
    except (ImportError, RuntimeError):
        pass
    return "cpu"


def _worker(source: str, output_dir: str, device: str, tool_dir: str, result_queue: Any) -> None:
    try:
        os.environ["PATH"] = tool_dir + os.pathsep + os.environ.get("PATH", "")
        import soundfile as sf
        import torch
        from demucs.apply import apply_model
        from demucs.audio import AudioFile
        from demucs.pretrained import get_model

        model = get_model(MODEL_NAME)
        model.to(device)
        model.eval()
        wav = AudioFile(Path(source)).read(streams=0, samplerate=model.samplerate, channels=model.audio_channels)
        ref = wav.mean(0)
        mean = ref.mean()
        std = ref.std().clamp_min(1e-8)
        normalized = (wav - mean) / std
        with torch.inference_mode():
            separated = apply_model(model, normalized[None], device=device, shifts=1, split=True, overlap=0.25, progress=False, num_workers=0)[0]
        separated = separated * std + mean
        paths: dict[str, str] = {}
        output = Path(output_dir)
        output.mkdir(parents=True, exist_ok=True)
        by_name = {name: separated[index].detach().cpu().numpy().T for index, name in enumerate(model.sources)}
        for name in STEMS:
            path = output / f"{name}.wav"
            sf.write(path, by_name[name], model.samplerate, subtype="FLOAT")
            paths[name] = os.fspath(path)
        instrumental = by_name["drums"] + by_name["bass"] + by_name["other"]
        instrumental_path = output / "instrumental.wav"
        sf.write(instrumental_path, instrumental, model.samplerate, subtype="FLOAT")
        paths["instrumental"] = os.fspath(instrumental_path)
        result_queue.put({"ok": True, "paths": paths, "device": device})
    except BaseException as exc:
        result_queue.put({"ok": False, "error": type(exc).__name__, "detail": str(exc)[:500]})


def separate_audio(source: Path, workspace: Path, policy: str, cancelled: Callable[[], bool], progress: Callable[[float], None]) -> tuple[dict[str, Path], str]:
    packaged_models = Path(sys.executable).resolve().parent / "models"
    development_models = Path(__file__).resolve().parents[1] / ".model-cache"
    if packaged_models.is_dir():
        os.environ["TORCH_HOME"] = os.fspath(packaged_models)
    elif development_models.is_dir():
        os.environ["TORCH_HOME"] = os.fspath(development_models)
    device = choose_device(policy)
    context = multiprocessing.get_context("spawn")
    results = context.Queue(maxsize=1)
    process = context.Process(target=_worker, args=(os.fspath(source), os.fspath(workspace / "stems"), device, os.fspath(Path(resolve_tool("ffmpeg")).parent), results), daemon=True)
    process.start()
    started = time.monotonic()
    progress(0.01)
    try:
        while process.is_alive():
            if cancelled():
                process.terminate()
                process.join(timeout=5)
                if process.is_alive():
                    process.kill()
                    process.join(timeout=5)
                raise WavesEngineError("CANCELLED")
            elapsed = time.monotonic() - started
            progress(min(0.92, 0.05 + elapsed / (elapsed + 45)))
            process.join(timeout=0.5)
        try:
            result = results.get(timeout=2)
        except queue.Empty as exc:
            raise WavesEngineError("MODEL_WORKER_CRASHED") from exc
        if not result.get("ok"):
            raise WavesEngineError("SEPARATION_FAILED", f"{result.get('error')}: {result.get('detail')}")
        progress(1.0)
        return {name: Path(path) for name, path in result["paths"].items()}, str(result["device"])
    finally:
        if process.is_alive():
            process.kill()
        process.join(timeout=2)
        results.close()
