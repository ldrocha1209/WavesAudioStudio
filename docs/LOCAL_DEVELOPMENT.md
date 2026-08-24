# Waves Local Development

Waves is a personal, local-first macOS desktop application. The supported development machine is the owner's Mac; GitHub and a possible portfolio entry are presentation surfaces, not public-service infrastructure.

## Prerequisites

- macOS 14 or newer
- Node.js and npm
- Python 3.11
- Rust and Cargo
- Xcode Command Line Tools
- FFmpeg for development smoke tests

The final local bundle is intended to carry its runtime dependencies. Development commands remain explicit so a clean checkout can be reproduced.

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

The repository should always contain source and reproducible build instructions, never generated virtual environments, model caches, Tauri targets, or frozen binaries. If the finished bundle is reasonably portable, an unsigned GitHub Release asset may be added as a convenience; source-based local setup remains the reliable fallback.
