# Waves Audio Studio

Waves is a completed local-first macOS audio utility for the owner's personal use. It imports local audio or one YouTube video, optionally separates the track with Demucs, and exports studio-ready files without uploading audio to a Waves service.

The source is maintained on GitHub for backup, review, and presentation. Waves is not a hosted service or public App Store product. Portfolio publication requires separate owner approval.

## Capabilities

- Import MP3, WAV, FLAC, AIFF/AIF, or M4A with a native dialog or drag/drop.
- Inspect metadata and waveform peaks without changing the source.
- Load one YouTube video and download its best available audio; playlists are rejected.
- Export Original, Vocals, Instrumental, Drums, Bass, Other, or all four native stems.
- Write WAV (24-bit), FLAC, or MP3 (320/256/192 kbps) atomically without overwriting existing files.
- Cancel processing, preview audio, reveal results in Finder, and persist local preferences.

## Supported build

Waves v1.0 is validated on the owner's Intel Mac with macOS 14 or newer. The local artifact is ad-hoc signed and not notarized. It is not a universal or Apple Silicon release.

Prerequisites for a source build:

- Node.js and npm
- Python 3.11
- Rust and Cargo
- Xcode Command Line Tools
- Homebrew FFmpeg 8

```bash
npm install
npm run engine:bootstrap
npm run engine:freeze
npm run tauri:dev
```

Build and validate the local `.app` and `.dmg`:

```bash
npm run release:local
```

Generated artifacts are under `src-tauri/target/release/bundle/` and are intentionally excluded from Git. A prebuilt GitHub download is not offered for v1.0 because the bundle is Intel-only, 467 MB compressed, ad-hoc signed, and depends on the local Homebrew FFmpeg library set. See [Portability and GitHub Distribution](docs/PORTABILITY.md).

## Documentation

- [Local development and packaging](docs/LOCAL_DEVELOPMENT.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Implementation plan and phase status](docs/IMPLEMENTATION_PLAN.md)
- [v1.0 release evidence](docs/RELEASE_1_0_RESULTS.md)
- [Privacy](PRIVACY.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## Privacy

Local-file processing stays on the computer. YouTube workflows necessarily contact YouTube and related media hosts through yt-dlp. Waves has no accounts, analytics, database, cloud storage, or telemetry.
