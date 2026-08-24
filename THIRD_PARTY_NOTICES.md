# Third-Party Notices

Waves combines open-source software. The lockfiles are the authoritative version inventory for a particular source checkout.

## Major runtime components

- Tauri 2, Rust crates, React, TanStack, Radix UI, and related JavaScript packages: see `src-tauri/Cargo.lock`, `package-lock.json`, and `bun.lock` for exact versions and their upstream licenses.
- Python 3.11 and Python packages including PyInstaller, yt-dlp, yt-dlp-ejs, Requests, NumPy, SoundFile, PyTorch 2.2.2, Torchaudio 2.2.2, and Demucs 4.0.1: see `engine/requirements-lock.txt`.
- `htdemucs` model weights, pinned by SHA-256 in `docs/PHASE_0_RESULTS.md`.
- Node.js is copied from the local development installation for yt-dlp JavaScript challenge support.
- FFmpeg/FFprobe 8.0 are copied from the owner's local Homebrew installation.

## FFmpeg distribution note

The currently selected Homebrew FFmpeg build is GPL-enabled and dynamically linked. It is acceptable for the owner's private local build, but it makes a standalone public GitHub binary release non-trivial: required libraries, corresponding license/source obligations, architecture compatibility, and macOS signing would need a separate distribution review. For that reason v1.0 publishes source and reproducible personal build instructions, not a downloadable binary.

Waves does not claim ownership of third-party names, code, models, or media. Retain the upstream license files and notices when redistributing any bundle.
