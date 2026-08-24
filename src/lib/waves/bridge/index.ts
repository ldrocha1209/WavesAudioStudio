import { MockBridge } from "./mockBridge";
import { TauriBridge } from "./tauriBridge";
import type { DesktopBridge } from "./types";

let bridge: DesktopBridge | undefined;

export function getDesktopBridge(): DesktopBridge {
  return (bridge ??=
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
      ? new TauriBridge()
      : new MockBridge());
}

export type { DesktopBridge, JobProgressEvent, JobRequest } from "./types";
