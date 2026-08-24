import type { AppSettings, ExportSettings, OutputFile, StemId, Track } from "../types";

export interface JobProgressEvent {
  type: "job_started" | "job_progress" | "job_completed" | "job_cancelled" | "job_failed";
  jobId: string;
  seq: number;
  stage?: string;
  stageProgress?: number;
  overallProgress?: number;
  outputs?: OutputFile[];
  error?: { code: string };
}

export interface JobRequest {
  jobId: string;
  track: Track;
  stem: StemId;
  export: ExportSettings;
  devicePolicy: AppSettings["hardwareAcceleration"];
}

export interface DesktopBridge {
  readonly native: boolean;
  chooseSource(): Promise<string | null>;
  chooseDestination(): Promise<{ path: string; grantId: string } | null>;
  registerDroppedSource(path: string): Promise<string>;
  inspectFile(path: string): Promise<Track>;
  inspectUrl(url: string): Promise<Track>;
  startJob(request: JobRequest): Promise<void>;
  cancelJob(jobId: string): Promise<void>;
  subscribeJobs(listener: (event: JobProgressEvent) => void): Promise<() => void>;
  getJobSnapshot(): Promise<{
    active: {
      jobId: string;
      state: string;
      stage?: string;
      progress: number;
      context: JobRequest;
    } | null;
  }>;
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
  reveal(path: string): Promise<void>;
}
