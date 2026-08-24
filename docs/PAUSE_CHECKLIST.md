# Waves Phase 0 Handoff Checklist

Phase 0 paused on 2026-08-20 and resumed on 2026-08-23 with authorization to finish the local-first application sequentially.

## Current state

- Working tree is on `main`; no commit, push, or pull request has been created.
- `youtube-to-mp3-reference/`, `stem-remover-reference/`, and `media/` were not modified.
- Phase 0 architecture proof is complete for the current Intel Mac. The decision is Tauri 2 + Rust-managed Python on-directory engine + versioned JSONL IPC.
- The approved Lovable interface was preserved. Only a small desktop-engine proof status was added.
- Phase 0 results and the architectural decision are documented in `PHASE_0_RESULTS.md` and `ADR-001-DESKTOP-ENGINE.md`.

## Checkpoint 1 readiness

1. Completed: removed the obsolete generated one-file binary at `src-tauri/binaries/waves-engine-x86_64-apple-darwin`.
2. Completed: added `npm run engine:bootstrap`, `npm run engine:freeze`, and `npm run phase0:verify`.
3. Decided: the audit, architecture proof, local-scope update, and reproducible build form checkpoint 1.
4. Completed: generated environments, caches, targets, frozen binaries, and DMGs remain ignored.
5. Completed on the development machine: the frozen engine, static frontend, Rust host, `.app`, and `.dmg` rebuilt successfully on 2026-08-23.

## Validation already completed

- Python engine tests: 7/7 passed.
- CPU Demucs fixture separation passed.
- Instrumental reconstruction maximum absolute difference: 0.0.
- yt-dlp metadata/download and FFmpeg WAV/FLAC/MP3 export smoke tests passed.
- FFmpeg, yt-dlp, and Demucs process cancellation tests passed with no surviving child processes.
- Packaged Tauri host launched the on-directory engine and left no orphan after shutdown.
- Ad-hoc-signed local app verified with `codesign --verify --deep --strict`.
- DMG verified with `hdiutil verify`.
- Reference repositories remain clean.

## Explicitly deferred

- Full bundled Torch/Demucs/FFmpeg engine.
- Apple Silicon and MPS measurements.
- Exact redistributable FFmpeg/license inventory.
- Representative listening-quality tests.
- Developer ID signing, notarization, stapling, and clean-machine Gatekeeper testing.
- Phase 1 production lifecycle: health timeout, crash UX, explicit restart policy, single-instance behavior, and typed bridge contracts.

## Resumption decision

The project will use approximately five logical commit/push checkpoints. Phase 1 starts only after the reproducible engine build and Phase 0 validation pass. Public notarization and portfolio publication are not part of the implementation gate; portfolio publication requires separate user approval.

## Pull request status

No PR was opened because the request to create one was tentative and no PR base/branch or commit boundary was confirmed. The repository remote is `origin` (`ldrocha1209/WavesAudioStudio`), and the current branch is `main`.
