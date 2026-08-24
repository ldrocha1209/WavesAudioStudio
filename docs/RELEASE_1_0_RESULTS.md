# Waves v1.0.1 Local Release Results

Status: complete for the owner-approved local-only scope

Date: 2026-08-24

Target: Intel x64 macOS 14+ on the owner's Mac

## v1.0.1 correction pass

- Second-screen local playback now receives the canonical source path instead of advancing a silent simulated timer.
- YouTube intake prepares a local cached audio preview before showing the second screen, and processing reuses that cache instead of downloading the track again.
- The unused Appearance setting was removed. Older settings files remain readable and are rewritten without the obsolete field.
- Settings can select and persist a custom default output folder. The per-export override remains separate, and both native folder dialogs run outside the UI thread.
- Clicking the shaded area outside Settings or pressing Escape closes the panel.
- Original is independent and may accompany any custom stem combination. All 5 Stems replaces custom stem choices while preserving Original, and exports Vocals, Instrumental, Drums, Bass, and Other from one Demucs inference.

## Phase 10 — reliability gate

- All 21 deterministic Python tests pass, covering protocol bounds/versioning, engine process behavior, monotonic and terminal job invariants, media inspection and source immutability, export formats/collision naming, YouTube URL/playlist handling, multi-output selection and validation, one-inference stem mapping, CPU policy, and cancellation during model load.
- Strict TypeScript checking, the production desktop build, Rust compilation/tests, and ESLint pass. ESLint reports six non-blocking Fast Refresh warnings in pre-existing shared UI component files and no errors.
- A real permitted single-video YouTube smoke test prepared a playable cached audio file with the bundled Node runtime and retrieved that same file through the cache lookup.
- A real 3-second CPU `htdemucs` run produced all four native sources. Instrumental equaled drums+bass+other with maximum absolute difference `0.0`.
- `npm audit --omit=dev` reports zero vulnerabilities, `pip check` reports no broken requirements, and a repository secret-pattern scan found no matches.
- Recovery and dependency-update guidance is in [Troubleshooting](./TROUBLESHOOTING.md). Privacy and major runtime licensing are recorded in [Privacy](../PRIVACY.md) and [Third-Party Notices](../THIRD_PARTY_NOTICES.md).

Public CI, Apple Silicon/MPS benchmarks, exhaustive soak/visual/accessibility automation, Developer ID checks, notarization, and clean-machine public-distribution testing are not part of the personal local release target.

## Phase 11 — local package gate

- Version metadata is aligned at `1.0.1` across npm, Cargo, Tauri, and the Python engine.
- PyInstaller produced the full on-directory Python/Torch/Demucs/yt-dlp engine with the pinned `htdemucs` cache, FFmpeg, FFprobe, and Node resources.
- The frozen engine and the exact engine copied inside the signed `.app` each completed a real CPU six-output job through protocol v1: Original plus all five separated outputs.
- Tauri produced an ad-hoc-signed `.app` and `.dmg`. `codesign --verify --deep --strict` passed and `hdiutil verify` reported a valid image.
- The packaged v1 application launched as a native macOS process and closed cleanly after verification.
- The installed `.app` is approximately 1.4 GB; the DMG is approximately 467 MB.
- DMG SHA-256: `bad3de3705e267cb81c49d82483864310610c87c40835b4ff443ab849db4e6e9`.

Local artifact paths (generated, not tracked):

```text
src-tauri/target/release/bundle/macos/Waves.app
src-tauri/target/release/bundle/dmg/Waves_1.0.1_x64.dmg
```

## Phase 12 — portability and GitHub decision

- Platform-neutral domain and JSONL protocol boundaries remain separate from macOS dialogs, Finder reveal, Unix process groups, asset paths, and Tauri packaging.
- [Portability and GitHub Distribution](./PORTABILITY.md) records the Apple Silicon and Windows work without claiming support.
- GitHub receives source, pinned manifests, documentation, and reproducible local build instructions.
- No prebuilt GitHub binary is published for v1.0.1. The artifact is Intel-only, ad-hoc signed, very large, and its Homebrew FFmpeg build is dynamically linked and GPL-enabled. Shipping it as an easy public download would require dependency bundling, architecture/signing work, and a separate compliance review.
- No portfolio action was taken. Publishing Waves to the portfolio remains subject to explicit owner approval.

## Final local validation commands

```bash
npm run check
npm run engine:freeze
npm run smoke:frozen -- engine/dist/waves-engine-onedir/waves-engine engine/phase0-fixtures/synthetic.wav
npm run tauri:build
codesign --verify --deep --strict src-tauri/target/release/bundle/macos/Waves.app
hdiutil verify src-tauri/target/release/bundle/dmg/Waves_1.0.1_x64.dmg
```
