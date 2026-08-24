# Phases 4–5 Results

Status: implementation complete; validation recorded at checkpoint 3  
Date: 2026-08-23

## Phase 4 — FFmpeg export

- Local `Original` requests export through fixed argument arrays with no shell invocation.
- WAV uses 24-bit PCM, FLAC uses lossless compression, and MP3 supports 320/256/192 kbps.
- The pipeline retains the source format until the one required final encode; it never creates a lossy intermediate.
- Destinations are created intentionally, filenames are sanitized and length-bounded, existing files are never overwritten, and concurrent-safe reservation produces `Name (1)` variants.
- FFmpeg writes to a unique hidden staging path and only atomically replaces the reserved final path after a successful exit.
- Cancellation terminates the owned FFmpeg process group and removes staging/reservation files.
- Local build tooling copies the selected `ffmpeg`, `ffprobe`, and Node binaries into the packaged engine resource tree.

## Phase 5 — YouTube

- URL admission permits one YouTube video and rejects non-YouTube hosts, missing video IDs, and playlist query parameters.
- Pinned yt-dlp performs metadata-only inspection and maps bounded title/channel/duration/thumbnail fields.
- Processing requests best available audio into the private job workspace with playlist expansion disabled, bounded retries, explicit FFmpeg and Node runtime locations, numeric progress hooks, and cancellation checks.
- YouTube `Original` continues through the same Phase 4 final export without loading Demucs.
- Deterministic tests mock yt-dlp. Live smoke results are recorded separately because public extractor behavior is volatile.

## Validation

- Engine suite covers the complete WAV/FLAC/MP3 bitrate matrix, collision naming, path sanitization, source immutability, URL admission, playlist rejection, and mocked metadata mapping.
- No test depends on public network availability.
- The quarantined live smoke command successfully inspected and downloaded YouTube video `jNQXAC9IVRw` through Waves' adapter on 2026-08-23 with the explicit Node runtime and no playlist expansion.
