import artworkLocal from "@/assets/artwork-local.jpg";
import artworkYoutube from "@/assets/artwork-youtube.jpg";
import type { AudioFormat, OutputFile, Quality, StemId, Track } from "./types";

/** Deterministic pseudo-random peak generator so waveforms stay stable across renders. */
export function generatePeaks(seed: number, count = 220): number[] {
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  const peaks: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / count;
    // musical envelope: intro, build, drop, outro
    const envelope =
      0.35 +
      0.45 * Math.sin(Math.PI * Math.min(1, t * 1.15)) +
      0.12 * Math.sin(t * 34) +
      0.08 * Math.sin(t * 7.3);
    const noise = 0.55 + rand() * 0.65;
    peaks.push(Math.max(0.06, Math.min(1, envelope * noise * 0.82)));
  }
  return peaks;
}

export const SUPPORTED_EXTENSIONS = ["mp3", "wav", "flac", "aiff", "aif", "m4a"];

export const MOCK_LOCAL_TRACK: Omit<Track, "source" | "title"> = {
  id: "local",
  artist: "Sable Kane",
  duration: 247,
  sourceKind: "file",
  artwork: artworkLocal,
  peaks: generatePeaks(97),
};

export const MOCK_YOUTUBE_TRACK: Omit<Track, "source"> = {
  id: "yt",
  title: "Nightfold (Extended Mix)",
  artist: "Halcyon Tapes",
  duration: 383,
  sourceKind: "youtube",
  artwork: artworkYoutube,
  peaks: generatePeaks(451),
};

export const STEM_OPTIONS: { id: StemId; label: string; hint: string }[] = [
  { id: "original", label: "Original", hint: "Full mix, no separation" },
  { id: "vocals", label: "Vocals", hint: "Lead and backing voice" },
  { id: "instrumental", label: "Instrumental", hint: "Everything but vocals" },
  { id: "drums", label: "Drums", hint: "Kit and percussion" },
  { id: "bass", label: "Bass", hint: "Low end" },
  { id: "other", label: "Other", hint: "Keys, guitars, synths" },
  { id: "all", label: "All Stems", hint: "Four separated files" },
];

export const FORMATS: AudioFormat[] = ["WAV", "MP3", "FLAC"];

export function qualitiesFor(format: AudioFormat): [Quality, ...Quality[]] {
  return format === "MP3" ? ["320 kbps", "256 kbps", "192 kbps"] : ["Highest"];
}

export const MOCK_FOLDERS = [
  "~/Music/Waves",
  "~/Music/Ableton/Samples",
  "~/Desktop/Stems",
  "/Volumes/SSD/Sessions",
];

const EXT: Record<AudioFormat, string> = { WAV: "wav", MP3: "mp3", FLAC: "flac" };

export function buildOutputs(track: Track, stem: StemId, format: AudioFormat): OutputFile[] {
  const base = track.title.replace(/[^\w\s-]/g, "").trim();
  const ext = EXT[format];
  const size = (factor: number) => {
    const mb =
      (track.duration / 60) * (format === "WAV" ? 10.6 : format === "FLAC" ? 6.2 : 2.4) * factor;
    return `${mb.toFixed(1)} MB`;
  };
  const make = (id: string, label: string, seed: number, factor = 1): OutputFile => ({
    id,
    label,
    filename: `${base} — ${label}.${ext}`,
    size: size(factor),
    peaks: generatePeaks(seed),
  });

  if (stem === "all") {
    return [
      make("vocals", "Vocals", 11, 0.9),
      make("drums", "Drums", 23, 0.85),
      make("bass", "Bass", 37, 0.8),
      make("other", "Other", 53, 0.95),
    ];
  }
  const label = STEM_OPTIONS.find((o) => o.id === stem)?.label ?? "Original";
  return [make(stem, label, 71)];
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

const YT_PATTERN =
  /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=[\w-]{6,}|youtu\.be\/[\w-]{6,})/i;

export function classifyUrl(url: string): "valid" | "invalid-url" | "unavailable-video" {
  const trimmed = url.trim();
  if (!YT_PATTERN.test(trimmed)) return "invalid-url";
  if (/private|unavailable/i.test(trimmed)) return "unavailable-video";
  return "valid";
}

export function isSupportedFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return SUPPORTED_EXTENSIONS.includes(ext);
}

export function titleFromFilename(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
}
