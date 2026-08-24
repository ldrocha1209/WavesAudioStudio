# Phases 6–9 Results

Status: complete; full frozen and packaged engine validation passed
Date: 2026-08-23

## Phase 6 — Demucs separation

- A dedicated spawn-based worker lazily imports Torch/Demucs, loads pinned `htdemucs`, decodes to the model's stereo/sample-rate contract, and performs one four-source inference per job.
- Vocals, Drums, Bass, Other, and All Stems map from model-declared source names. Instrumental is the float-precision sum of drums+bass+other.
- The supervisor can terminate and reap the worker during model loading or inference; cancelled jobs do not publish partial outputs.
- Stems remain float WAV inside the private workspace and pass through the shared final encoder exactly once.

## Phase 7 — device policy

- CPU-only is deterministic and is the validated path for the owner's Intel Mac.
- Automatic selects MPS only when the installed Torch build and runtime both report support; otherwise it safely uses CPU.
- GPU preference falls back to CPU on this machine. No Apple Silicon performance claim is made without that hardware.

## Phase 8 — hardening

- Rust creates opaque source/destination grants from native dialogs and drop events. The engine receives canonical paths only after Rust resolves a valid grant.
- The WebView may send only a fixed allowlist of protocol message types and remains unable to launch arbitrary commands.
- Engine and heavy workers run in owned process groups. Window shutdown sends bounded termination followed by a hard kill/reap if required.
- Job progress is monotonic, terminal outcomes are unique, raw errors stay out of normal UI copy, and output publication remains atomic/no-overwrite.
- YouTube thumbnails are backend-fetched only from approved HTTPS image hosts with type, timeout, and size limits.

## Phase 9 — preview and output workflow

- Native source/destination selection, persisted defaults, Finder reveal, and completion rows use real records.
- Local sources and generated outputs use HTML audio backed by Tauri's local asset protocol, with play/pause/seek and single-active-preview behavior.
- Audio elements are paused, detached, and released on reset/unmount.

## Validation

- The engine suite includes Demucs worker cancellation and deterministic CPU selection.
- A real 3-second CPU `htdemucs` smoke separation produced all four stems; Instrumental matched drums+bass+other with maximum absolute difference `0.0`.
- The full frozen on-directory engine completed a real CPU Instrumental job through its JSONL protocol and published a validated WAV output.
- Strict TypeScript, ESLint, Rust formatting/check/tests, and desktop production build pass.

## Honest limits

- Preview asset scope is limited to the current user's home and temporary directories because outputs may be placed anywhere under the user's home. The app exposes no arbitrary path picker outside Rust grants.
- MPS and Apple Silicon remain unverified optional acceleration.
