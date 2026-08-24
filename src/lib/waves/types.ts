export type SourceKind = "file" | "youtube";

export interface Track {
  id: string;
  title: string;
  artist: string;
  /** seconds */
  duration: number;
  source: string;
  sourceKind: SourceKind;
  artwork: string;
  peaks: number[];
  sourcePath?: string;
  sourceUrl?: string;
}

export type StemId = "original" | "vocals" | "instrumental" | "drums" | "bass" | "other" | "all";

export type AudioFormat = "WAV" | "MP3" | "FLAC";
export type Quality = "Highest" | "320 kbps" | "256 kbps" | "192 kbps";

export interface ExportSettings {
  format: AudioFormat;
  quality: Quality;
  location: string;
}

export type StageId = "download" | "convert" | "separate" | "export";

export interface Stage {
  id: StageId;
  label: string;
  /** 0..1 */
  progress: number;
  status: "pending" | "active" | "done";
}

export interface OutputFile {
  id: string;
  label: string;
  filename: string;
  size: string;
  peaks: number[];
  path?: string;
}

export type WavesError =
  | "invalid-url"
  | "unavailable-video"
  | "unsupported-file"
  | "processing-failed"
  | "disk-space"
  | "cancelled";

export type Phase = "empty" | "loading" | "ready" | "processing" | "complete";

export interface AppSettings {
  outputFolder: string;
  defaultFormat: AudioFormat;
  defaultQuality: Quality;
  hardwareAcceleration: "Automatic" | "GPU" | "CPU only";
  appearance: "Shadow" | "Shadow (contrast)";
}
