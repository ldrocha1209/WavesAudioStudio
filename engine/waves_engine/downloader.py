from __future__ import annotations

import hashlib
import os
import tempfile
from pathlib import Path
from typing import Any, Callable
from urllib.parse import parse_qs, urlparse

from .errors import WavesEngineError
from .media import resolve_tool

YOUTUBE_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "music.youtube.com"}


def validate_youtube_url(raw_url: str) -> str:
    try:
        parsed = urlparse(raw_url.strip())
    except ValueError as exc:
        raise WavesEngineError("URL_INVALID") from exc
    if parsed.scheme not in {"http", "https"} or parsed.hostname not in YOUTUBE_HOSTS:
        raise WavesEngineError("URL_INVALID")
    query = parse_qs(parsed.query)
    if "list" in query:
        raise WavesEngineError("PLAYLIST_UNSUPPORTED")
    video_id = parsed.path.strip("/") if parsed.hostname == "youtu.be" else query.get("v", [""])[0]
    if not video_id:
        raise WavesEngineError("URL_INVALID")
    return raw_url.strip()


def _options() -> dict[str, Any]:
    return {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "extract_flat": False,
        "socket_timeout": 30,
        "retries": 2,
        "fragment_retries": 2,
        "js_runtimes": {"node": {"path": resolve_tool("node")}},
    }


def inspect_url(raw_url: str) -> dict[str, Any]:
    url = validate_youtube_url(raw_url)
    try:
        import yt_dlp

        with yt_dlp.YoutubeDL(_options()) as downloader:
            info = downloader.extract_info(url, download=False)
    except WavesEngineError:
        raise
    except Exception as exc:
        raise WavesEngineError("URL_UNAVAILABLE", str(exc)) from exc
    if not isinstance(info, dict) or info.get("_type") == "playlist" or info.get("entries"):
        raise WavesEngineError("PLAYLIST_UNSUPPORTED")
    duration = float(info.get("duration") or 0)
    if duration <= 0:
        raise WavesEngineError("VIDEO_UNSUPPORTED")
    video_id = str(info.get("id") or hashlib.sha256(url.encode()).hexdigest()[:16])
    thumbnail_path = _cache_thumbnail(str(info.get("thumbnail") or ""), video_id)
    return {
        "id": video_id[:64],
        "title": str(info.get("title") or "YouTube audio")[:200],
        "artist": str(info.get("channel") or info.get("uploader") or "YouTube")[:200],
        "duration": duration,
        "source": f"YouTube · {url}",
        "sourceKind": "youtube",
        "sourceUrl": url,
        "artworkUrl": info.get("thumbnail"),
        "thumbnailPath": os.fspath(thumbnail_path) if thumbnail_path else None,
        "peaks": [],
    }


def _cache_thumbnail(raw_url: str, video_id: str) -> Path | None:
    if not raw_url:
        return None
    parsed = urlparse(raw_url)
    host = parsed.hostname or ""
    if parsed.scheme != "https" or not any(host == suffix or host.endswith(f".{suffix}") for suffix in ("ytimg.com", "ggpht.com", "googleusercontent.com")):
        return None
    try:
        import requests

        response = requests.get(raw_url, timeout=15, stream=True)
        response.raise_for_status()
        if not response.headers.get("content-type", "").lower().startswith("image/"):
            return None
        directory = Path(tempfile.gettempdir(), "waves-thumbnails")
        directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        destination = directory / f"{safe_thumbnail_id(video_id)}.jpg"
        total = 0
        with destination.open("wb") as output:
            for chunk in response.iter_content(64 * 1024):
                total += len(chunk)
                if total > 5 * 1024 * 1024:
                    raise WavesEngineError("THUMBNAIL_TOO_LARGE")
                output.write(chunk)
        return destination
    except Exception:
        return None


def safe_thumbnail_id(value: str) -> str:
    return "".join(character for character in value if character.isalnum() or character in "_-")[:64] or "youtube"


def download_audio(
    raw_url: str,
    workspace: Path,
    cancelled: Callable[[], bool],
    progress: Callable[[float], None],
) -> Path:
    url = validate_youtube_url(raw_url)

    class CancelledDownload(Exception):
        pass

    def hook(data: dict[str, Any]) -> None:
        if cancelled():
            raise CancelledDownload()
        if data.get("status") == "downloading":
            downloaded = float(data.get("downloaded_bytes") or 0)
            total = float(data.get("total_bytes") or data.get("total_bytes_estimate") or 0)
            if total > 0:
                progress(min(0.99, downloaded / total))

    options = {
        **_options(),
        "format": "bestaudio/best",
        "outtmpl": os.fspath(workspace / "source.%(ext)s"),
        "progress_hooks": [hook],
        "ffmpeg_location": os.fspath(Path(resolve_tool("ffmpeg")).parent),
        "nopart": False,
    }
    try:
        import yt_dlp

        with yt_dlp.YoutubeDL(options) as downloader:
            downloader.download([url])
    except CancelledDownload as exc:
        raise WavesEngineError("CANCELLED") from exc
    except Exception as exc:
        if cancelled():
            raise WavesEngineError("CANCELLED") from exc
        raise WavesEngineError("DOWNLOAD_FAILED", str(exc)) from exc
    candidates = [path for path in workspace.glob("source.*") if path.suffix not in {".part", ".ytdl"}]
    if len(candidates) != 1:
        raise WavesEngineError("DOWNLOAD_OUTPUT_MISSING")
    progress(1.0)
    return candidates[0]
