# Phase 0 Results

Status: **complete for the application-architecture decision on the available Mac**. Under the local-only scope adopted on 2026-08-23, public distribution and Apple Silicon validation are optional; full-engine packaging remains a later functional gate.

Date: 2026-08-20

## Decision summary

Proceed with Tauri 2, the approved React/TypeScript frontend, a Rust-owned Python processing process, and versioned JSON Lines over stdin/stdout. Package the Python engine as an on-directory runtime. Keep Torch and Demucs lazy and run interruptible media/AI work in child process groups.

The minimum supported macOS version for the first build is macOS 14. This proof ran on the owner's macOS 26.5.1 Intel Mac (x86_64, 16 GB RAM). It does not claim Apple Silicon or MPS validation.

## What was built

- A client-only desktop build that prerenders the existing TanStack Start screen into `dist/desktop`; no local web server is required at runtime.
- A minimal Tauri 2 host in `src-tauri/` that owns engine startup, stdin writes, stdout/stderr readers, status, and shutdown cleanup.
- A bounded protocol-v1 JSONL engine in `engine/waves_engine/` with ready/ping, ordered demo progress, cancellation, media probing, lazy capability detection, structured errors, and shutdown.
- PyInstaller one-file and on-directory experiments. The packaged app uses the on-directory result as a Tauri resource.
- Proof scripts for process-tree cancellation and Instrumental reconstruction.
- A locally ad-hoc-signed x86_64 `.app` and verified DMG.

No reference repository or `media/` file was modified. No production audio workflow was integrated into the frontend.

## Acceptance matrix

| Proof                                           | Result                   | Evidence / conclusion                                                                                                                                                                                                          |
| ----------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Approved UI in a packaged static build          | Pass                     | `npm run build:desktop`; Tauri app launched without Nitro or an HTTP server. Only a small engine-proof status was added to About.                                                                                              |
| Fixed packaged engine launch                    | Pass                     | The app host started `Contents/Resources/waves-engine-onedir/waves-engine` as its direct child.                                                                                                                                |
| Protocol/version handshake and ordered progress | Pass                     | Seven engine tests cover ready/ping, malformed and oversized frames, ordered progress, and cancellation.                                                                                                                       |
| Engine shutdown ownership                       | Pass                     | Closing the host left no `waves-engine` process. Rust marks EOF as stopped and clears the child slot so a later start is possible.                                                                                             |
| Engine crash/restart user flow                  | Partial                  | Crash state and a clean subsequent start are supported by the proof boundary, but automatic recovery policy and a packaged UI-driven crash test belong in Phase 1. Jobs must never be silently retried.                        |
| FFmpeg decode/export pipeline                   | Pass on development tool | Source Opus/WebM was decoded once to WAV, FLAC, and 320/256/192 kbps MP3. Exact redistributable FFmpeg binaries are still a distribution gate.                                                                                 |
| yt-dlp metadata and single-audio download       | Pass                     | Metadata and best-audio download succeeded for the permitted short smoke source. An older official test URL was unavailable, confirming extractor tests must not rely on a single live URL.                                    |
| CPU Demucs inference                            | Pass                     | Real `htdemucs` four-stem separation completed from a 3-second stereo float32 fixture.                                                                                                                                         |
| Instrumental strategy                           | Pass numerically         | Summing drums+bass+other was bit-identical to Demucs' four-stem complement for the fixture (maximum absolute difference 0.0). Listening review remains a product-quality test with representative music.                       |
| yt-dlp/FFmpeg/Demucs cancellation               | Pass                     | All three process-group cancellation probes terminated with no surviving child process.                                                                                                                                        |
| Lazy Torch/Demucs loading                       | Pass at protocol level   | Download/probe paths do not import Torch. Capability inspection imports it only when explicitly requested.                                                                                                                     |
| Frozen lightweight engine                       | Pass                     | PyInstaller on-directory engine launches and works from inside the signed app without user-installed Python.                                                                                                                   |
| Frozen full Torch/Demucs engine                 | Deferred                 | The Phase 0 app carries the lightweight supervisor, not Torch, Demucs, FFmpeg, or the model. Full native-library bundling is the first packaging spike in the Demucs phase.                                                    |
| MPS / Apple Silicon                             | Deferred externally      | This computer is Intel, so `mpsAvailable=false`. Validate on an arm64 Mac before advertising acceleration.                                                                                                                     |
| Signed/notarized/stapled Gatekeeper artifact    | Partial                  | Ad-hoc signing, hardened runtime sealing, deep strict verification, app launch, and DMG creation pass. Developer ID signing/notarization cannot be tested without Apple credentials and is not required for local development. |
| Clean-machine install                           | Deferred externally      | Requires a second clean Mac and the full engine artifact.                                                                                                                                                                      |
| Third-party distribution review                 | Partial                  | The local FFmpeg is GPL-enabled and is proof-only. Select an exact LGPL-compatible build or deliberately comply with GPL before distribution; audit model and native runtime notices with the full bundle.                     |

## Measurements

Measurements are diagnostic, not final performance budgets.

| Item                                | Measurement                                                                                                |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Python environment                  | Python 3.11.13 x86_64; local venv 913 MB                                                                   |
| Core versions                       | Demucs 4.0.1; Torch/Torchaudio 2.2.2; yt-dlp 2026.8.19; yt-dlp-ejs 0.8.0; PyInstaller 6.16.0               |
| `htdemucs` model                    | 84,141,911 bytes; SHA-256 `8726e21a993978c7ba086d3872e7608d7d5bfca646ca4aca459ffda844faa8b4`               |
| CPU separation                      | 3-second, 44.1 kHz stereo fixture in 37.77 seconds; maximum RSS about 1.10 GB                              |
| Output stems                        | Four stereo 44.1 kHz `pcm_f32le` files                                                                     |
| Torch first capability load         | About 60 seconds on this Intel proof environment                                                           |
| PyInstaller one-file supervisor     | 23 MB; roughly 33.74 s cold and 16.57 s warm; unsuitable                                                   |
| PyInstaller on-directory supervisor | 47 MB directory; 13.45 s first macOS-scanned launch and 0.83 s warm                                        |
| Packaged proof app                  | About 66 MB before DMG compression                                                                         |
| DMG                                 | 28 MB; SHA-256 `e710245dd8690d6ff458e95d7ff859c86dbf2b2cb59cf8efbd3aef85d6e69fb4`; `hdiutil verify` passed |

The full Torch/Demucs artifact will be much larger than this proof. A final installed footprint in the multi-gigabyte range is plausible once Torch, native libraries, FFmpeg, JavaScript runtime support, and models are present. Size is accepted as a secondary concern, but launch time, signing integrity, RAM, and reliable updates remain hard gates.

## Audio and tool findings

- The YouTube pipeline should request the best available audio and preserve that compressed source until decode/processing. It must not create MP3 before Demucs.
- Separation should decode to lossless PCM, retain float32 through Demucs and stem combination, and encode only at final export.
- Instrumental should use the four-stem model and sum drums+bass+other. This supports `All Stems` and every individual selection from one maintainable model path. Two-stem mode can be reconsidered only if later listening benchmarks show a meaningful advantage.
- FFmpeg commands must use fixed executable paths and argument arrays. The proof exposed harmless Opus packet-header warnings; production error normalization must distinguish warnings from failed output validation.
- yt-dlp must remain replaceable and pinned. Live YouTube is a smoke test only; automated tests use fixtures/mocks.

## Important problem discovered

PyInstaller one-file is not appropriate on macOS. Besides slow extraction, Tauri's ad-hoc signing caused the extracted Python framework to have a different signing identity from its loader, and macOS rejected it. An on-directory engine runs from the app resources, avoids extraction, starts much faster when warm, and passes the packaged parent/child proof.

## Carried-forward gates

These are deliberately carried forward and must not be mistaken for completed work:

1. Build and measure a full on-directory arm64 engine containing Torch, Demucs, yt-dlp support, FFmpeg/ffprobe, and one pinned model.
2. Validate MPS output, memory, speed, cancellation, and CPU fallback on an Apple Silicon Mac.
3. Choose and license the exact redistributable FFmpeg build and produce a complete notices inventory.
4. Run listening tests for Instrumental and stem quality on redistributable representative tracks.
5. Implement and test the Phase 1 production lifecycle: health timeout, crash reporting, explicit restart, single instance, and protocol compatibility errors.
6. For local completion, ad-hoc sign and verify the bundle on the owner's Mac. Developer ID signing, notarization, stapling, and broad clean-machine distribution are optional future work.

## Validation record

- `npm run test:engine`: 7/7 passed.
- `cargo fmt --check` and `cargo check`: passed.
- `npm run build:desktop`: passed.
- Targeted Prettier checks and `git diff --check`: passed.
- `hdiutil verify`: passed for the generated DMG.
- Repository-wide `npm run lint`: passes with six non-blocking Fast Refresh warnings in shared UI component modules. The previous 19 Prettier errors were normalized before checkpoint 1.
- `npm run phase0:verify`: passed on 2026-08-23 using repo-local PyInstaller cache/build paths.
- `npm run tauri:build`: produced an ad-hoc-signed x64 `.app` and `.dmg` on 2026-08-23. DMG creation requires normal macOS packaging access outside a restricted shell sandbox.

## Phase boundary

Phase 0 stops here. The proof does not implement local-file import, production downloads, exports, stem processing, settings, dialogs, or preview in the application.
