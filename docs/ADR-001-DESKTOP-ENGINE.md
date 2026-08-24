# ADR-001: Desktop shell and processing-engine boundary

Status: Accepted for Phase 1, with external validation gates

Date: 2026-08-20

## Context

Waves must preserve its approved React interface, remain responsive during long native operations, use the Python audio/AI ecosystem, and install like a normal local application. The most uncertain boundary was the relationship among the WebView, desktop host, frozen Python, subprocess tools, signing, and cancellation.

## Decision

Use:

```text
React static frontend
        │ typed Tauri commands/events
Tauri 2 / Rust host
        │ bounded JSONL over stdin/stdout
Python on-directory supervisor
        │ owned process groups
  yt-dlp   FFmpeg   Demucs workers
```

- Tauri owns application lifecycle, trusted file dialogs/paths, and the engine process.
- The Python supervisor is packaged as an on-directory resource, never one-file.
- Requests and events are versioned JSONL frames with a 64 KiB control-frame limit. Binary audio never crosses IPC.
- Stdout is protocol-only; diagnostics go to stderr.
- The job manager belongs in the Python engine. Rust supervises process health; React renders typed state and requests cancellation.
- Torch and Demucs load lazily in a separation worker. Downloads and original exports must not pay their startup or memory cost.
- FFmpeg, yt-dlp support, models, and Python are resolved from fixed app-owned locations, not `PATH`.
- Each interruptible tool runs in an owned process group. Cancellation is cooperative first, then terminate, bounded wait, and kill.
- The first production target is macOS 14 or newer. Intel remains usable through CPU fallback; Apple Silicon/MPS is preferred only after its external gate passes.

## Why

The packaged proof preserved the UI, required no runtime server, established ordered progress and cancellation, and demonstrated reliable ownership of a bundled engine. Keeping native process authority in Rust limits the WebView's privileges. Keeping audio and AI behavior in Python avoids a risky ecosystem rewrite. JSONL is inspectable, stream-friendly, easy to fixture-test, and avoids introducing a localhost server and port/security lifecycle.

The proof rejected PyInstaller one-file because of severe launch delay and a concrete macOS nested-signature failure. On-directory packaging is larger but faster, observable, signable, and maintainable; application reliability has priority over compressed installer size.

## Consequences

- There are three explicit contract surfaces: React↔Rust commands/events, Rust↔Python JSONL, and Python↔tool argument/result adapters.
- The app will be large once Torch and models are bundled. That is accepted.
- Separate x86_64 and arm64 builds are preferable initially. Universal native AI bundles would multiply size and signing complexity.
- A crashed job is reported, not silently retried. The engine can be restarted cleanly after teardown, but restart policy is a Phase 1 lifecycle concern.
- Direct distribution uses Developer ID signing/notarization when desired; the Mac App Store sandbox is out of scope.

## Rejected alternatives

- Electron: larger duplicated runtime and no benefit that offsets Tauri's successful proof.
- Local HTTP/FastAPI: adds ports, server lifecycle, attack surface, and protocol overhead for a single local parent/child relationship.
- Embedding CPython in Rust: tighter ABI, native-library, crash-isolation, and packaging coupling.
- Browser-launched arbitrary commands: excessive authority and poor lifecycle control.
- PyInstaller one-file: slow launch and failed nested runtime signing in the real app proof.
- Rewriting Demucs/yt-dlp in Rust: high maintenance risk and no reliability benefit.

## Validation gates

Before claiming an Apple Silicon production package, freeze the complete arm64 engine, test MPS and CPU fallback, sign every nested native artifact with one Developer ID identity, notarize/staple, and run a clean-machine Gatekeeper test. Failure of that gate triggers evaluation of a relocatable managed Python distribution or Nuitka; it does not imply replacing Tauri or the JSONL contract.
