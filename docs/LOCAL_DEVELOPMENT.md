# Waves Local Development

Waves is a personal, local-first macOS desktop application. The supported development machine is the owner's Mac; GitHub and a possible portfolio entry are presentation surfaces, not public-service infrastructure.

## Prerequisites

- macOS 14 or newer
- Node.js and npm
- Python 3.11
- Rust and Cargo
- Xcode Command Line Tools
- FFmpeg for development smoke tests

The local build copies FFmpeg, FFprobe, and Node (used by yt-dlp's JavaScript challenge support) into the engine resource tree. The current Homebrew FFmpeg executables remain dynamically linked to the owner's installed Homebrew libraries, so FFmpeg must remain installed on this Mac. Development commands are explicit so a clean checkout can be reproduced.

## First setup

```bash
npm install
npm run engine:bootstrap
```

The Python environment is created at `engine/.venv` and all Python dependencies are installed from the pinned `engine/requirements-lock.txt` file.

## Validate the architecture proof

```bash
npm run phase0:verify
```

This runs the engine protocol tests, rebuilds the frozen on-directory engine, builds the static desktop frontend, and checks the Rust host.

## Run the desktop app

```bash
npm run engine:freeze
npm run tauri:dev
```

## Build the local application

```bash
npm run engine:freeze
npm run tauri:build
```

The generated `.app` and `.dmg` are local, ad-hoc-signed development artifacts. macOS may require the owner to approve the app in Privacy & Security. Developer ID notarization is not a completion requirement for this personal-use project.

## GitHub distribution

The repository contains source and reproducible build instructions, never generated virtual environments, model caches, Tauri targets, or frozen binaries. No v1.0 binary release is published: the artifact is Intel-only, ad-hoc signed, 467 MB compressed, dynamically linked to Homebrew libraries, and requires a separate GPL distribution review. Source-based local setup is the reliable path.
