# Phases 1–3 Results

Status: complete for the local-first application boundary  
Date: 2026-08-23

## Phase 1 — contracts, shell, and bridge

- Added a versioned protocol-v1 schema and retained the bounded 64 KiB JSONL transport.
- Added a typed `DesktopBridge` with separate browser/mock and Tauri implementations.
- The Tauri host resolves the engine from packaged resources or the reproducible development build, owns its process, and supports explicit restart after exit.
- Added native dialog, Finder reveal, and single-instance plugins with narrow capabilities.
- Settings are validated through typed DTOs and atomically persisted in the macOS app config directory.
- Browser preview retains the approved mock experience; the packaged app uses the real bridge.

## Phase 2 — local intake and metadata

- Native file selection and Tauri drag/drop accept exactly one MP3, WAV, FLAC, AIFF/AIF, or M4A source.
- The engine canonicalizes the path, verifies a regular readable file, enforces size/duration limits, probes the actual audio stream, extracts title/artist/duration/codec properties, and computes lightweight waveform peaks with FFmpeg.
- Unsupported, corrupt, missing, non-file, oversized, and probe/decode failures use stable engine codes.
- Source inspection is read-only; a fixture test verifies the source hash is unchanged.

## Phase 3 — job lifecycle foundation

- Added a one-active-job manager with monotonic sequence/progress events, one terminal outcome, cancellation, temporary owned workspaces, cleanup, and snapshot recovery context.
- React restores a processing view from the engine snapshot after remount and does not depend only on transient events.
- Fake processing exercises local/YouTube stage plans while real processing is introduced in Phases 4–6.

## Validation

- Python engine suite: 11 tests passed, including protocol bounds, inspection, source immutability, monotonic progress, single-job enforcement, cancellation, and terminal uniqueness.
- TypeScript typecheck and ESLint pass; six existing Fast Refresh warnings remain non-blocking.
- Rust formatting and locked dependency check pass.
- Static desktop production build passes.

## Carried forward

- Real export and atomic destination publication: Phase 4.
- Real YouTube metadata/download: Phase 5.
- Real Demucs separation: Phase 6.
- Path grants and final error/recovery hardening remain explicit Phase 8 security work before completion.
