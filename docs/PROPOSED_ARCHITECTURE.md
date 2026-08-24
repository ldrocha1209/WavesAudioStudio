# Proposed Waves Architecture

Status: accepted by Phase 0 proof; local-first scope updated 2026-08-23  
Primary target: the owner's macOS computer, including Intel CPU operation  
Future portability: documented but not release-blocking

## Decision

Use **Tauri 2 as the desktop shell, the approved React/TypeScript frontend as a client-only static application, a Rust-owned job/lifecycle layer, and a packaged Python processing sidecar communicating through a versioned JSON-lines protocol over standard input/output**.

The Python sidecar should be a small long-lived supervisor with lazy imports and a lazily created Demucs worker process. It should invoke bundled FFmpeg/FFprobe as owned subprocesses and embed yt-dlp behind a downloader adapter. React must communicate only with typed Tauri commands and events; it must not spawn executables or access arbitrary filesystem paths directly.

Phase 0 proved the shell, IPC, lightweight freezing, CPU separation, and cancellation boundaries. Full-engine packaging remains a later phase gate. Public notarization and Apple Silicon acceleration are optional under the local-only product scope.

## Architecture diagram

```text
┌──────────────────────────────────────────────────────────────┐
│ Approved React / TypeScript UI (static, client-only build)   │
│ view state · configuration · progress · preview controls     │
└───────────────────────────┬──────────────────────────────────┘
                            │ typed Tauri commands/events
┌───────────────────────────▼──────────────────────────────────┐
│ Tauri 2 / Rust desktop host                                 │
│ native dialogs · path grants · settings · job state machine │
│ sidecar supervision · app lifecycle · OS integration        │
└───────────────────────────┬──────────────────────────────────┘
                            │ JSONL stdin/stdout, stderr logs
┌───────────────────────────▼──────────────────────────────────┐
│ Packaged Python engine supervisor                           │
│ request validation · pipeline planning · domain errors      │
│ lazy imports · tool adapters · worker/subprocess ownership  │
└──────────────┬─────────────────┬─────────────────┬───────────┘
               │                 │                 │
        ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼────────┐
        │ yt-dlp      │   │ FFmpeg /    │   │ lazy Demucs   │
        │ adapter     │   │ FFprobe     │   │ worker process│
        └──────┬──────┘   └──────┬──────┘   └──────┬────────┘
               └─────────────────┼─────────────────┘
                                 │
                        ┌────────▼─────────┐
                        │ job workspace / │
                        │ atomic exporter │
                        └──────────────────┘
```

## Why this architecture fits Waves

### Reliability

React never performs long-running work. The Rust host remains responsive even if Python crashes. Downloads and FFmpeg operations are cancellable owned subprocesses. Demucs runs in a process boundary that can be terminated if its library call cannot stop cooperatively. Every job has an explicit state, job directory, ownership manifest, and one terminal result.

### Maintainability

The frontend preserves its approved design and depends on a small typed desktop adapter. Python retains the ecosystem where yt-dlp, Demucs, and PyTorch are best supported. Rust is limited to desktop responsibilities and process supervision; audio/ML algorithms are not duplicated in Rust. Tool-specific errors and options stay behind adapters.

### Installation

Tauri can bundle target-specific external binaries. A frozen Python distribution, model weights, FFmpeg/FFprobe, and the JavaScript runtime required by the chosen yt-dlp build can live inside the signed `.app`. The user installs a normal `.dmg`/`.app` and does not need Python, Node, Rust, FFmpeg, or package managers.

### Performance

The UI process is isolated from ML memory pressure. Torch and Demucs are imported only for separation. A model worker can remain alive between separation jobs. The pipeline avoids an intermediate lossy encode and limits v1 to one active heavy job.

## Component responsibilities

### 1. React frontend

Responsibilities:

- Render the approved Waves interface and animations.
- Hold transient presentation state only.
- Submit validated user intent: source token, requested output, export settings.
- Subscribe to job snapshots/events and render progress, warnings, errors, and outputs.
- Control preview through safe media URLs or Tauri asset protocol grants.
- Never construct shell commands, infer trusted filesystem paths from display strings, or own cleanup.

The existing `src/components/waves/*` should remain the visual foundation. `useWaves.ts` should evolve into a UI controller backed by a `DesktopBridge` interface. `pipeline.ts` can remain as a development/demo adapter while a Tauri adapter implements the same conceptual contract. Backend-generated identifiers and paths must replace mock filenames and tilde paths.

The desktop target should use TanStack Start SPA/client-only output. The existing server/Nitro entry may remain for Lovable preview if needed, but it must not be in the packaged runtime. This should be achieved through separate build configuration, not a visual rewrite.

### 2. Tauri/Rust desktop host

Responsibilities:

- Own application startup, single-instance behavior, window lifecycle, and controlled shutdown.
- Expose a narrow command surface: choose source, choose destination, inspect metadata, start/cancel job, get job snapshot, reveal output, open output, get/update settings, and query capabilities.
- Convert native drop events and dialog selections into opaque source/destination grants or canonical validated paths.
- Own the authoritative job state machine and reject illegal transitions.
- Spawn, monitor, restart, and terminate the Python supervisor and process groups.
- Validate the IPC protocol, correlate requests, rate-limit/forward progress, and treat malformed sidecar messages as engine faults.
- Persist non-sensitive settings atomically in the platform app-data directory.
- Write rotating diagnostic logs with redaction.
- Mediate opening files/folders through OS APIs.

React should not receive the Tauri shell plugin's general process-execution ability. Sidecar startup belongs in Rust with a fixed executable and fixed protocol, reducing command-injection and capability risk.

### 3. IPC/communication layer

Use newline-delimited UTF-8 JSON over the sidecar's standard input/output:

- one JSON object per line;
- protocol version on a startup handshake;
- unique request/job IDs generated by the host;
- monotonic per-job event sequence numbers;
- typed message names and validated payload schemas;
- exactly one terminal `completed`, `failed`, or `cancelled` event per job;
- stdout reserved exclusively for protocol messages;
- stderr reserved for structured diagnostics/log capture;
- bounded message size, bounded queues, and progress coalescing;
- heartbeat/health request and explicit engine version/capability response.

Example command:

```json
{
  "protocol": 1,
  "type": "start_job",
  "requestId": "r-17",
  "job": {
    "id": "j-42",
    "source": { "kind": "file", "grantId": "g-8" },
    "result": "instrumental",
    "export": { "format": "mp3", "bitrateKbps": 320, "destinationGrantId": "d-3" }
  }
}
```

Example event:

```json
{
  "protocol": 1,
  "type": "job_progress",
  "jobId": "j-42",
  "seq": 19,
  "stage": "separating",
  "stageProgress": 0.63,
  "overallProgress": 0.74,
  "message": "Separating audio"
}
```

JSONL is preferred to a localhost API because it has no listening port, origin/authentication problem, HTTP server lifecycle, or multipart copying. It is easier to debug and version than an ad hoc text stream. Large audio never crosses IPC; only bounded metadata and paths/grants do.

### 4. Job manager

The Rust host owns user-visible job state; the Python engine owns step execution details. In v1 the queue permits one active processing job. A queued-job UI is not required, but the state model should not preclude it.

Suggested states:

```text
created → inspecting → ready → running → publishing → completed
                                │              │
                                ├→ cancelling ├→ cancelled
                                └──────────────┴→ failed
```

`running` contains planned stages such as metadata, download, decode, separate, combine, and export. Stage weights are estimates; stage progress must never move backwards, and the UI should not promise an exact ETA when a tool cannot provide one.

The host records a lightweight job journal in app state: job ID, source display metadata, workspace path/identifier, current state, created time, last event sequence, and intended outputs. It must not persist user media. On startup it scans only Waves-owned job roots, reconciles stale journals, and removes expired orphan workspaces according to policy.

### 5. Python processing engine

Responsibilities:

- Validate domain requests again; never trust React-originated values merely because Rust checked them.
- Build a pipeline plan that skips irrelevant work.
- Lazily import optional/heavy modules.
- Coordinate downloader, probe/codec, separator, and exporter adapters.
- Translate third-party exceptions into stable engine error codes.
- Track subprocesses/workers owned by each job.
- Maintain a job cleanup manifest.
- Emit structured, bounded events and never user-facing prose as the sole error information.

The frozen distribution should use an **onedir-style bundle/resource tree**, not a giant self-extracting onefile binary. Onedir avoids extracting hundreds of megabytes of Torch/native libraries on each launch, makes resource location deterministic, improves crash diagnosis, and works better with nested signing. It is still packaged inside one `.app` for the user.

### 6. Downloader layer

Responsibilities:

- Accept only a single supported URL and force no-playlist behavior.
- Use yt-dlp's Python API behind an adapter.
- Fetch metadata separately without downloading.
- Select the best practical audio source for the downstream task.
- Download only inside the current job workspace.
- Provide numeric progress from hooks and postprocessor events.
- Pass an explicit bundled FFmpeg location and explicitly controlled yt-dlp configuration.
- Package the yt-dlp JavaScript support/runtime required by the selected release.
- Normalize invalid, unavailable, private, age/region restricted, network, extractor, and interrupted outcomes.

Maintenance policy:

- Pin one tested yt-dlp build in each release.
- Run mocked adapter tests and a small legal/private CI smoke suite against representative single-video URLs.
- Monitor upstream changes and prepare rapid signed Waves point releases.
- Start with full application updates. Do not let yt-dlp update itself from an arbitrary channel/repository inside the signed app.
- Design the adapter/artifact manifest so a separately signed, hash-verified, rollback-capable component update could be evaluated later, but do not make it a v1 dependency.

### 7. FFmpeg layer

Responsibilities:

- Resolve bundled `ffmpeg` and `ffprobe` by application resource path.
- Probe streams into a typed media description.
- Validate duration, codecs, channels, sample rate, and decodability.
- Generate commands as argument arrays without a shell.
- Decode to the canonical internal format, combine stems when required, encode final WAV/FLAC/MP3, and optionally generate lightweight preview data.
- Parse machine-readable progress.
- Terminate the whole owned process group on cancellation, escalate after a bounded grace period, and wait/reap before cleanup.
- Write to job-private temporary paths, never directly onto an existing destination.
- Record version/build information for diagnostics.

Use one carefully selected per-platform build whose licensing and codec configuration are documented. Bundle both tools; do not search `PATH`, invoke Homebrew, or download FFmpeg at first launch.

### 8. Stem-separation layer

Responsibilities:

- Load a packaged, hash-verified model lazily on the selected device.
- Cache the model worker after successful inference when memory policy allows.
- Detect MPS/CUDA/CPU capability, run a small compatibility/self-test, and expose the effective device without jargon in the normal UI.
- Decode to stereo 44.1 kHz float audio for `htdemucs` through the canonical pipeline.
- Run split inference with an empirically selected overlap/segment configuration.
- Produce all four native stems once for every separation request; publish only requested files.
- Build Instrumental by summing drums, bass, and other at float precision and then encode once.
- Surface resource failures distinctly and perform a controlled CPU retry only when safe.

The separation worker is a child of the Python supervisor. This creates a hard cancellation boundary. On cooperative cancellation it stops at a segment boundary if the selected inference API permits it. After a grace period the supervisor terminates the worker and reports cancellation only after it has exited. A killed worker loses the model cache and must be recreated for the next job; this is preferable to a frozen UI or ambiguous partial work.

### 9. Filesystem and output layer

Use platform-standard locations:

- application settings and journal: app config/data directory;
- logs: app log directory;
- temporary jobs: app cache/temp directory, one cryptographically random directory per job;
- default user output: a user-selected/persisted folder, initially suggested as `Music/Waves` but created only with user intent.

Rules:

- Canonicalize/validate all roots and verify containment before creating, reading, publishing, or deleting.
- Never place an untrusted title directly into a path. Normalize Unicode, remove separators/control characters/reserved names, trim trailing dots/spaces where applicable, and impose byte-length limits.
- Never delete a user source. Copy/download to a job-owned path when a component has destructive cleanup semantics.
- Maintain a manifest of every job-owned file and remove only entries underneath that job root.
- Preflight free space using a conservative estimate and re-check before publish.
- Write final content to a unique staging file on the destination volume, fsync/close as appropriate, then atomically rename.
- Reserve collision-free names under a lock. Use `Track.wav`, `Track (1).wav`, `Track (2).wav`, etc.
- For All Stems, reserve the complete output group before publishing so one stem cannot overwrite or interleave with another job.
- Never pass a force-overwrite flag for a final user path. Force overwrite is allowed only for a unique job-private staging file.

### 10. Settings layer

Persist a small versioned JSON/TOML record atomically through Rust:

- default output directory grant/path;
- default export format and MP3 bitrate;
- hardware mode (`automatic`, `cpu`, and advanced device override when supported);
- appearance/accessibility choices;
- cleanup retention and optional model-cache behavior if later exposed.

Validate on read, migrate by schema version, and fall back to safe defaults if corrupt. Do not store secrets or analytics identifiers. On macOS, if sandboxing is later enabled, persist security-scoped bookmark data rather than assuming a path remains authorized.

## End-to-end data and event flow

### Local file

1. Native drag/drop or open dialog gives Rust the real selected path and creates a source grant ID.
2. React calls `inspect_source(grantId)`.
3. Rust validates the grant and sends an inspection request to Python.
4. Python/FFprobe returns normalized metadata; Rust emits/returns a safe DTO to React.
5. React submits result/export intent and destination grant.
6. Rust creates the job record and private workspace, then sends `start_job`.
7. Python plans only required stages. Original skips Demucs. Stem requests lazily start/load the model worker.
8. Python emits stage events; Rust validates sequence/state and forwards coalesced Tauri events.
9. Outputs are encoded to destination-volume staging paths and atomically published under collision-free names.
10. A terminal event includes output IDs, display filenames, media metadata, and host-approved paths/grants. Rust records completion and cleans the job workspace.

### YouTube URL

1. React submits one URL to `inspect_url`.
2. Rust applies size/scheme bounds and Python calls yt-dlp metadata extraction with playlist expansion disabled.
3. Safe metadata and a thumbnail are returned. The thumbnail should be downloaded/cached by a controlled backend path, with content/type/size limits, rather than loaded as arbitrary remote web content by the WebView.
4. On process, yt-dlp downloads best practical audio into the job workspace and emits download events.
5. The remaining path is identical to local processing. Original skips Demucs; stem requests decode losslessly to the internal representation before separation.

### Progress model

Every event contains `jobId`, `seq`, `stage`, optional stage progress, computed overall progress, and optional structured metrics. The Rust host computes/validates user-visible overall progress from the plan so different tool conventions cannot move it backward. React requests a current snapshot after mount/reconnect and does not rely solely on events that might have been missed.

### Error model

Engine errors contain:

```text
code           stable machine-readable category
stage          where it occurred
messageKey     frontend-safe copy selector
recoverable    whether retry/fallback is possible
details        bounded non-sensitive structured context
diagnosticId   correlation ID for local logs
```

Example families: `SOURCE_INVALID`, `SOURCE_UNREADABLE`, `URL_UNAVAILABLE`, `NETWORK_LOST`, `EXTRACTOR_FAILED`, `FFMPEG_FAILED`, `MODEL_LOAD_FAILED`, `DEVICE_FAILED`, `OUT_OF_MEMORY`, `DISK_FULL`, `DESTINATION_DENIED`, `EXPORT_FAILED`, `ENGINE_CRASHED`, and `CANCELLED`. React maps codes to calm copy and optional actions. Raw third-party exception strings remain in redacted local diagnostics, not the main UI.

## Cancellation and shutdown

Cancellation is a state transition, not a button-side effect:

1. Rust atomically changes `running` to `cancelling` and rejects duplicate terminal actions.
2. Rust sends a cancel request to Python.
3. yt-dlp hooks observe a cancellation token and abort; its owned process/subprocess group is terminated if it does not exit.
4. FFmpeg receives graceful termination, then a bounded hard kill; the process is reaped.
5. Demucs stops at a safe boundary where possible; otherwise its worker process is terminated and recreated later.
6. Export stops writing only to staging files. Already atomically published outputs are reported explicitly; the UI must never falsely claim “nothing was written” if publication occurred.
7. Cleanup waits until writers/processes have exited, deletes only the job manifest under the job root, and emits `cancelled`.

On application close with an active job, show a native/UI confirmation. If the user chooses to quit, run the same bounded cancellation, persist a recoverable cleanup journal, terminate children, and exit. On the next launch, reconcile only Waves-owned stale workspaces.

## Hardware acceleration policy

### macOS / Apple Silicon

Automatic selection should evaluate:

1. Is the packaged Torch build compiled with MPS support?
2. Does `torch.backends.mps.is_available()` return true on this OS/device?
3. Does the exact packaged Demucs model pass a short MPS smoke test?
4. Does a benchmark on representative clips show MPS is materially faster and stable relative to CPU?

Only then prefer MPS. Availability alone is insufficient. Cache the validated capability by engine/model version but allow automatic revalidation after upgrades. On unsupported operations, do not silently enable unlimited fallback; report the effective device and retry the entire job on CPU only after clearing partial state and confirming memory/disk conditions. CPU is the always-available fallback.

### Windows later

Use a build-specific capability check (`torch.cuda.is_available()`, device properties, compatible driver/runtime, and model smoke test). Ship separate CPU and CUDA-capable artifacts if measurements show that bundling CUDA into every installer is too large. Do not download executables or drivers implicitly. DirectML or other backends are future evaluations, not v1 commitments.

## Model loading and memory policy

- Launch the lightweight Python supervisor with no Torch/Demucs import.
- Metadata, Original download, and FFmpeg-only jobs never initialize Torch.
- On the first stem request, spawn the model worker, import Torch/Demucs, select/test the device, load the packaged model, and emit distinct `engine_loading`/`model_loading` status.
- Keep the worker/model alive for subsequent jobs in the session when memory pressure is acceptable.
- Support an internal idle unload policy and immediate unload after device/OOM failure. Whether to expose a user setting should be deferred until measurement.
- On app backgrounding, do not discard the model reflexively; on memory pressure or long idle, shut the worker down cleanly.

This yields fast normal downloads without giving up warm repeat separation. Installed size is unchanged by laziness, but startup time and resident memory improve substantially.

## Packaging and distribution

### macOS first

- Build a native `aarch64-apple-darwin` Tauri host and native arm64 sidecars/libraries; do not call an unverified “universal” artifact the first release.
- Package the static React assets, onedir Python engine/supervisor/worker resources, pinned model weights, FFmpeg/FFprobe, and required yt-dlp JavaScript runtime/support inside the `.app`.
- Use deterministic lockfiles and a software bill of materials with licenses and hashes.
- Sign nested Mach-O binaries and executable components from the inside out with Developer ID, then sign the outer `.app` with Hardened Runtime and the minimum entitlements.
- Build/sign the `.dmg`, submit the outer distribution artifact through current Apple notarization tooling, staple the ticket, and verify with `codesign`, `spctl`, and Gatekeeper on a clean Mac.
- Test from a read-only/translocated install context and from `/Applications`; never write inside the app bundle.
- Prefer direct Developer ID distribution for v1. Mac App Store sandbox constraints can be evaluated later.

PyInstaller is a candidate freezer, not a foregone conclusion. Phase 0 should compare its onedir output with Nuitka or another maintained freezer for Torch hook coverage, startup, size, signing, crash behavior, and reproducibility. Tauri's sidecar support does not solve Python freezing by itself.

### Size implications

The shell/frontend are relatively small; Python, Torch, native math libraries, audio codecs, and model weights dominate. A realistic initial arm64 app may be several hundred megabytes compressed and approach or exceed 1 GB installed. A Windows CUDA build can reach multiple gigabytes because CUDA/cuDNN libraries may be included. These are planning ranges, not promises: Phase 0 must record compressed installer size, installed size, first launch, cold model load, warm model load, and peak memory from the actual locked artifacts.

Do not use a first-run model/runtime download merely to make the installer appear small unless product requirements explicitly accept that stems are unavailable offline until a large download completes. Bundling the tested model is more reliable for v1.

### Future Windows differences

- Build and freeze `.exe`/DLL resources on Windows; artifacts are not cross-built from macOS.
- Bundle Windows FFmpeg/FFprobe builds and handle Windows path/reserved-name/long-path semantics.
- Use Job Objects (or equivalent) so cancellation and shutdown terminate full process trees.
- Evaluate CPU-only versus NVIDIA CUDA installers and compatible driver requirements.
- Package with Tauri-supported MSI/NSIS options, sign executables and installer with a trusted code-signing certificate, and test SmartScreen reputation behavior.
- Use Windows Known Folders and Explorer reveal APIs.
- Account for antivirus false positives against frozen Python executables.
- Keep protocol/domain tests identical across platforms; isolate platform behavior behind Rust and artifact builders.

## Desktop integration details

### Drag and drop

Use Tauri WebView drag/drop events to obtain native file paths in Rust. Accept exactly one regular local file, reject directories/URLs/multiple files, canonicalize it, validate supported extension as an early hint, then probe content in Python. The React drop surface keeps its current visual response but receives only approved metadata/grant IDs.

### File and folder dialogs

Use Tauri/native open dialogs:

- file selection: one file, filters for MP3/WAV/FLAC/AIFF/AIF/M4A;
- destination selection: directory only;
- save/publish: Waves manages names under the selected destination instead of asking once per stem.

Filters improve UX but are not security validation. Cancelled dialogs are normal results, not errors.

### Finder and Explorer

Expose a host command `reveal_output(outputId)`. Rust resolves the approved output record and uses the platform reveal/open API. React cannot pass an arbitrary command or executable. If the exact file is missing, fall back to opening its approved parent and show a nonfatal warning.

### Audio preview

Preview only inspected source/output records. Prefer the WebView's audio element with a narrowly scoped Tauri asset/custom protocol or short-lived host grant. Do not expose the entire filesystem or embed arbitrary remote URLs. Revoke object URLs/grants when tracks change. Validate media before preview and keep preview decoding off the React main thread where the platform permits.

## Security controls

- Narrow Tauri capabilities and CSP; no arbitrary shell command or broad filesystem scopes in frontend code.
- Scheme/host/length validation and no playlist expansion.
- Argument-array subprocess APIs; never invoke a shell with user data.
- Canonical containment checks at every trust boundary.
- Random private job directories created with restrictive permissions.
- Safe filename normalization, reserved-name handling, length limits, and collision reservation.
- Atomic no-clobber publishing.
- Backend-controlled thumbnail fetching with type/size/time limits; no arbitrary WebView navigation.
- Bounded IPC messages, schema validation, protocol/version handshake, and no untrusted log control characters.
- Redact URLs/query tokens, usernames/home paths where practical, cookies, and credentials from diagnostics.
- Never accept browser cookies as yt-dlp input by default; any future authenticated-source design requires explicit separate review.
- Verify bundled resources by build manifest; verify any future downloaded component with a signed manifest and hash before execution.
- Cleanup only manifest-listed paths under an app-owned root; symlink-safe checks before deletion.
- Do not silently overwrite, delete sources, or follow output symlinks into unintended locations.

## Testing architecture

### Python unit tests

- URL admission and forced no-playlist behavior.
- Metadata DTO mapping and untrusted metadata limits.
- yt-dlp option generation and error normalization with fake `YoutubeDL`.
- progress hook normalization/throttling and cancellation.
- FFprobe parsing and FFmpeg argument generation.
- local format/container/codec validation.
- canonical decode/export planning and MP3 bitrate selection.
- filename sanitization across macOS/Windows cases.
- collision allocation and atomic group publishing.
- workspace manifest and cleanup under success/failure/cancel/crash recovery.
- model source mapping, mono/stereo handling, instrumental summing, and device selection with mocked Torch.
- job pipeline planning: Original never loads Demucs; local skips download; All Stems outputs four files.
- error taxonomy and redaction.

### Rust unit/integration tests

- legal/illegal job transitions and terminal-event uniqueness.
- IPC framing, size bounds, schema/version failures, sequence handling, and reconnect snapshots.
- sidecar crash/restart and stderr capture.
- process-tree cancellation and shutdown timeouts.
- path grants, settings migration/atomic persistence, dialog result mapping, and reveal authorization.
- event coalescing without losing terminal events.

### Frontend tests

- all approved phases and error messages.
- format/quality rules.
- drag/drop and dialog bridge behavior.
- progress monotonicity and missed-event snapshot recovery.
- cancel/cancelling/partial-publish behavior.
- multiple outputs, preview lifecycle, reveal action, and settings persistence.
- visual regression at target desktop sizes and keyboard/screen-reader accessibility.

### Contract and integration tests

- Generate TypeScript/Rust/Python representations from one protocol schema or validate all three against shared fixtures.
- Fake engine executable for deterministic success, progress, malformed messages, hangs, crashes, and cancellation races.
- Real FFmpeg tests on tiny generated fixtures for MP3/WAV/FLAC/AIFF/M4A, corruption, truncation, and permission failures.
- Real Demucs smoke test on a short redistributable fixture; full quality regression on an internal licensed corpus.
- yt-dlp tests mocked by default. A quarantined, non-blocking CI smoke suite may use a small set of permitted live videos and should never be the only coverage.
- Packaged `.app` tests with networking off for local Original and stem workflows.
- Clean-machine signed/notarized install, launch, quit-during-job, relaunch-cleanup, and Gatekeeper verification.

## Alternatives considered

### Electron + Python sidecar

Rejected as the primary recommendation because it adds a bundled Chromium/Node runtime and a broader process/security surface without reducing the hard Python/Torch packaging problem. Electron has mature tooling and may be a fallback if Tauri WebKit behavior or nested sidecar signing proves unacceptable. Its larger baseline matters less than Torch, so this is not a dogmatic rejection; Phase 0 should keep one minimal fallback spike cheap.

### PySide6/Qt with embedded React or a redesigned Qt UI

Rejected because a Qt rewrite would discard the approved interface and duplicate frontend work. Embedding the React app inside Qt would create a less standard web/native bridge while still carrying a large Qt/Python bundle. The older downloader also demonstrates the ease of accidentally blocking the GUI thread.

### Python-only desktop shell

Rejected for the same UI-preservation reason and because Python GUI packaging does not remove the ML packaging/signing risk.

### Local FastAPI/HTTP service

Rejected because it introduces a listening socket, port allocation, origin/authentication, startup readiness, server shutdown, request streaming, and extra copy/error semantics with no remote-client requirement. JSONL IPC is smaller and safer for one parent/child relationship.

### Unix domain sockets / Windows named pipes

Not selected initially because stdin/stdout already supplies private inherited handles and enough throughput for metadata/events. Sockets/pipes become useful only if multiple clients, reconnection to a persistent daemon, or binary streaming becomes a real requirement. None exists in v1.

### Embedded CPython inside Rust

Rejected because native interpreter embedding, GIL/runtime lifecycle, Python extension loading, Torch crashes, and code signing would occur inside or tightly couple to the desktop host. A separate process provides materially better fault and cancellation isolation.

### One subprocess per entire job

Rejected as the sole design because every stem job would reload Python, Torch, and the model. The proposed lightweight supervisor plus lazy reusable model worker preserves a hard-kill boundary while enabling warm reuse.

### Rewrite downloader/FFmpeg in Rust

FFmpeg process supervision and filesystem ownership belong in controlled layers, but replacing yt-dlp's extractor ecosystem is not maintainable. A partial Rust rewrite does not remove Python because Demucs/PyTorch remain. Keep the Python domain adapter and consider moving only proven generic supervision primitives into Rust.

### Browser/PWA or hosted backend

Rejected because local filesystem integration, large local processing, offline behavior, packaged runtimes, and the no-cloud requirement are core product constraints.

### Briefcase as the shell

Rejected because it would not preserve the React application naturally, and the old project did not prove FFmpeg bundling, reliable background work, or signed distribution. Briefcase may be compared as a Python-freezer input only if other freezing options fail, not as the UI architecture.

## Architectural risks and required prototypes

The following must be proven before full implementation:

1. Freeze a minimal Python engine with the selected Python/Torch/Torchaudio/Demucs/SoundFile stack and packaged model on arm64.
2. Launch it as a Tauri sidecar, complete a JSONL handshake, stream progress, survive malformed output, and restart after a crash.
3. Run real short Demucs inference on CPU and MPS; compare correctness, time, peak resident memory, thermal behavior, and fallback.
4. Cancel yt-dlp, FFmpeg, and Demucs at multiple points and verify process-tree exit plus zero unsafe deletion.
5. Produce Instrumental both by the standard four-stem sum and Demucs two-stem behavior; compare numerical/audio output.
6. Build a client-only desktop artifact from the current TanStack/Lovable frontend without layout, routing, asset, or drag/drop regressions.
7. Bundle FFmpeg/FFprobe and the current yt-dlp JavaScript requirements; complete metadata/download with no tools on `PATH`.
8. Sign every nested binary, notarize/staple a `.dmg`, install on a clean Apple Silicon Mac, and run offline local processing.
9. Measure compressed/installed size, cold/warm launch, cold/warm model load, CPU/MPS separation time, peak RAM, and scratch disk for representative track lengths.
10. Prove atomic collision-free All Stems publishing and recovery from quit/power-loss simulation.
11. Confirm third-party licenses, model-weight redistribution terms, FFmpeg build configuration, notices, and corresponding-source obligations.
12. If Tauri/WebKit or signing fails the gate, run the same engine protocol behind a minimal Electron host to make the shell decision evidence-based without changing the engine.

Do not begin feature implementation until these gates produce recorded results and the architecture is either confirmed or amended.
