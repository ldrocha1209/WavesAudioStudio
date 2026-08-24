# Portability and GitHub Distribution

Waves v1.0.1 targets the owner's Intel Mac running macOS 14 or newer. The architecture keeps React, Rust host integration, and Python processing separated, but no Windows or Apple Silicon release claim is made.

## GitHub

GitHub contains the full source, pinned dependency inventories, phase evidence, and reproducible local build commands. A prebuilt GitHub Release is intentionally not published for v1.0 because the current artifact is approximately 1 GB before DMG compression, Intel-only, ad-hoc signed, dynamically linked to the owner's Homebrew FFmpeg libraries, and carries GPL distribution obligations. That is not an “easy download” experience yet.

## Future Apple Silicon build

Build Python, Torch, FFmpeg, Node, Rust, and Tauri natively for arm64; validate MPS against CPU; freeze the full engine; and repeat the packaged separation, cancellation, signing, and local launch checks. Do not label the current x64 artifact universal.

## Future Windows port

Keep the JSONL/domain contract. Replace macOS dialog/reveal behavior, Unix process groups, asset scopes, paths, and packaging with Windows adapters; use Job Objects for descendant termination; select Windows FFmpeg and CPU/CUDA artifacts; and test reserved filenames, locking, antivirus, and signing behavior. Windows work is outside the personal v1.0 completion scope.
