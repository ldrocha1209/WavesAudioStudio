# Troubleshooting

## The app will not open

The local build is ad-hoc signed, not notarized. Open **System Settings → Privacy & Security** and approve Waves if macOS blocks the first launch. Build from source if the artifact came from another machine.

## The engine is unavailable

Run `npm run engine:freeze`, then restart Waves. The app expects `engine/dist/waves-engine-onedir/waves-engine` during development and the matching resource inside the packaged app.

## FFmpeg or FFprobe is missing

Install FFmpeg before building (`brew install ffmpeg`) and rerun `npm run engine:freeze`. The build copies the selected local binaries into the engine resource tree.

## The first separation cannot load the model

Run `npm run smoke:separation -- engine/phase0-fixtures/synthetic.wav --device "CPU only"` while online. This populates the pinned local model cache; then rebuild the engine so the cache is included.

## YouTube extraction stops working

YouTube changes frequently. Update only the yt-dlp dependency family, rerun deterministic tests and `npm run smoke:youtube -- <permitted-video-url>`, then rebuild the app. Do not enable arbitrary in-app self-updates.

## Processing is slow

The validated Intel path uses CPU. A 3-second fixture can take tens of seconds depending on cold model load. Original exports do not load Torch/Demucs. Apple Silicon/MPS is optional and unverified on the current machine.

## A destination is denied

Use the **Browse** control again. Path grants are intentionally kept in memory and are not silently restored across app restarts, except for the default `~/Music/Waves` destination.
