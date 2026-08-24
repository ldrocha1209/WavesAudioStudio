import type { SourceKind, Stage, StageId, StemId } from "./types";

export interface PipelineOptions {
  sourceKind: SourceKind;
  stem: StemId;
  /** Force a mocked failure at a given stage. */
  failAt?: StageId | undefined;
}

export interface PipelineHandle {
  cancel: () => void;
}

const LABELS: Record<StageId, string> = {
  download: "Downloading",
  convert: "Converting",
  separate: "Separating",
  export: "Exporting",
};

/** Duration in ms for each stage of the mocked pipeline. */
const DURATIONS: Record<StageId, number> = {
  download: 3200,
  convert: 1800,
  separate: 5200,
  export: 1600,
};

export function buildStages({ sourceKind, stem }: PipelineOptions): Stage[] {
  const ids: StageId[] = [];
  if (sourceKind === "youtube") ids.push("download");
  ids.push("convert");
  if (stem !== "original") ids.push("separate");
  ids.push("export");
  return ids.map((id, i) => ({
    id,
    label: LABELS[id],
    progress: 0,
    status: i === 0 ? "active" : "pending",
  }));
}

/**
 * Mocked local processing engine. Replace this module with IPC calls to the
 * desktop backend (yt-dlp / ffmpeg / demucs) without touching any UI code.
 */
export function runPipeline(
  options: PipelineOptions,
  handlers: {
    onProgress: (stages: Stage[], overall: number) => void;
    onDone: () => void;
    onError: (stage: StageId) => void;
  },
): PipelineHandle {
  const stages = buildStages(options);
  const total = stages.reduce((sum, s) => sum + DURATIONS[s.id], 0);
  let cancelled = false;
  let index = 0;
  let elapsedInStage = 0;
  let elapsedTotal = 0;
  let last = performance.now();
  let frame = 0;

  const tick = (now: number) => {
    if (cancelled) return;
    const dt = Math.min(120, now - last);
    last = now;
    const stage = stages[index]!;
    elapsedInStage += dt;
    elapsedTotal += dt;

    const duration = DURATIONS[stage.id];
    stage.progress = Math.min(1, elapsedInStage / duration);

    if (options.failAt === stage.id && stage.progress > 0.45) {
      handlers.onError(stage.id);
      return;
    }

    if (stage.progress >= 1) {
      stage.status = "done";
      elapsedInStage = 0;
      index += 1;
      if (index >= stages.length) {
        handlers.onProgress([...stages], 1);
        handlers.onDone();
        return;
      }
      stages[index]!.status = "active";
    }

    handlers.onProgress(
      stages.map((s) => ({ ...s })),
      Math.min(1, elapsedTotal / total),
    );
    frame = requestAnimationFrame(tick);
  };

  frame = requestAnimationFrame(tick);

  return {
    cancel: () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    },
  };
}
