import artworkLocal from "@/assets/artwork-local.jpg";
import artworkYoutube from "@/assets/artwork-youtube.jpg";
import { generatePeaks } from "../mock";
import type { AppSettings, Track } from "../types";
import type { DesktopBridge, JobProgressEvent, JobRequest } from "./types";

type Frame = Record<string, unknown> & { type?: string; requestId?: string };

export class TauriBridge implements DesktopBridge {
  readonly native = true;
  private pending = new Map<
    string,
    {
      resolve: (frame: Frame) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private jobListeners = new Set<(event: JobProgressEvent) => void>();
  private initialized?: Promise<void>;

  private init(): Promise<void> {
    return (this.initialized ??= Promise.all([
      import("@tauri-apps/api/core"),
      import("@tauri-apps/api/event"),
    ]).then(async ([{ invoke }, { listen }]) => {
      await listen<string>("waves://engine", ({ payload }) => {
        let frame: Frame;
        try {
          frame = JSON.parse(payload) as Frame;
        } catch {
          return;
        }
        if (frame.requestId) {
          const pending = this.pending.get(frame.requestId);
          if (pending) {
            clearTimeout(pending.timer);
            this.pending.delete(frame.requestId);
            if (frame.type === "error")
              pending.reject(
                new Error(
                  String((frame["error"] as { code?: string } | undefined)?.code ?? "ENGINE_ERROR"),
                ),
              );
            else pending.resolve(frame);
          }
        }
        if (frame.type?.startsWith("job_"))
          this.jobListeners.forEach((listener) => listener(frame as unknown as JobProgressEvent));
      });
      await invoke("start_engine");
    }));
  }

  private async request(
    type: string,
    payload: Record<string, unknown> = {},
    timeoutMs = 65_000,
  ): Promise<Frame> {
    await this.init();
    const { invoke } = await import("@tauri-apps/api/core");
    const requestId = crypto.randomUUID();
    const response = new Promise<Frame>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("ENGINE_TIMEOUT"));
      }, timeoutMs);
      this.pending.set(requestId, { resolve, reject, timer });
    });
    await invoke("send_engine", {
      message: `${JSON.stringify({ protocol: 1, type, requestId, payload })}\n`,
    });
    return response;
  }

  async chooseSource() {
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke<{ grantId: string } | null>("choose_source");
    return result?.grantId ?? null;
  }
  async chooseDestination() {
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke<{ grantId: string; displayPath: string } | null>(
      "choose_destination",
    );
    return result ? { grantId: result.grantId, path: result.displayPath } : null;
  }
  async registerDroppedSource(path: string) {
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke<{ grantId: string }>("register_dropped_source", { path });
    return result.grantId;
  }
  async inspectFile(grantId: string): Promise<Track> {
    const frame = await this.request("inspect_file", { grantId });
    const track = frame["track"] as Omit<Track, "artwork"> & { path?: string };
    return {
      ...track,
      sourceGrant: grantId,
      ...(track.path ? { sourcePath: track.path } : {}),
      artwork: artworkLocal,
    };
  }
  async inspectUrl(url: string): Promise<Track> {
    const frame = await this.request("inspect_url", { url }, 10 * 60_000);
    const track = frame["track"] as Omit<Track, "artwork"> & { thumbnailPath?: string };
    let artwork = artworkYoutube;
    if (track.thumbnailPath) {
      const { convertFileSrc } = await import("@tauri-apps/api/core");
      artwork = convertFileSrc(track.thumbnailPath);
    }
    return {
      ...track,
      peaks: track.peaks.length ? track.peaks : generatePeaks(track.id.length * 97),
      artwork,
    };
  }
  async startJob(request: JobRequest) {
    await this.request("start_job", request as unknown as Record<string, unknown>);
  }
  async cancelJob(jobId: string) {
    await this.request("cancel", { jobId });
  }
  async subscribeJobs(listener: (event: JobProgressEvent) => void) {
    await this.init();
    this.jobListeners.add(listener);
    return () => this.jobListeners.delete(listener);
  }
  async getJobSnapshot() {
    const frame = await this.request("job_snapshot");
    return {
      active: (frame["active"] ?? null) as {
        jobId: string;
        state: string;
        stage?: string;
        progress: number;
        context: JobRequest;
      } | null,
    };
  }
  async getSettings(): Promise<AppSettings> {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("get_settings");
  }
  async saveSettings(settings: AppSettings) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("save_settings", { settings });
  }
  async reveal(path: string) {
    const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
    await revealItemInDir(path);
  }
}
