# Waves Architecture and Codebase Audit

Status: architecture audit only  
Date: 2026-08-20  
Repositories audited: `waves-app`, `youtube-to-mp3-reference`, and `stem-remover-reference`

## Executive summary

The approved `waves-app` interface is a well-separated React/TypeScript prototype whose visual components and user-flow model should be preserved. Its current processing, playback, file selection, folder selection, errors, and outputs are deliberately mocked; none should be treated as production backend logic.

The two older repositories prove only small pieces of the product concept. They do not provide a production foundation:

- `youtube-to-mp3-reference` demonstrates basic `yt_dlp.YoutubeDL` embedding, an FFmpeg audio postprocessor, a folder chooser, and a progress hook. The operation runs synchronously on the Qt UI thread, depends on `ffmpeg` being on `PATH`, has no cancellation, weak URL/error handling, unsafe output behavior, and essentially no tests.
- `stem-remover-reference` demonstrates loading `htdemucs`, decoding with Demucs `AudioFile`, calling `apply_model`, mapping `model.sources`, and writing a stem. It is a synchronous FastAPI/PostgreSQL/account application, eagerly loads the model, holds whole uploads and outputs in memory, does not choose a device, has no progress or cancellation, and exposes unsafe file/path and operational behavior. Its web, authentication, database, and hosting infrastructure is outside Waves' scope.

No substantial function from either reference repository should be copied verbatim into Waves. Their useful value is behavioral evidence and a few API concepts. Production code should be newly implemented behind explicit downloader, FFmpeg, separator, filesystem, and job interfaces.

## Audit method and limits

The audit inspected every runtime source file, manifest, test file, README, ignore file, and the recent repository history. Both reference worktrees were left unchanged. `media/` was observed but not read into the architecture, changed, or made a dependency. The frontend dependencies were not installed during this session, so no build was run; the committed lockfile was inspected instead.

This audit does not verify live YouTube behavior, benchmark Demucs, freeze PyTorch, sign an application, or test a desktop shell. Those are intentionally Phase 0 proof-of-concept tasks.

## 1. `waves-app`: current production repository

### Current architecture

`waves-app` is a Lovable-generated TypeScript application built around:

- React 19 and React DOM.
- Vite 8.
- TanStack Router and TanStack Start.
- Tailwind CSS 4.
- Radix UI primitives and shadcn-style local UI components.
- A single route (`src/routes/index.tsx`) composing Waves-specific components.
- A local React hook (`src/lib/waves/useWaves.ts`) as the prototype state controller.
- A replaceable mock processing adapter (`src/lib/waves/pipeline.ts`).

The current build is web/SSR-oriented. `vite.config.ts` points TanStack Start at `src/server.ts`, and the Lovable configuration supplies Nitro with a Cloudflare default target. `src/start.ts`, `src/server.ts`, and the SSR error wrappers are appropriate for the current hosted prototype, but a packaged desktop build should not start a web server or require Cloudflare/Nitro at runtime. TanStack Start supports a client-only SPA output, so the frontend can be adapted rather than rewritten.

### Useful frontend seams

- `src/lib/waves/types.ts` already names the core concepts: source kind, track, requested result, export settings, pipeline stages, output files, errors, and application phase.
- `src/lib/waves/pipeline.ts` explicitly documents that it is an adapter seam intended to be replaced by desktop IPC.
- `src/lib/waves/useWaves.ts` keeps orchestration out of the visual components.
- `src/components/waves/EmptyState.tsx` contains the approved drop interaction.
- `src/components/waves/ProcessingPanel.tsx` already accepts stage and overall progress data.
- `src/components/waves/ExportPanel.tsx` and `SettingsPanel.tsx` already distinguish MP3 bitrates from lossless quality.
- `src/components/waves/CompletePanel.tsx` already represents multiple outputs and the Finder action.

### Prototype-only behavior that must not leak into production

- `EmptyState` passes only `file.name`, not a usable native path or file handle.
- `ExportPanel` and `SettingsPanel` cycle through `MOCK_FOLDERS` instead of native dialogs.
- `usePlayback` advances a timer without decoding or playing audio.
- `pipeline.ts` uses `requestAnimationFrame` timings, and its cancellation only cancels animation.
- `classifyUrl` is a narrow regular expression. It is neither authoritative validation nor a YouTube availability check.
- `isSupportedFile` checks only a filename extension. It does not verify the real container/codec or file readability.
- `buildOutputs` performs presentation-only sanitization and predicts sizes; it is not a safe path allocator.
- `ERROR_COPY` contains a hard-coded disk-space amount and collapses many failures into two processing errors.
- settings live only in React memory.
- completion actions and previews are simulated.

### Dependency and maintenance observations

The committed dependency graph is modern but unusually fast-moving. `package.json` contains exact and caret ranges mixed across TanStack packages, while the lockfile resolves internal TanStack packages to several different patch versions. Nitro is a dated beta build and the Lovable Vite adapter supplies substantial implicit configuration. This is workable for the approved prototype, but desktop conversion should:

1. preserve the UI components and CSS;
2. make a distinct desktop/static build target;
3. remove SSR/Nitro from the packaged runtime path;
4. align and pin the TanStack package family after a clean build/test baseline; and
5. avoid broad dependency upgrades during desktop integration.

Unused UI packages should not be removed during the architecture work merely to reduce the JavaScript bundle. The PyTorch side dominates packaged size; UI dependency cleanup can be a later measured task.

## 2. `youtube-to-mp3-reference`: current architecture

### Structure and flow

The repository is a BeeWare Briefcase/PySide6 application:

1. `src/YT2MP3/__main__.py` builds a `QWidget` UI.
2. `download_mp3()` validates a URL prefix and output directory.
3. It performs a socket connection to `8.8.8.8:53` as an internet check.
4. It shells out to `which ffmpeg` through `os.system`.
5. It configures `YoutubeDL` with `bestaudio/best` and `FFmpegExtractAudio` to 192 kbps MP3.
6. It calls `ydl.download([url])` directly from the button handler.
7. A progress hook appends generic status messages to the UI.

`src/YT2MP3/app.py` is a separate, generated Briefcase skeleton and is not the implementation in `__main__.py`. That split suggests the packaged entrypoint and the implemented GUI may have diverged. `pyproject.toml` declares Briefcase, PySide6 Essentials, and unpinned `yt_dlp`; it does not bundle FFmpeg. The only substantive test asserts `1 + 1 == 2`.

### Keep

Keep these ideas as evidence, not whole modules:

- Embed yt-dlp through its Python API rather than scraping YouTube directly (`__main__.py:90-106`).
- Use a yt-dlp progress hook as one source of structured download telemetry (`__main__.py:100,114-118`).
- Request the best available audio before final export (`__main__.py:91`).
- Let the user choose a destination through a native folder dialog (`__main__.py:48-52`).
- Keep processing local and present status in the application rather than launching a terminal.

There is no production-grade function here that merits verbatim reuse. Reusing the short options dictionary would also preserve its unsafe output and forced-transcode behavior, so it should be rewritten.

### Reimplement

- URL admission: parse a single HTTP(S) URL, restrict supported hosts/intent, reject playlists and playlist expansion, then let yt-dlp perform authoritative extraction.
- Metadata: call `extract_info(..., download=False)` through an adapter and map only trusted fields (video ID, title, uploader/channel, duration, thumbnail URL, availability) into a Waves schema.
- Download selection: fetch best practical source audio into a job-private workspace without first converting to MP3.
- Progress: normalize bytes, total estimate, speed, ETA, phase, and postprocessor events; throttle GUI updates.
- FFmpeg integration: pass an explicit bundled `ffmpeg`/`ffprobe` directory, never depend on `PATH`.
- Cancellation: cooperatively stop hooks where possible and terminate the owned download/postprocessor process tree when required.
- Error mapping: map yt-dlp/network/extractor/auth/availability failures into stable Waves error codes while retaining diagnostics in local logs.
- Naming and output allocation: sanitize metadata, enforce path containment, reserve collision-free names, and publish atomically.
- Packaging and updates: pin a tested yt-dlp release in each signed Waves build, run extractor smoke tests, and ship rapid signed application updates. Do not allow an arbitrary repository or unverified binary self-update.

### Discard

- The PySide UI and duplicate Briefcase skeleton. The approved React UI replaces both.
- Briefcase as the application shell for Waves.
- Synchronous work in the button callback.
- The `8.8.8.8` connectivity probe. It can fail on otherwise usable networks and says nothing about YouTube reachability.
- `os.system("which ffmpeg ...")` and every `PATH` assumption.
- `url.startswith("http")` validation.
- Direct exception text in the UI and the special-case string search for HTTP 403.
- Forced 192 kbps conversion during acquisition.
- A title-only output template that can collide or contain problematic metadata.
- Claims of universal/macOS packaging that are not backed by bundled FFmpeg, signing/notarization configuration, or meaningful tests.

### Reliability, security, and technical debt

- `ydl.download` blocks the Qt main thread, so the window can freeze for download and conversion.
- There is no timeout policy, retry policy, cancellation, shutdown coordination, or partial-file cleanup.
- The output can overwrite or conflict depending on yt-dlp behavior and existing files.
- User-controlled metadata participates in paths without a Waves-owned allocator.
- Full exception strings may expose internal paths or overly technical details.
- A generic progress hook emits repeated text rather than numerical progress.
- `no_warnings=True` hides potentially actionable diagnostics.
- `quiet=False` writes uncontrolled logs to the packaged application's standard streams.
- `yt_dlp` is unpinned, so builds are not reproducible.
- No FFmpeg dependency is declared or packaged.
- No tests exercise command options, progress, errors, paths, or output.

## 3. `stem-remover-reference`: current architecture

### Structure and flow

This repository is a hosted FastAPI application with a vanilla web frontend:

- `main.py` creates upload/output directories relative to the current working directory, creates SQLAlchemy tables, configures cookie sessions, mounts static files, defines signup/login/logout routes, and exposes `/isolate`.
- `db.py`, `models.py`, and `auth_utils.py` implement PostgreSQL accounts.
- `main.py:90-92` eagerly loads `htdemucs` during module import/application startup.
- `/isolate` reads an entire `UploadFile` into memory, writes it under `temp_uploads`, calls `isolate_stem` synchronously, and streams an in-memory WAV.
- `isolate.py` validates extensions and stems, decodes/resamples through Demucs `AudioFile`, forces mono to stereo, calls `apply_model(split=True, overlap=0.25)`, selects a source by `model.sources`, writes a WAV to `BytesIO`, and deletes the uploaded file in `finally`.
- The browser sends one request, displays an indefinite spinner, receives the entire output blob, and creates an object URL.

### Keep

Keep these processing concepts as evidence:

- Use the model's declared `samplerate` and `sources`, rather than hard-coding tensor indexes (`isolate.py:37-58`).
- Normalize channel shape deliberately, including mono-to-stereo handling (`isolate.py:47-52`).
- Use chunked/split inference and overlap to constrain memory and reduce seam artifacts (`isolate.py:55`).
- Move output tensors to CPU before file encoding (`isolate.py:58-65`).
- Ensure job-owned inputs are cleaned in a `finally`-equivalent lifecycle (`isolate.py:82-86`).
- Load a model once when repeated stem jobs benefit from it (`main.py:90-92`), but only lazily after a separation request.

No full function should be copied directly. In addition to reliability problems, the reference repository uses MPL-2.0 while Waves' eventual licensing has not been decided; clean implementation avoids unnecessary source-file license obligations and preserves a clear provenance boundary.

### Reimplement

- A framework-neutral separation service with typed requests/results and no FastAPI dependency.
- Lazy, explicit model acquisition from a packaged, verified model location.
- Runtime device detection, health checks, controlled CPU fallback, and device-specific diagnostics.
- File probing and canonical decoding using the bundled FFmpeg layer.
- Streaming/file-backed intermediates rather than whole-track upload/output buffers.
- Separation progress based on planned segments/windows, not an indefinite HTTP request.
- Cancellation in a dedicated worker process, because `apply_model` does not provide reliable fine-grained cancellation for every model path.
- Output writing through the same secure filesystem/export layer as Original downloads.
- Error normalization for decode, model, device, memory, disk, cancellation, and encoding failures.
- Resource policy: one heavy separation job at a time in v1; bounded threads/processes; memory and disk preflight.
- Cleanup using per-job manifests and job-private directories, never a filename supplied by a client.

### Discard

- FastAPI, Uvicorn, routes, multipart upload, streaming HTTP responses, and localhost/server assumptions.
- Accounts, sessions, cookies, password hashing, email validation, SQLAlchemy, PostgreSQL, and Render deployment.
- The old HTML/CSS/JavaScript interface.
- Relative global folders (`temp_uploads`, `uploads`, `outputs`) created at import time.
- Database creation and model loading as import side effects.
- The default session secret, non-HTTPS cookie configuration, and all authentication code.
- The 100 MB HTTP `Content-Length` middleware; it is both irrelevant to local files and bypassable when the header is missing.
- Returning raw exception details to clients.
- Buffering input and output audio entirely in memory.

### Reliability, security, performance, and technical debt

- `get_model` at import makes every launch pay model initialization and can prevent the app from starting if weights/runtime fail.
- The async endpoint performs synchronous CPU/GPU inference on its event-loop execution path, blocking other requests and offering no cancellation.
- There is no `model.to(device)` or input device transfer; acceleration is not implemented.
- The entire upload is read by `await file.read()`, and the full WAV is retained in `BytesIO`, producing avoidable memory spikes.
- `uuid + file.filename` is not safe path handling. A filename containing separators/traversal components can escape the intended naming scheme on some platforms, and untrusted filenames are reflected into response headers.
- Extension checking is not content validation; `.aif` is missing even though Waves wants AIFF support.
- Cleanup deletes the input in `isolate_stem` itself, coupling inference with ownership and making reuse with user-owned files dangerous. Production code must never pass a user source to code that unconditionally deletes it.
- `finally` cleanup covers the copied upload but not shutdown/crash or other orphaned job artifacts.
- Generic `except Exception` catches `HTTPException` and turns client errors into 500 responses.
- Raw `details: str(e)` leaks implementation details.
- There is no disk-space preflight, atomic output, collision handling, cancellation, progress, timeout, recovery, or test suite.
- `torchaudio` and `get_model` imports in `isolate.py` are unused, indicating dependency and module-boundary drift.
- Code after the `finally` return path is unreachable.
- The model output is encoded directly to default WAV subtype without an explicit quality contract.

## 4. Dependency and version compatibility risks

### Demucs maintenance status

The original Meta Demucs repository was archived in January 2025 and identifies itself as unmaintained; the maintainer's fork accepts only important fixes. `demucs==4.0.1` is therefore a major long-term risk, not a normal actively maintained dependency. Waves must freeze and regression-test a known-compatible inference stack, maintain an internal adapter, and evaluate a maintained inference-only fork or a narrowly vendored compatibility patch only after legal and quality review.

### Old pinned Python stack

The reference pins Demucs 4.0.1, Torch/Torchaudio 2.2.2, NumPy 1.24.4, and SoundFile 0.13.1. Those versions predate the target architecture date and may conflict with current Python versions, PyInstaller hooks, current macOS deployment targets, current MPS fixes, and current FFmpeg/Torchaudio decoding changes. Conversely, blindly upgrading Torch can break Demucs APIs or numerical output. The complete matrix—Python, Torch, Torchaudio, Demucs, NumPy, SoundFile, PyInstaller, OS target, architecture—must be locked and tested as one artifact.

### yt-dlp changes

Current yt-dlp requires modern Python and strongly recommends FFmpeg/FFprobe, `yt-dlp-ejs`, and a supported JavaScript engine for full YouTube support. A frozen app therefore has more runtime obligations than the old repository records. YouTube extractor changes are routine; a release process and smoke-test lane are mandatory.

### Frontend graph

The frontend uses current React/Vite/Tailwind and an RC-era TanStack Start/Nitro stack. Desktop packaging should pin the last known-good graph and use an explicit SPA build. It should not package the Nitro server. The Tauri integration proof must verify asset URLs, routing, drag/drop, CSP, development mode, and production `tauri://localhost` behavior.

## 5. Audio and stem findings

### Instrumental and individual outputs

The official Demucs documentation states that `--two-stems=vocals` still performs full separation and mixes the complementary sources; it is not faster and does not use less memory. Therefore:

- Run one four-source `htdemucs` inference for any non-Original request.
- For Vocals, Drums, Bass, or Other, export only the requested result but expect roughly full inference cost.
- For All Stems, export the four native results.
- For Instrumental, sum drums + bass + other from the same inference in float precision, then encode once. This is equivalent in concept to Demucs accompaniment/two-stem behavior while keeping one tested processing path.
- Do not run a second two-stem pass after a four-stem pass.

A prototype must compare this sum against Demucs two-stem output sample-for-sample/tolerance-wise and perform listening tests before the behavior is frozen.

### Quality-preserving internal pipeline

The old downloader's `YouTube -> MP3 192 kbps` acquisition is unsuitable for separation. The recommended pipeline is:

1. retain the best practical source audio stream in its downloaded container;
2. probe it with bundled `ffprobe`;
3. decode/resample once to the separator's expected stereo sample rate using a lossless float32 WAV intermediate (or an equivalently tested file-backed tensor path);
4. retain separation output as float32 until final export;
5. encode WAV/FLAC losslessly or MP3 once at the selected bitrate;
6. avoid normalization or other creative processing in v1; handle clipping according to an explicit tested policy.

For Original, skip Demucs and avoid conversion stages that are not required by the selected export. A compatible local source may be copied only when that exactly satisfies the requested output contract; otherwise decode/encode once. A YouTube source must never be converted to an intermediate MP3 before another encode.

## 6. FFmpeg audit conclusion

Waves must bundle platform/architecture-specific `ffmpeg` and `ffprobe` executables and resolve them from signed application resources. Commands must be constructed as argument arrays with no shell, explicit input/output paths, `-nostdin` except where a controlled progress pipe is used, `-progress pipe:1` (or equivalent machine-readable reporting), and predictable overwrite flags applied only to job-private files.

Distribution must select and document the exact build configuration. FFmpeg is LGPL by default but becomes GPL when GPL components are enabled. Before distribution, legal review must confirm the selected binary's license, notices, corresponding-source/build-script obligations, and codec/patent implications. The binary version and build configuration should appear in diagnostics.

FFmpeg should be updated only through a tested, signed Waves release initially. A separately updatable media-tool bundle would complicate code signing, notarization, compatibility, and rollback and is not justified for v1.

## 7. Largest risks

1. **Frozen Python/ML artifact:** packaging Torch, Demucs, model weights, native libraries, and FFmpeg into a signed/notarized Apple Silicon application.
2. **Demucs sustainability:** upstream is archived, and new Torch/Torchaudio releases can break the old inference stack.
3. **Real MPS value:** availability does not guarantee model correctness, stability, or speed; MPS may be slower than CPU for this workload and needs benchmarking.
4. **Cancellation semantics:** terminating Demucs safely requires process isolation and loses a cached model after forceful cancellation.
5. **YouTube churn:** extractor and JavaScript runtime requirements change independently of Waves.
6. **Installer size/startup:** Torch plus native libraries and bundled tools may produce a very large application. Windows CUDA can be substantially larger than CPU-only distributions.
7. **Nested code signing:** the Tauri host, Python sidecars/workers, Python native extensions, FFmpeg/FFprobe, and any JS runtime must all be correctly placed and signed before notarization.
8. **Protocol/lifecycle correctness:** crashes, shutdown, late events, cancellation races, and cleanup must not corrupt job state or delete user data.
9. **Output correctness:** collision-free atomic publishing across filesystems and all-stems groups must be proven.
10. **Frontend build conversion:** the Lovable/TanStack SSR build needs a clean static desktop target without visual regressions.

## 8. Direct reuse decision table

| Area | Keep directly | Reimplement cleanly | Discard |
|---|---|---|---|
| Approved Waves UI | Waves visual components, CSS, composition, interaction direction | Native adapters, real state/events, accessibility around dialogs/drop | Mock timers, fake files/folders, fake playback |
| Waves domain model | Names and broad UI concepts in `types.ts` | Versioned backend protocol and richer error/job schemas | Prototype-only assumptions such as string paths from the DOM |
| Downloader | No whole production function | Python API integration, metadata, progress, cancellation, errors, secure output | PySide, UI-thread work, connectivity probe, PATH FFmpeg, forced 192 MP3 |
| Stem engine | No whole production function | Model/source mapping, channel normalization, split inference, device/resource management | FastAPI, accounts, DB, uploads, eager import-time loading, in-memory HTTP result |
| Packaging | Existing icon may be design reference only | Tauri application bundle, frozen sidecars, nested signing/notarization | Briefcase configuration and hosted Render assumptions |
| Tests | None of the old assertions provide coverage | Full unit/contract/integration/package test suites | Live-download-dependent default tests |

## 9. Primary references used for volatile decisions

- [Tauri 2: embedding external binaries](https://v2.tauri.app/develop/sidecar/)
- [Tauri 2: distribution](https://v2.tauri.app/distribute/)
- [TanStack Start: SPA mode](https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode)
- [yt-dlp README: embedding, dependencies, and update channels](https://github.com/yt-dlp/yt-dlp/blob/master/README.md)
- [Demucs README: models, two-stem behavior, output, and memory](https://github.com/facebookresearch/demucs/blob/main/README.md)
- [PyTorch MPS backend](https://docs.pytorch.org/docs/stable/notes/mps.html)
- [FFmpeg legal and license guidance](https://ffmpeg.org/legal.html)
- [Apple notarization requirements](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)

