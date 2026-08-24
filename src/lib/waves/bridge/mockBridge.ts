import artworkLocal from "@/assets/artwork-local.jpg";
import artworkYoutube from "@/assets/artwork-youtube.jpg";
import {
  MOCK_LOCAL_TRACK,
  MOCK_YOUTUBE_TRACK,
  buildOutputs,
  classifyUrl,
  generatePeaks,
  isSupportedFile,
  titleFromFilename,
} from "../mock";
import type { AppSettings, Track } from "../types";
import type { DesktopBridge, JobProgressEvent, JobRequest } from "./types";

const DEFAULTS: AppSettings = {
  outputFolder: "~/Music/Waves",
  defaultFormat: "WAV",
  defaultQuality: "Highest",
  hardwareAcceleration: "Automatic",
};

export class MockBridge implements DesktopBridge {
  readonly native = false;
  private listeners = new Set<(event: JobProgressEvent) => void>();
  private cancelled = new Set<string>();
  async chooseSource() {
    return null;
  }
  async chooseDestination() {
    return { path: "~/Desktop/Stems", grantId: "mock-destination" };
  }
  async registerDroppedSource(path: string) {
    return path;
  }
  async inspectFile(path: string): Promise<Track> {
    if (!isSupportedFile(path)) throw new Error("SOURCE_UNSUPPORTED");
    return {
      ...MOCK_LOCAL_TRACK,
      id: `file-${path}`,
      title: titleFromFilename(path),
      source: `Local file · ${path}`,
      artwork: artworkLocal,
    };
  }
  async inspectUrl(url: string): Promise<Track> {
    const result = classifyUrl(url);
    if (result !== "valid")
      throw new Error(result === "invalid-url" ? "URL_INVALID" : "URL_UNAVAILABLE");
    return { ...MOCK_YOUTUBE_TRACK, source: `YouTube · ${url.trim()}`, artwork: artworkYoutube };
  }
  async startJob(request: JobRequest) {
    const hasStems = request.selection.some((id) => id !== "original");
    const stages = [
      ...(request.track.sourceKind === "youtube" && !request.track.sourcePath ? ["download"] : []),
      "convert",
      ...(hasStems ? ["separate"] : []),
      "export",
    ];
    let seq = 0;
    this.emit({ type: "job_started", jobId: request.jobId, seq: ++seq });
    for (let index = 0; index < stages.length; index++) {
      const stage = stages[index]!;
      for (let step = 1; step <= 10; step++) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        if (this.cancelled.delete(request.jobId)) {
          this.emit({ type: "job_cancelled", jobId: request.jobId, seq: ++seq });
          return;
        }
        this.emit({
          type: "job_progress",
          jobId: request.jobId,
          seq: ++seq,
          stage,
          stageProgress: step / 10,
          overallProgress: (index + step / 10) / stages.length,
        });
      }
    }
    this.emit({
      type: "job_completed",
      jobId: request.jobId,
      seq: ++seq,
      outputs: buildOutputs(request.track, request.selection, request.export.format),
    });
  }
  async cancelJob(jobId: string) {
    this.cancelled.add(jobId);
  }
  async subscribeJobs(listener: (event: JobProgressEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  async getJobSnapshot() {
    return { active: null };
  }
  async getSettings() {
    return DEFAULTS;
  }
  async saveSettings(_settings: AppSettings) {}
  async reveal(_path: string) {}
  private emit(event: JobProgressEvent) {
    this.listeners.forEach((listener) => listener(event));
  }
}
