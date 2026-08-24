# Waves Phased Implementation Plan

Status: active implementation; Phase 0 complete and later phases authorized sequentially  
Priority order: local usability, reliability, maintainability, separation of concerns, performance, approved UI, reproducible installation, optional portability

## Scope decision — 2026-08-23

Waves is a personal, local-first macOS application. Completion means the owner can reliably run the complete local-file and YouTube audio workflows on the current Mac. GitHub source and portfolio presentation matter, but public distribution does not.

- Developer ID signing, notarization, App Store distribution, public auto-updates, analytics, and commercial support are not release blockers.
- Intel CPU operation is a supported primary path. Apple Silicon/MPS is an optional acceleration path when hardware is available.
- Ad-hoc signing and a locally built `.app`/`.dmg` are sufficient for completion.
- Reproducible source setup and clear build instructions are required. An unsigned GitHub Release artifact is optional when it is straightforward and honest about macOS security prompts and architecture limits.
- Portfolio publication remains a separate user-approved step after completion.
- Security and reliability requirements around user files, subprocesses, cancellation, cleanup, and output integrity remain mandatory.

## Delivery rules

- Each phase is a gate. Do not proceed until its acceptance criteria and required tests pass or an explicit architecture decision records an accepted exception.
- Keep `youtube-to-mp3-reference` and `stem-remover-reference` read-only. New code belongs under `waves-app`.
- Preserve the approved React design. Desktop integration should replace mocks through adapters, not redesign components.
- Maintain one shared, versioned domain/IPC contract and stable error taxonomy.
- Do not add playlists, accounts, cloud processing/storage, analytics, subscriptions, or DAW features.
- Pin build inputs and record artifact hashes/licenses. Upgrade one risky dependency family at a time.
- Use small redistributable audio fixtures. Mock network behavior by default.
- For each code phase, update architecture decision records and threat/risk notes when evidence changes the recommendation.

## Proposed repository shape

This is a planning target, not a command to create the files now:

```text
waves-app/
├── src/                         approved React UI
│   └── lib/waves/
│       ├── bridge/              mock and Tauri bridge adapters
│       ├── domain/              frontend DTOs/state mapping
│       └── ...
├── src-tauri/                   Tauri/Rust host
│   ├── src/jobs/                job state and supervision
│   ├── src/ipc/                 engine protocol client
│   ├── src/platform/            dialogs, reveal, settings, paths
│   └── capabilities/            least-privilege Tauri scopes
├── engine/                      packaged Python engine source
│   ├── waves_engine/protocol/
│   ├── waves_engine/jobs/
│   ├── waves_engine/downloader/
│   ├── waves_engine/media/
│   ├── waves_engine/separation/
│   ├── waves_engine/filesystem/
│   └── tests/
├── contracts/                   protocol schema and fixtures
├── fixtures/                    small licensed/generated test audio
├── packaging/                   frozen-engine and platform manifests
└── docs/                        architecture, ADRs, runbooks
```

Exact names may change after Phase 0, but the boundaries should remain explicit.

## Phase 0 — Architecture proof of concept

**Status (2026-08-20): Complete for the application-architecture decision on the available Mac.** See [Phase 0 Results](./PHASE_0_RESULTS.md) and [ADR-001](./ADR-001-DESKTOP-ENGINE.md). Full arm64/MPS, complete heavy-engine freezing, Developer ID notarization, and clean-machine distribution remain explicit external gates; they are not silently treated as passed.

### Objective

Prove or reject the riskiest architecture assumptions before application development: static frontend packaging, Tauri-to-Python IPC, frozen Torch/Demucs, bundled media tools, process cancellation, Apple Silicon acceleration, artifact size, and macOS signing/notarization.

### Work

- Create an isolated proof branch/work area inside `waves-app`; do not merge reference code.
- Produce a minimal client-only build of the existing frontend with one unchanged representative screen.
- Create the smallest Tauri 2 host capable of launching a fixed sidecar through Rust.
- Define protocol v1 handshake, command/event envelope, framing limits, and fixture schemas.
- Create a minimal lazy Python supervisor and a separate Demucs worker experiment.
- Compare onedir freezing candidates (at minimum PyInstaller; compare a second candidate if PyInstaller has material issues).
- Bundle pinned `ffmpeg`/`ffprobe`, yt-dlp, its required JavaScript support/runtime, and one pinned Demucs model.
- Run a short local separation on CPU and MPS and a single-video metadata/download smoke test.
- Prototype cancellation/process-tree termination for yt-dlp, FFmpeg, and Demucs.
- Prototype four-stem summing versus Demucs two-stem Instrumental.
- Produce a signed/notarized Apple Silicon `.app`/`.dmg` spike and a third-party license inventory.
- Record compressed size, installed size, launch/model-load time, processing time, peak RAM, and scratch disk.
- Record an Architecture Decision Record confirming Tauri/JSONL/freezer/model/device choices or selecting the documented fallback.

### Dependencies

- Approved architecture documents.
- Apple Developer ID/notarization credentials for the distribution portion.
- Permission to add proof-only framework/tooling dependencies.
- Redistributable short audio fixtures and one permitted live YouTube smoke-test source.

### Acceptance criteria

- Approved UI renders from a packaged static build without a runtime server or visual regression.
- Tauri launches a fixed packaged sidecar, verifies protocol/version, receives ordered progress, handles a crash, and restarts cleanly.
- No user-installed Python, FFmpeg, Node/Deno, or model is needed on a clean Apple Silicon test machine.
- Short Demucs inference succeeds on CPU; MPS is either validated with measurements or explicitly rejected as the automatic default.
- Cancel tests leave no running child processes and no output outside owned workspaces.
- Instrumental strategy is supported by numerical comparison and listening review.
- The exact nested artifact can be signed, notarized, stapled, installed, and launched under Gatekeeper.
- Artifact size and performance measurements are documented with pass/fail budgets proposed for later phases.
- Licensing review identifies no unresolved blocker for the chosen FFmpeg build, runtime libraries, and model weights.
- The architecture decision is explicit; uncertainty is not carried silently into Phase 1.

### Tests

- Protocol handshake/round-trip fixture test.
- Malformed/oversized JSONL and sidecar-crash tests.
- Cancellation at download, FFmpeg, and Demucs execution points.
- Local decode/separate/export smoke test with tools removed from `PATH`.
- CPU/MPS output tolerance and listening checks.
- Static-asset/routing/drag-drop production-build smoke test.
- `codesign`, Gatekeeper, notarization ticket, and clean-machine launch checks.

### Risks

- Torch native libraries or frozen imports may fail under Hardened Runtime.
- MPS may be unstable, slower, or numerically unacceptable for `htdemucs`.
- yt-dlp's current JavaScript runtime requirements may complicate freezing/signing.
- Onedir artifacts may be too large; onefile may appear smaller but create unacceptable launch/extraction behavior.
- Tauri WebKit/static asset behavior may require a targeted build split from Lovable preview.

## Phase 1 — Contracts, desktop shell, and approved frontend bridge

### Objective

Establish production project boundaries, replace browser-only assumptions with typed adapters, and package the approved UI in the selected desktop shell without implementing audio processing.

### Work

- Pin compatible frontend dependency versions and establish repeatable JS/Rust/Python lock workflows.
- Add the Tauri host and static desktop build confirmed by Phase 0.
- Formalize shared request/event/error schemas and code-generation or validation workflow.
- Add a `DesktopBridge` interface with mock and Tauri implementations.
- Implement host lifecycle, single-instance policy, sidecar health/version checks, and diagnostics.
- Configure least-privilege Tauri capabilities and CSP.
- Keep existing components/styles; route mock actions through the bridge.
- Add CI lanes for frontend, Rust, engine, contracts, and packaged smoke tests.

### Dependencies

- Phase 0 ADR confirming shell, IPC, and freezing direction.
- A versioned protocol fixture that passed the proof.

### Acceptance criteria

- The same approved interface runs in browser/mock development and in a Tauri window through separate adapters.
- The packaged runtime has no SSR/Nitro/local-server requirement.
- React cannot launch arbitrary commands or read arbitrary filesystem paths.
- Engine version mismatch and engine crash produce controlled UI errors.
- A current job snapshot can restore the UI after window remount.
- Clean builds are reproducible from documented commands.

### Tests

- Type checking, linting, production frontend build, and Rust tests.
- Shared protocol fixture validation in TypeScript, Rust, and Python.
- Fake-engine success, malformed event, version mismatch, hang, and crash integration tests.
- CSP/capability assertions and basic visual regression tests.

### Risks

- Lovable's implicit Vite/TanStack configuration may conflict with an explicit desktop target.
- Generated protocol types can drift if generation is optional; CI must enforce it.
- Over-broad Tauri plugins could bypass the intended host boundary.

## Phase 2 — Secure local file intake and metadata

### Objective

Load one local MP3, WAV, FLAC, AIFF/AIF, or M4A file through drag/drop or a native dialog, validate it, and display real metadata without copying, changing, or deleting the source.

### Work

- Implement native file dialog and Tauri drop-event handling.
- Create host-side source grants and canonical path validation.
- Add Python inspection request and an FFprobe-backed media metadata DTO.
- Validate regular-file status, readability, container/codec, duration, channel/sample properties, and reasonable size/duration limits.
- Generate or extract safe display title, duration, and lightweight waveform/peak data.
- Define artwork behavior for local files without blocking intake.
- Map unsupported, corrupt, missing, unreadable, and permission failures to stable errors.
- Update the existing loaded-track UI with real data.

### Dependencies

- Phase 1 bridge, protocol, host, and fake engine.
- Bundled FFprobe artifact from the locked Phase 0 toolchain.

### Acceptance criteria

- Exactly one supported local file can be dropped or selected and appears with accurate duration/source metadata.
- Multiple files, directories, unsupported files, corrupted media, missing paths, and unreadable files produce calm, specific errors.
- File filters include MP3/WAV/FLAC/AIFF/AIF/M4A but backend probing remains authoritative.
- The original source is never written, moved, renamed, or deleted.
- Metadata inspection does not freeze the window and can be cancelled/replaced by a new selection safely.

### Tests

- Unit tests for path grants, extension hints, FFprobe parsing, metadata limits, and error normalization.
- Fixture tests for all supported formats, mono/stereo, misleading extensions, truncation/corruption, Unicode names, and permission failure.
- Drag/drop and dialog adapter tests, including cancel and multiple-file rejection.
- Source-immutability hash test before/after inspection.

### Risks

- Codec support differs by FFmpeg build despite matching extensions.
- Huge or malformed media may make probing slow or hostile; enforce time/resource bounds.
- WebView-native path exposure differs between development and production.

## Phase 3 — Job manager, workspaces, cancellation foundation, and errors

### Objective

Build the reliability spine before adding real processing: job state machine, journals, workspaces, progress/event delivery, cancellation, cleanup, crash recovery, and error presentation.

### Work

- Implement the Rust authoritative state machine and one-active-job policy.
- Implement Python pipeline plans, cancellation tokens, and tool/worker ownership registry.
- Create private random per-job workspaces and cleanup manifests.
- Add startup reconciliation and retention policy for stale Waves-owned workspaces.
- Implement ordered events, snapshots, progress coalescing, warning/error envelopes, diagnostic IDs, and rotating redacted logs.
- Add shutdown confirmation and bounded cancellation/reaping.
- Replace prototype `WavesError` values with a typed mapped catalog while preserving approved visual treatment.
- Use fake processing stages to exercise every transition and race.

### Dependencies

- Phase 1 contracts/bridge.
- Phase 2 secure source grants and metadata records.

### Acceptance criteria

- Every job follows legal monotonic states and emits exactly one terminal outcome.
- Cancellation is idempotent and remains `cancelling` until work has stopped and cleanup is safe.
- Closing during a job terminates children within a documented bound or records cleanup for next launch.
- Restart removes only stale Waves-owned artifacts and never traverses outside the app job root.
- React can miss events, request a snapshot, and recover accurately.
- Raw exceptions/internal paths are absent from normal UI copy but correlated diagnostics remain useful.

### Tests

- Exhaustive state-transition/property tests.
- Cancel-before-start, cancel-during-stage, duplicate-cancel, completion/cancel race, and late-event tests.
- Engine crash, host restart, malformed journal, symlink, and orphan cleanup tests.
- IPC sequence, backpressure, oversized event, snapshot, and terminal uniqueness tests.
- Shutdown tests that assert no descendant process remains.

### Risks

- Cross-platform process-tree behavior requires platform-specific implementation.
- Cleanup races can corrupt outputs if process reaping is not a hard precondition.
- Persisted journals must not become a database-like source of stale truth.

## Phase 4 — FFmpeg decode and export pipeline

### Objective

Process local Original requests and export WAV, FLAC, or MP3 at approved quality without unnecessary loss, silent overwrite, UI blocking, or external FFmpeg installation.

### Work

- Implement safe FFmpeg/FFprobe command builders and explicit bundled tool resolution.
- Define canonical internal stereo float32/44.1 kHz intermediate where conversion is required.
- Implement output planning for Original and final encoders for WAV, FLAC, MP3 320/256/192 kbps.
- Add machine-readable progress, timeout/stall handling, subprocess-group cancellation, and diagnostics.
- Implement destination grants, disk-space estimates, same-volume staging, atomic publish, and deterministic collision naming.
- Reserve All Stems output groups even though stem inference arrives later.
- Implement settings persistence for default folder/format/quality.
- Generate output metadata and safe preview grants.
- Complete and publish the FFmpeg license/build manifest.

### Dependencies

- Phase 3 job/workspace/error foundation.
- Phase 2 inspected sources.
- Approved FFmpeg artifact/license decision from Phase 0.

### Acceptance criteria

- A local supported source exports to WAV, FLAC, and each MP3 bitrate using only bundled tools.
- WAV/FLAC do not show MP3 bitrate choices.
- No source is first converted to a lossy intermediate.
- Existing files are never overwritten; collisions produce `Name (1)`, `Name (2)`, etc., safely under concurrency.
- Final files appear atomically and partial files remain invisible or clearly staged.
- Cancel/failure/disk-full leaves no published corrupt output and cleans job-owned staging.
- Output passes probe validation and expected codec/bitrate/sample metadata checks.

### Tests

- Golden tests for argument arrays and no-shell invocation.
- Real tiny-fixture conversion matrix for MP3/WAV/FLAC/AIFF/M4A inputs and WAV/MP3/FLAC outputs.
- Audio duration/channel/sample-rate and lossless round-trip/tolerance checks.
- Collision, reserved filename, Unicode, long name, symlink, permission, disk-full, and cross-volume tests.
- Cancellation at decode/encode/publish boundaries and process-tree leak checks.
- License manifest/SBOM presence tests.

### Risks

- MP3 encoder availability and licensing depend on the selected build.
- “Highest quality” needs an explicit WAV subtype and FLAC bit-depth policy based on source/processing precision.
- Accurate progress for some short/odd inputs may require duration fallback behavior.

## Phase 5 — YouTube metadata and download pipeline

### Objective

Load and process one YouTube URL reliably, with playlist expansion prohibited, best-practical audio acquisition, real progress, normalized failures, and maintainable extractor updates.

### Work

- Implement single-URL parsing/admission and explicit no-playlist yt-dlp options.
- Add metadata-only extraction and safe DTO mapping.
- Fetch/cache thumbnails through the backend with scheme, redirect, type, size, and timeout limits.
- Implement best-practical audio download into the job workspace with explicit FFmpeg and JavaScript runtime locations.
- Normalize hook metrics and postprocessor stages into the job model.
- Implement retries/backoff only for classified transient failures; do not mask cancellations.
- Map invalid, deleted, private, age/region restricted, network, extractor, and interrupted failures.
- Establish pinned release/update runbook and isolated live smoke-test lane.
- Connect downloaded media to the Phase 4 export path; Original must skip Demucs.

### Dependencies

- Phase 4 export pipeline.
- Phase 3 cancellation/errors.
- Phase 0 proof of packaged yt-dlp/JavaScript runtime.

### Acceptance criteria

- One normal YouTube video loads metadata and exports all approved formats with no tool on `PATH`.
- Playlist URLs and URLs that would expand into multiple entries are rejected or constrained to one explicitly selected video; no playlist is ever queued.
- Acquisition retains the best practical source and never creates an intermediate MP3 before a later encode.
- Progress includes metadata/download/postprocessing phases and remains monotonic.
- Cancellation stops download and any FFmpeg descendant, removes partial workspace files, and preserves existing outputs.
- Each required failure class maps to a stable, understandable GUI state.
- Updating yt-dlp requires a tested signed Waves release under the v1 policy.

### Tests

- Mocked `YoutubeDL` unit tests for options, metadata, hooks, retries, cancellation, and exception mapping.
- Fixtures for hostile titles, missing fields, huge thumbnails, redirects, playlists, live streams, and unavailable entries.
- End-to-end fake HTTP/extractor tests without public network.
- Quarantined live smoke tests for metadata and a small permitted single download; failures alert maintainers but do not replace deterministic coverage.
- Regression test proving Demucs modules are not imported for YouTube Original.

### Risks

- YouTube and yt-dlp requirements can change between application releases.
- Age-restricted sources may tempt cookie/browser integration; that is outside v1 unless separately approved and threat-modeled.
- Download formats/container selection can vary by video and require robust probing.

## Phase 6 — Demucs separation and Instrumental

### Objective

Produce Vocals, Instrumental, Drums, Bass, Other, and All Stems locally through one quality-controlled four-source Demucs pipeline with lazy loading and safe output behavior.

### Work

- Implement the lazy model worker and packaged model resource verification.
- Lock model name/version/hash and exact compatible Python/Torch/Demucs stack.
- Implement canonical decode, channel handling, split/segment inference, and float intermediates.
- Map native source names without fixed indexes.
- Export one requested stem or all four through Phase 4.
- Implement Instrumental as float-precision drums+bass+other sum and validate it against Demucs two-stem behavior.
- Add model-load, decode, separate, combine, and export progress stages.
- Add memory/disk estimates and one-heavy-job resource policy.
- Define clipping/limiting behavior through tests; do not add creative normalization.
- Add lazy worker retention and controlled unload after failure/idle according to measured policy.

### Dependencies

- Phase 4 canonical audio/export layer.
- Phase 3 worker/cancellation lifecycle.
- Phase 0 locked model/runtime and Instrumental evidence.

### Acceptance criteria

- All six non-Original choices produce the expected files; All Stems produces exactly Vocals, Drums, Bass, and Other.
- Any non-Original request performs at most one four-source inference.
- Instrumental is audibly and numerically consistent with the accepted reference method.
- Source quality is not degraded by a lossy pre-separation intermediate.
- First separation visibly reports lazy model load; subsequent warm jobs reuse the model when policy permits.
- Download/Original-only workflows never import/load Torch/Demucs.
- Model/decode/inference/memory/disk failures are controlled and source files remain untouched.

### Tests

- Unit tests for source mapping, mono-to-stereo, pipeline planning, sum math, clipping policy, and model resource verification.
- Real short-fixture four-stem smoke tests and output probe validation.
- Quality regression/listening suite on an internal licensed corpus with stored metrics/tolerances.
- Cold/warm model lifecycle and memory release tests.
- Failure injection for missing/corrupt model, decoder failure, worker crash, OOM, and low disk.
- Test proving requested individual stems do not cause duplicate inference.

### Risks

- Archived Demucs upstream and Torch API drift.
- True separation progress may be approximate unless inference is wrapped at segment level.
- Float WAV scratch files are large; disk estimates and cleanup must be conservative.
- Output artifacts/clipping are model behavior and need an explicit user-neutral policy.

## Phase 7 — Hardware acceleration and resource policy

### Objective

Select the fastest stable backend automatically on Apple Silicon, provide safe CPU fallback, and hide technical device complexity from normal users.

### Work

- Implement Torch build/device checks and model-specific smoke tests.
- Benchmark representative short/medium tracks on target Apple Silicon classes.
- Define automatic selection thresholds and cache invalidation by app/engine/model/OS version.
- Implement whole-job CPU retry after classified MPS failure, with clean intermediate reset.
- Add memory-pressure/OOM handling, bounded thread settings, worker unload, and diagnostics.
- Keep an advanced CPU-only override; present user-friendly device labels.
- Draft the Windows CUDA capability interface without packaging Windows artifacts.

### Dependencies

- Phase 6 stable CPU separation.
- Access to representative Apple Silicon hardware/OS versions.

### Acceptance criteria

- Automatic mode never selects MPS solely because the API reports availability; model smoke/benchmark policy is applied.
- Effective device and fallback are recorded in diagnostics and exposed as understandable UI status when relevant.
- A failed MPS attempt cannot mix partial device outputs with a CPU retry.
- CPU-only mode is deterministic and works on all supported Macs.
- Performance/memory baselines and regression budgets are recorded by device class.

### Tests

- Mocked device matrix: not built, unavailable, smoke failure, runtime failure, OOM, and success.
- Real CPU/MPS output tolerance, performance, memory, cancellation, and repeated-job tests.
- Fallback test proving full workspace reset and one terminal result.
- Settings migration tests for device policy changes.

### Risks

- MPS performance may vary by macOS/PyTorch/model and may regress after upgrades.
- Automatic CPU retry can double time and scratch usage if preflight is weak.
- Aggressive memory limits can crash the OS; do not disable allocator safeguards casually.

## Phase 8 — Progress, cancellation, and error hardening

### Objective

Turn the functional pipelines into a consistently recoverable product across every required failure and cancellation point.

### Work

- Audit every stage for structured progress, cancellation checkpoints, timeout/stall policy, cleanup, and diagnostics.
- Calibrate stage weights from measurements without presenting false precision.
- Add warning actions for CPU fallback, partial published results, and recoverable destination issues.
- Complete the user-facing error catalog for all YouTube, file, model, Torch, device, FFmpeg, memory, disk, permission, engine, export, and cancellation failures.
- Implement engine hang watchdog and bounded restart rules.
- Add fault-injection hooks available only in test builds.
- Review shutdown and startup-recovery behavior with real pipelines.

### Dependencies

- Phases 4–7 functional pipelines.
- Phase 3 state/lifecycle foundation.

### Acceptance criteria

- The main window remains responsive during every long operation.
- Every required failure produces one stable code, calm UI copy, optional recovery action, and diagnostic ID.
- Cancellation latency is measured and meets per-stage bounds; no descendants or unsafe partial files remain.
- Progress never moves backward or reaches 100% before successful publish.
- Engine hang/crash recovery returns the UI to a truthful state and permits a later job.
- Quit during each stage either completes bounded cleanup or is reconciled on next launch.

### Tests

- Fault-injection matrix for every required error class and pipeline stage.
- Cancellation timing and leak tests at repeated randomized points.
- Event-order/property tests under delayed, duplicate, and late messages.
- Shutdown/kill/relaunch recovery tests with real subprocesses.
- UI copy/action snapshot tests and log-redaction assertions.

### Risks

- Third-party libraries may swallow cancellation or emit ambiguous errors.
- Overly aggressive watchdogs can terminate valid slow CPU inference.
- Partial publication semantics must be truthful for multi-file exports.

## Phase 9 — Preview and output workflow

### Objective

Replace simulated playback, folder selection, and Finder actions with safe native behavior while preserving the approved experience.

### Work

- Implement native destination dialog and persisted default folder.
- Implement restricted preview URLs/grants for inspected sources and generated outputs.
- Connect transport/seek/duration state to real audio playback.
- Revoke preview resources on track change/reset and handle missing files.
- Implement `reveal_output` and open-folder fallback through Rust/macOS APIs.
- Populate completion rows from real output records, sizes, and metadata.
- Refine keyboard navigation, focus behavior, accessibility announcements, and cancel confirmation without redesign.

### Dependencies

- Stable output records from Phases 4–8.
- Host path-grant and settings layers.

### Acceptance criteria

- Source and every generated output can be previewed, paused, and sought without exposing arbitrary filesystem access.
- Only one preview is active at a time and all resources are released on reset/close.
- Browse uses a native directory dialog; cancellation is silent and normal.
- Open Folder reveals the exact output in Finder when possible.
- Missing/moved outputs produce nonfatal guidance.
- Visual layout and interaction direction remain consistent with the approved Lovable interface.

### Tests

- Preview lifecycle, seek, switching outputs, revoked resource, corrupt/missing file, and reset tests.
- Destination dialog and settings persistence tests.
- Reveal authorization and fallback tests.
- Keyboard, focus, screen-reader announcement, target-window-size, and visual regression tests.

### Risks

- WebKit media codec behavior may differ from FFmpeg support; preview may need a generated compatible proxy.
- Long files should not be decoded entirely into frontend memory.
- macOS sandboxing, if later enabled, changes persistent folder authorization.

## Phase 10 — Automated testing and reliability hardening

### Objective

Reach release-candidate reliability with deterministic coverage, stress testing, dependency/security review, and measurable performance budgets.

### Work

- Complete unit, contract, integration, end-to-end, and visual suites described in `PROPOSED_ARCHITECTURE.md`.
- Add a fixture factory and legally redistributable audio corpus.
- Add soak tests for repeated Original/separation jobs, cancellation, model reuse/unload, and app restarts.
- Fuzz/bound malformed URLs, metadata, filenames, IPC frames, settings, and journals.
- Run static analysis, dependency/license scanning, SBOM generation, and secrets checks.
- Threat-model subprocesses, paths, thumbnails, IPC, cleanup, logs, and update mechanism.
- Establish performance baselines and regression thresholds.
- Document support diagnostics and recovery runbooks.

### Dependencies

- Feature-complete macOS workflow through Phase 9.
- CI runners and target hardware for real package/device tests.

### Acceptance criteria

- All specified deterministic suites pass in CI; quarantined network smoke tests report separately.
- No critical/high unresolved security finding or license blocker remains.
- Long repeated runs show no child-process leaks, unbounded disk growth, or unacceptable memory growth.
- Source immutability and no-overwrite properties hold under stress/concurrency tests.
- Performance meets documented budgets on minimum/recommended Apple Silicon hardware.
- Recovery runbooks cover corrupt settings, stale workspaces, failed engine launch, and failed update/install.

### Tests

- Full matrix: unit, property/fuzz, contract, fake-engine, real FFmpeg, real Demucs, frontend, E2E, packaged app, offline, and soak.
- Dependency-upgrade rehearsal for yt-dlp and Torch/Demucs independently.
- Clean-room reproducibility and SBOM/license notice verification.
- Security tests for command injection, traversal, symlinks, malicious names/metadata, arbitrary deletion, oversized IPC, and overwrite races.

### Risks

- Hardware-bound tests are slow and costly; separate required smoke from scheduled exhaustive lanes.
- Audio quality regressions need both objective measures and controlled listening review.
- Flaky live YouTube tests can obscure real regressions if mixed into the blocking suite.

## Phase 11 — Local macOS packaging

### Objective

Ship a polished local `.app`/`.dmg` for the owner's current Mac with a reproducible source build. Public notarized distribution is optional and non-blocking.

### Work

- Freeze the final locked Python engine as the proven onedir artifact.
- Bundle and verify model, FFmpeg/FFprobe, yt-dlp support/runtime, notices, and manifests.
- Configure bundle metadata, icon, versioning, minimum macOS version, and minimum entitlements.
- Ad-hoc sign the local application and verify the nested bundle. Document optional Developer ID steps without requiring credentials.
- Test local install/rebuild, offline launch, permissions, and application-data cleanup on the owner's Mac.
- Publish source setup, size/system requirements, third-party notices, privacy statement, and troubleshooting instructions.
- Document the rebuild/update process for yt-dlp changes.

### Dependencies

- Phase 10 release-candidate quality gate.
- Completed legal/licensing review.

### Acceptance criteria

- The owner can install from `.dmg`, launch locally, and complete local and YouTube workflows.
- Ad-hoc `codesign` and nested-code checks pass; notarization is explicitly optional.
- The application runs with no writes to its bundle and no dependencies on developer-machine paths or `PATH`.
- Upgrade preserves settings, does not orphan active/stale jobs, and does not overwrite user output.
- A clean source checkout can reproduce the local bundle using documented commands.
- Local artifacts include licenses/notices, hashes, version diagnostics, and rebuild instructions.

### Tests

- Automated package composition and unexpected dynamic-library/path scans.
- Ad-hoc signing and local launch checks.
- Fresh install, upgrade, downgrade/rollback policy, offline local workflow, online single-video workflow, cancellation, and uninstall tests.
- Launch from `/Applications`, downloaded/quarantined DMG, paths with spaces/Unicode, and read-only app bundle.
- Final size/startup/processing/memory/disk benchmarks.

### Risks

- Nested Python/Torch native code is sensitive to signing order and entitlements.
- Notarization may reveal late third-party binary issues.
- A large DMG affects download/install experience and update cadence.
- App Store sandboxing is not assumed; direct distribution still requires careful permissions and trust messaging.

## Phase 12 — Portability notes and optional GitHub download

### Objective

Leave the codebase understandable and portable without building a Windows release. If the completed Mac bundle is straightforward to share, document or publish it as an optional GitHub download.

### Work

- Audit paths, filenames, dialogs, reveal behavior, process ownership, settings, and app-data abstractions for unnecessary coupling.
- Document the current Mac architecture and the work a future Windows port would require.
- Keep platform-specific work behind interfaces where practical without delaying the local Mac application.
- Decide from the final artifact size and dependencies whether a GitHub Release download is useful; otherwise provide exact source-build directions.

### Dependencies

- Stable macOS architecture and shared contract.
- No Windows hardware is required for the local Mac completion target.

### Acceptance criteria

- Shared protocol/domain boundaries avoid unnecessary platform assumptions.
- macOS-specific path, reveal, and process behavior is isolated and documented.
- GitHub contains reproducible local build directions and an honest system-requirements statement.
- No claim of Windows support or public-ready macOS distribution is made.

### Tests

- Cross-platform path/filename/collision fixtures.
- Cross-platform path/filename unit fixtures where the implementation is platform-neutral.
- Local bundled FFmpeg inspect/export smoke test.
- CPU/device capability tests with mocked and available hardware.

### Risks

- CUDA libraries can make a universal Windows installer impractically large.
- Torch/CUDA/Python compatibility and NVIDIA driver floors change independently.
- Windows antivirus and SmartScreen may flag frozen Python sidecars until signed/reputable.
- Windows process, path, and locking semantics can expose assumptions hidden on macOS.

## Release-blocking test inventory

The following requirements are cross-phase and must all be represented before macOS release:

| Area | Required proof |
|---|---|
| URL behavior | Single-video only; playlist expansion cannot occur; invalid/unavailable/network/extractor cases normalized |
| Local sources | All approved formats probed; corrupted/unreadable/missing/permission cases handled; source hash unchanged |
| FFmpeg | Argument arrays, bundled location, progress, cancellation, codec/bitrate outputs, no shell, license manifest |
| Naming | Unicode/reserved/long/malicious names; atomic collision handling; no silent overwrite |
| Temporary data | Success/failure/cancel/shutdown/crash cleanup; symlink/traversal-safe deletion; stale-job recovery |
| Demucs | Model verification, source mapping, device selection, warm/cold lifecycle, worker crash/OOM, quality regression |
| Instrumental | Four-stem sum validated against accepted reference behavior and listening tests |
| Jobs | Legal transitions, monotonic progress, snapshot recovery, exactly one terminal event, idempotent cancel |
| IPC | Schema/version/framing limits, malformed/late/duplicate events, engine restart, backpressure |
| Settings | Atomic persistence, validation, migration, corrupt fallback, destination authorization |
| Desktop | Native drop/dialog/reveal, restricted preview, no arbitrary frontend filesystem/shell capability |
| Packaging | Clean machine, offline local workflow, nested signatures, Hardened Runtime, notarization/stapling, SBOM |

## Explicitly deferred beyond v1

- Playlists or multi-track queues exposed to users.
- Accounts, authentication, databases, cloud processing/storage, analytics, subscriptions, or collaboration.
- DAW editing, waveform editing, cutting, BPM/key analysis, and online libraries.
- Mac App Store sandboxing/distribution unless separately approved after direct distribution works.
- In-app component-level yt-dlp/FFmpeg/model executable updates. Start with full signed application releases.
- Windows production installer/release; Phase 12 is preparation only.
- Alternative ML backends/models unless the Phase 0 Demucs feasibility gate fails and an architecture revision is approved.
