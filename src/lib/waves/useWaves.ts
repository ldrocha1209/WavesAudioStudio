import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDesktopBridge, type JobProgressEvent, type JobRequest } from "./bridge";
import { buildOutputs, qualitiesFor } from "./mock";
import { buildStages } from "./pipeline";
import type {
  AppSettings,
  AudioFormat,
  ExportSettings,
  OutputFile,
  OutputChoiceId,
  OutputId,
  Phase,
  Quality,
  Stage,
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
    detail: "The local engine returned an error. Your source track is untouched.",
  },
  "disk-space": {
    title: "Not enough space to export",
    detail: "Free some space on the destination volume, or choose another folder.",
  },
  cancelled: {
    title: "Processing cancelled",
    detail: "No incomplete output was published. You can start again whenever you're ready.",
  },
};

const DEFAULT_SETTINGS: AppSettings = {
  outputFolder: "~/Music/Waves",
  defaultFormat: "WAV",
  defaultQuality: "Highest",
  hardwareAcceleration: "Automatic",
};

const STEM_OUTPUTS: OutputId[] = ["vocals", "instrumental", "drums", "bass", "other"];
const OUTPUT_ORDER: OutputId[] = ["original", ...STEM_OUTPUTS];

function orderSelection(selection: OutputId[]): OutputId[] {
  return OUTPUT_ORDER.filter((id) => selection.includes(id));
}

function mapError(error: unknown): WavesError {
  const code = error instanceof Error ? error.message : String(error);
  if (code.includes("URL_INVALID")) return "invalid-url";
  if (code.includes("URL_") || code.includes("VIDEO_")) return "unavailable-video";
  if (code.includes("SOURCE_")) return "unsupported-file";
  if (code.includes("DISK_")) return "disk-space";
  return "processing-failed";
}

export function useWaves() {
  const bridge = useMemo(() => getDesktopBridge(), []);
  const [phase, setPhase] = useState<Phase>("empty");
  const [track, setTrack] = useState<Track | null>(null);
  const [selection, setSelection] = useState<OutputId[]>(["original"]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    format: "WAV",
    quality: "Highest",
    location: "~/Music/Waves",
  });
  const [stages, setStages] = useState<Stage[]>([]);
  const [overall, setOverall] = useState(0);
  const [outputs, setOutputs] = useState<OutputFile[]>([]);
  const [error, setError] = useState<WavesError | null>(null);
  const activeRequest = useRef<JobRequest | null>(null);

  const applyProgress = useCallback((event: JobProgressEvent) => {
    const current = activeRequest.current;
    if (!current || current.jobId !== event.jobId) return;
    if (event.type === "job_progress" && event.stage) {
      setOverall(event.overallProgress ?? 0);
      setStages((previous) =>
        previous.map((item) => {
          const activeIndex = previous.findIndex((stage) => stage.id === event.stage);
          const index = previous.indexOf(item);
          return index < activeIndex
            ? { ...item, status: "done", progress: 1 }
            : index === activeIndex
              ? { ...item, status: "active", progress: event.stageProgress ?? 0 }
              : item;
        }),
      );
    } else if (event.type === "job_completed") {
      setStages((previous) => previous.map((item) => ({ ...item, status: "done", progress: 1 })));
      setOverall(1);
      setOutputs(
        event.outputs?.length
          ? event.outputs
          : buildOutputs(current.track, current.selection, current.export.format),
      );
      setPhase("complete");
      activeRequest.current = null;
    } else if (event.type === "job_cancelled") {
      setError("cancelled");
      setPhase("ready");
      activeRequest.current = null;
    } else if (event.type === "job_failed") {
      setError(mapError(event.error?.code));
      setPhase("ready");
      activeRequest.current = null;
    }
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    void bridge.subscribeJobs(applyProgress).then((value) => {
      unsubscribe = value;
    });
    void bridge.getSettings().then((next) => {
      setSettings(next);
      setExportSettings({
        format: next.defaultFormat,
        quality: next.defaultQuality,
        location: next.outputFolder,
        ...(next.outputFolderGrant ? { destinationGrant: next.outputFolderGrant } : {}),
      });
    });
    void bridge.getJobSnapshot().then(({ active }) => {
      if (!active?.context?.track) return;
      activeRequest.current = active.context;
      setTrack(active.context.track);
      setSelection(active.context.selection);
      setExportSettings(active.context.export);
      setStages(
        buildStages({
          sourceKind: active.context.track.sourceKind,
          selection: active.context.selection,
          sourceReady: Boolean(active.context.track.sourcePath),
        }),
      );
      setOverall(active.progress);
      setPhase("processing");
    });
    return () => unsubscribe?.();
  }, [applyProgress, bridge]);

  const setFormat = useCallback(
    (format: AudioFormat) =>
      setExportSettings((previous) => {
        const allowed = qualitiesFor(format);
        return {
          ...previous,
          format,
          quality: allowed.includes(previous.quality) ? previous.quality : allowed[0],
        };
      }),
    [],
  );

  const loadFile = useCallback(
    async (path: string) => {
      setError(null);
      setPhase("loading");
      try {
        setTrack(await bridge.inspectFile(path));
        setPhase("ready");
      } catch (nextError) {
        setError(mapError(nextError));
        setPhase("empty");
      }
    },
    [bridge],
  );
  const chooseSource = useCallback(async () => {
    const path = await bridge.chooseSource();
    if (path) await loadFile(path);
  }, [bridge, loadFile]);

  useEffect(() => {
    if (!bridge.native) return;
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/webview").then(async ({ getCurrentWebview }) => {
      unlisten = await getCurrentWebview().onDragDropEvent((event) => {
        if (event.payload.type !== "drop") return;
        if (event.payload.paths.length !== 1) {
          setError("unsupported-file");
          return;
        }
        void bridge
          .registerDroppedSource(event.payload.paths[0]!)
          .then(loadFile)
          .catch(() => setError("unsupported-file"));
      });
    });
    return () => unlisten?.();
  }, [bridge, bridge.native, loadFile]);
  const loadUrl = useCallback(
    async (url: string) => {
      setError(null);
      setPhase("loading");
      try {
        setTrack(await bridge.inspectUrl(url));
        setPhase("ready");
      } catch (nextError) {
        setError(mapError(nextError));
        setPhase("empty");
      }
    },
    [bridge],
  );
  const toggleOutput = useCallback((choice: OutputChoiceId) => {
    setSelection((previous) => {
      const hasOriginal = previous.includes("original");
      const allStemsSelected = STEM_OUTPUTS.every((id) => previous.includes(id));
      if (choice === "all")
        return orderSelection([...(hasOriginal ? ["original" as const] : []), ...STEM_OUTPUTS]);
      if (choice === "original") {
        if (!hasOriginal) return orderSelection(["original", ...previous]);
        return previous.length === 1 ? previous : previous.filter((id) => id !== "original");
      }
      if (allStemsSelected)
        return orderSelection([...(hasOriginal ? ["original" as const] : []), choice]);
      if (previous.includes(choice))
        return previous.length === 1 ? previous : previous.filter((id) => id !== choice);
      return orderSelection([...previous, choice]);
    });
  }, []);
  const process = useCallback(() => {
    if (!track || selection.length === 0) return;
    const request: JobRequest = {
      jobId: crypto.randomUUID(),
      track,
      selection,
      export: exportSettings,
      devicePolicy: settings.hardwareAcceleration,
    };
    activeRequest.current = request;
    setError(null);
    setStages(
      buildStages({
        sourceKind: track.sourceKind,
        selection,
        sourceReady: Boolean(track.sourcePath),
      }),
    );
    setOverall(0);
    setPhase("processing");
    void bridge.startJob(request).catch((nextError) => {
      setError(mapError(nextError));
      setPhase("ready");
      activeRequest.current = null;
    });
  }, [bridge, exportSettings, settings.hardwareAcceleration, selection, track]);
  const cancel = useCallback(() => {
    const id = activeRequest.current?.jobId;
    if (id) void bridge.cancelJob(id).catch(() => setError("processing-failed"));
  }, [bridge]);
  const reset = useCallback(() => {
    activeRequest.current = null;
    setTrack(null);
    setOutputs([]);
    setStages([]);
    setOverall(0);
    setSelection(["original"]);
    setError(null);
    setPhase("empty");
  }, []);
  const applySettings = useCallback(
    (next: AppSettings) => {
      setSettings(next);
      setExportSettings((previous) => {
        const { destinationGrant: _previousGrant, ...rest } = previous;
        return {
          ...rest,
          location: next.outputFolder,
          ...(next.outputFolderGrant ? { destinationGrant: next.outputFolderGrant } : {}),
          format: next.defaultFormat,
          quality: qualitiesFor(next.defaultFormat).includes(next.defaultQuality)
            ? next.defaultQuality
            : qualitiesFor(next.defaultFormat)[0],
        };
      });
      void bridge.saveSettings(next);
    },
    [bridge],
  );
  const chooseDestination = useCallback(async () => {
    const destination = await bridge.chooseDestination();
    if (destination)
      setExportSettings((previous) => ({
        ...previous,
        location: destination.path,
        destinationGrant: destination.grantId,
      }));
  }, [bridge]);
  const chooseDefaultDestination = useCallback(async () => {
    const destination = await bridge.chooseDestination();
    if (!destination) return;
    applySettings({
      ...settings,
      outputFolder: destination.path,
      outputFolderGrant: destination.grantId,
    });
  }, [applySettings, bridge, settings]);

  return {
    phase,
    track,
    selection,
    toggleOutput,
    exportSettings,
    setExportSettings,
    setFormat,
    qualities: qualitiesFor(exportSettings.format),
    stages,
    overall,
    outputs,
    error,
    clearError: () => setError(null),
    loadFile,
    chooseSource,
    loadUrl,
    process,
    cancel,
    reset,
    settings,
    applySettings,
    chooseDestination,
    chooseDefaultDestination,
    reveal: bridge.reveal.bind(bridge),
    native: bridge.native,
  };
}
