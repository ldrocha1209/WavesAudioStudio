# Waves Audio Studio

> **Current direction (2026-08-23):** Waves is now being completed as a local-first macOS application for the owner's personal use. The source will remain on GitHub and may be shown in a portfolio after explicit approval. Public App Store distribution, commercial hosting, accounts, cloud services, Developer ID notarization, and broad end-user support are out of scope. See [the implementation plan](docs/IMPLEMENTATION_PLAN.md) and [local development guide](docs/LOCAL_DEVELOPMENT.md).

The approved interface below began as a frontend-only design brief. Production desktop and local processing work now proceeds behind adapters so the visual direction remains intact.

Project: WAVES — Desktop Audio Processing Application

Design and build a polished, interactive frontend prototype for a desktop music-production utility called Waves.

Waves will eventually be packaged as a native desktop application. It allows music producers and other users to either paste a YouTube URL or import a local audio file, then download/process that audio and optionally separate it into stems such as vocals, instrumental, drums, bass, and other.

The original prototype phase was FRONTEND ONLY. That phase is complete; the current implementation connects the approved interface to a local desktop processing engine.

Do not implement YouTube downloading, FFmpeg, Demucs, AI processing, authentication, accounts, a database, Supabase, cloud storage, or any backend infrastructure.

Instead, create realistic mocked interactions and processing states so we can completely design and approve the user experience before connecting the real local processing engine.

DESIGN PHILOSOPHY

Waves should feel like premium professional audio software, not a website, SaaS dashboard, or generic AI application.

Take visual inspiration from modern professional audio plugins, mastering software, DAWs, and high-end creative tools.

The interface should be:

 dark

 minimal

 sophisticated

 spacious

 precise

 slightly futuristic

 understated

 professional enough for a music producer

The design should communicate a lot with very little.

Use typography, spacing, subtle illumination, hierarchy, and motion rather than filling the interface with cards, borders, icons, and decorations.

Avoid making the interface look like a conventional website.

COLOR SYSTEM

Build the design primarily around these exact colors:

Shadow Grey — #191923
Primary application background.

Platinum — #EEF1EF
Primary text, important controls, selected elements and luminous highlights.

Grey — #817F82
Secondary text, inactive controls, subtle borders and supporting UI.

Do not introduce a strong permanent accent color unless absolutely necessary.

Instead, create visual emphasis using variations of Platinum and Grey against Shadow Grey.

Selected or active elements may have a very subtle soft Platinum glow.

Avoid colorful gradients.

LIGHTING AND DEPTH

One of the defining characteristics of Waves should be extremely subtle illumination inspired by premium audio plugins.

Use effects such as:

 faint glows around selected controls

 soft illumination behind important elements

 luminous waveform edges

 extremely subtle radial lighting

 gentle shadows

 slightly brighter surfaces layered over #191923

The application should still feel almost flat and minimal.

Do NOT turn this into neon cyberpunk software.

Glows should feel sophisticated and expensive rather than flashy.

TYPOGRAPHY

Use a clean modern sans-serif typeface.

Typography should be sleek but not excessively thin and not bold/heavy.

Prefer Regular and Medium weights.

Use typography and whitespace heavily for hierarchy.

Small interface labels may use slightly increased letter spacing.

The WAVES wordmark should be simple typography rather than an elaborate logo for now.

SHAPE LANGUAGE

Use soft corners and restrained rounding.

Controls should feel tactile but minimal.

Do NOT make everything a pill.

Avoid excessive rounded cards.

Use borders sparingly.

Sections should often be separated through spacing, subtle tonal differences, or typography instead of obvious containers.

APPLICATION STRUCTURE

This should be designed for a desktop window first.

Do not design it like a vertically scrolling marketing website.

The primary application should fit naturally within a desktop window and feel like installed software.

Use a minimal top application/header area containing the WAVES identity and only essential controls.

Do not use a large conventional dashboard sidebar unless genuinely necessary.

INITIAL / EMPTY STATE

The first screen should be extremely clean.

Display the WAVES identity and subtly show:

Download. Separate. Create.

The primary workspace should allow two ways of starting:

1. Drag and drop a local audio file

Supported mock formats:

 MP3

 WAV

 FLAC

 AIFF

 M4A

2. Paste a YouTube URL

Provide a sleek URL field with a minimal action control.

The drop area should react beautifully when a file is dragged over it with subtle illumination and motion.

Do not use a giant dashed upload box like a typical website.

TRACK LOADED STATE

Once a mocked local file or YouTube URL is loaded, smoothly transition the workspace into a track-processing interface.

Show:

 album artwork or YouTube thumbnail

 track title

 artist/channel

 duration

 source

 waveform

For the prototype, populate these with realistic mock information.

Make the waveform a major visual component of the application.

It should look elegant and professional rather than decorative.

AUDIO PREVIEW

Include a minimal audio transport/player integrated with the waveform.

Include:

 play/pause

 current time

 duration

 seek position

Keep the controls understated.

Do not attempt to create a DAW.

PROCESSING OPTIONS

Add a section asking the user what they want to create from the track.

Options:

Original

Keep/download the complete original audio without stem separation.

Vocals

Instrumental

Drums

Bass

Other

All Stems

Design these options as elegant selectable controls rather than generic HTML checkboxes.

Selecting an option should create a subtle glow/illumination and smooth transition.

Make it immediately obvious which processing option is selected without using loud colors.

EXPORT SETTINGS

Provide a clean export configuration area.

Format

 WAV

 MP3

 FLAC

Quality

 Highest

 320 kbps

 256 kbps

 192 kbps

Quality choices should adapt logically to the selected format. Do not show MP3 bitrate choices as though they apply to lossless WAV/FLAC.

Save Location

Display a mocked local path such as:

~/Music/Waves

Include a Browse control that behaves as a mocked desktop file-selection interaction.

PRIMARY ACTION

Include one clear primary action:

PROCESS TRACK

It should be prominent without becoming oversized.

Give it a subtle Platinum glow/illumination on hover and when ready.

Disabled, hover, pressed and processing states should all be visually designed.

PROCESSING EXPERIENCE

When Process Track is clicked, simulate the complete processing pipeline.

Do NOT use a generic spinner as the primary loading experience.

Create an elegant processing sequence such as:

Downloading → Converting → Separating → Exporting

If the source is a local file, skip Downloading.

If Original is selected, do not pretend stem separation is occurring.

Animate progress realistically.

Consider using the waveform itself as part of the progress visualization.

Example:

Download ✓ → Convert ✓ → Separate 64% → Export

Transitions between stages should feel smooth and polished.

COMPLETION STATE

When processing finishes, transition elegantly into a completion state.

Display:

Your track is ready.

Show the generated output(s).

Provide controls for:

 Play

 Open Folder

 Process Another Track

If All Stems was selected, show:

 Vocals

 Drums

 Bass

 Other

Each stem should be individually previewable in the prototype.

ERROR STATES

Design realistic error handling as part of the prototype.

Include mocked states for:

 invalid YouTube URL

 unavailable/private video

 unsupported local file

 processing failure

 insufficient disk space

 cancelled operation

Errors should be understandable and calm.

Do not use browser alerts.

Error messages should appear naturally inside the application interface.

MOTION

Motion is an important part of the Waves identity.

Use smooth transitions approximately 180–300 ms for normal interactions.

Prefer subtle:

 fades

 slight translations

 illumination changes

 waveform animation

 opacity changes

 gentle scale feedback

Avoid excessive bouncing, dramatic scaling or flashy animations.

The application should feel responsive, fluid and expensive.

SETTINGS

Include access to a minimal Settings interface.

For the prototype, include logical future settings such as:

 default output folder

 default export format

 default quality

 hardware acceleration: Automatic

 appearance

 application information

Keep Settings visually consistent with the main application.

IMPORTANT DESIGN RESTRICTIONS

DO NOT create:

 a SaaS dashboard

 a marketing landing page

 authentication

 login/signup

 pricing

 subscriptions

 cloud features

 database functionality

 excessive glassmorphism

 colorful AI gradients

 neon cyberpunk aesthetics

 giant rounded cards

 pill-shaped everything

 excessive icons

 excessive borders

 generic stock illustrations

 chat interfaces

 playlist functionality

Do not add features outside the described product scope.

DEVELOPMENT REQUIREMENTS FOR THIS PROTOTYPE

Build reusable React/TypeScript components.

Use Tailwind and the project's component system appropriately, but customize components heavily enough that the application does not look like a default shadcn template.

Keep processing logic mocked and separated from UI components so that the mock implementation can later be replaced with calls to a real local desktop backend.

Organize the frontend so it can later be adapted for a desktop shell such as Tauri.

Avoid browser-specific assumptions where possible.

Create clean state management for:

empty → loading track → track ready → configuring → processing → complete → error

Use realistic sample data so every state can be evaluated visually.

MOST IMPORTANT GOAL

When someone first sees Waves, it should look like professional music-production software that happens to be simple to use.

It should NOT look like a YouTube downloader website with an AI stem remover attached to it.

The interface should make this workflow feel effortless:

Track in → choose what you want → Waves processes it → finished audio out.

Prioritize refinement, visual hierarchy, restraint, responsive interaction, and excellent desktop UX over adding more features.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c3bb8328-de3f-4250-aee9-50a88fe99101).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
