import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MOCK_LOCAL_TRACK,
  MOCK_YOUTUBE_TRACK,
  buildOutputs,
  classifyUrl,
  isSupportedFile,
  qualitiesFor,
  titleFromFilename,
} from "./mock";
import { buildStages, runPipeline, type PipelineHandle } from "./pipeline";
import type {
  AppSettings,
  AudioFormat,
  ExportSettings,
  OutputFile,
  Phase,
  Quality,
  Stage,
  StageId,
  StemId,
  Track,
  WavesError,
} from "./types";

export const ERROR_COPY: Record<WavesError, { title: string; detail: string }> = {
  "invalid-url": {
    title: "That doesn't look like a YouTube link",
    detail: "Paste a full youtube.com/watch or youtu.be address and try again.",
  },
  "unavailable-video": {
    title: "This video can't be reached",
    detail: "It's private, region locked or has been removed. Try another source.",
  },
  "unsupported-file": {
    title: "Unsupported audio file",
    detail: "Waves reads MP3, WAV, FLAC, AIFF and M4A files.",
  },
  "processing-failed": {
    title: "Processing stopped unexpectedly",
    detail: "The separation engine returned an error. Your source track is untouched.",
  },
  "disk-space": {
    title: "Not enough space to export",
    detail: "Free up at least 1.4 GB on the destination volume, or choose another folder.",
  },
  cancelled: {
    title: "Processing cancelled",
    detail: "Nothing was written to disk. You can start again whenever you're ready.",
  },
};

const DEFAULT_SETTINGS: AppSettings = {
  outputFolder: "~/Music/Waves",
  defaultFormat: "WAV",
  defaultQuality: "Highest",
  hardwareAcceleration: "Automatic",
  appearance: "Shadow",
};

export function useWaves() {
  const [phase, setPhase] = useState<Phase>("empty");
  const [track, setTrack] = useState<Track | null>(null);
  const [stem, setStem] = useState<StemId>("original");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    format: DEFAULT_SETTINGS.defaultFormat,
    quality: DEFAULT_SETTINGS.defaultQuality,
    location: DEFAULT_SETTINGS.outputFolder,
  });
  const [stages, setStages] = useState<Stage[]>([]);
  const [overall, setOverall] = useState(0);
  const [outputs, setOutputs] = useState<OutputFile[]>([]);
  const [error, setError] = useState<WavesError | null>(null);
  const pipeline = useRef<PipelineHandle | null>(null);
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    pipeline.current?.cancel();
    if (loadTimer.current) clearTimeout(loadTimer.current);
  }, []);

  const setFormat = useCallback((format: AudioFormat) => {
    setExportSettings((prev) => {
      const allowed = qualitiesFor(format);
      const quality: Quality = allowed.includes(prev.quality) ? prev.quality : allowed[0];
      return { ...prev, format, quality };
    });
  }, []);

  const beginLoad = useCallback((next: Track) => {
    setError(null);
    setPhase("loading");
    if (loadTimer.current) clearTimeout(loadTimer.current);
    loadTimer.current = setTimeout(() => {
      setTrack(next);
      setPhase("ready");
    }, 900);
  }, []);

  const loadFile = useCallback(
    (name: string) => {
      if (!isSupportedFile(name)) {
        setError("unsupported-file");
        return;
      }
      beginLoad({
        ...MOCK_LOCAL_TRACK,
        title: titleFromFilename(name),
        source: `Local file · ${name}`,
      });
    },
    [beginLoad],
  );

  const loadUrl = useCallback(
    (url: string) => {
      const result = classifyUrl(url);
      if (result !== "valid") {
        setError(result);
        return;
      }
      beginLoad({ ...MOCK_YOUTUBE_TRACK, source: `YouTube · ${url.trim()}` });
    },
    [beginLoad],
  );

  const process = useCallback(() => {
    if (!track) return;
    setError(null);
    // Mocked failure triggers so every error state is reachable in the prototype.
    const failAt: StageId | undefined = exportSettings.location.startsWith("/Volumes")
      ? "export"
      : exportSettings.location.includes("Desktop/Stems") && stem !== "original"
        ? "separate"
        : undefined;
    setStages(buildStages({ sourceKind: track.sourceKind, stem }));
    setOverall(0);
    setPhase("processing");
    pipeline.current = runPipeline(
      { sourceKind: track.sourceKind, stem, failAt },
      {
        onProgress: (next, total) => {
          setStages(next);
          setOverall(total);
        },
        onDone: () => {
          setOutputs(buildOutputs(track, stem, exportSettings.format));
          setPhase("complete");
        },
        onError: (stage) => {
          setError(stage === "export" ? "disk-space" : "processing-failed");
          setPhase("ready");
        },
      },
    );
  }, [track, stem, exportSettings]);

  const cancel = useCallback(() => {
    pipeline.current?.cancel();
    pipeline.current = null;
    setError("cancelled");
    setPhase("ready");
  }, []);

  const reset = useCallback(() => {
    pipeline.current?.cancel();
    pipeline.current = null;
    setTrack(null);
    setOutputs([]);
    setStages([]);
    setOverall(0);
    setStem("original");
    setError(null);
    setPhase("empty");
  }, []);

  const applySettings = useCallback((next: AppSettings) => {
    setSettings(next);
    setExportSettings((prev) => ({
      ...prev,
      location: next.outputFolder,
      format: next.defaultFormat,
      quality: qualitiesFor(next.defaultFormat).includes(next.defaultQuality)
        ? next.defaultQuality
        : qualitiesFor(next.defaultFormat)[0],
    }));
  }, []);

  const qualities = useMemo(() => qualitiesFor(exportSettings.format), [exportSettings.format]);

  return {
    phase,
    track,
    stem,
    setStem,
    exportSettings,
    setExportSettings,
    setFormat,
    qualities,
    stages,
    overall,
    outputs,
    error,
    clearError: () => setError(null),
    loadFile,
    loadUrl,
    process,
    cancel,
    reset,
    settings,
    applySettings,
  };
}
