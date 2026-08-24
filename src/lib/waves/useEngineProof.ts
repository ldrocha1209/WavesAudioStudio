import { useEffect, useState } from "react";

export type EngineProofStatus = "web preview" | "starting" | "connected" | "unavailable";

export function useEngineProof(): EngineProofStatus {
  const [status, setStatus] = useState<EngineProofStatus>("web preview");

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;

    let active = true;
    let unlisten: (() => void) | undefined;
    let unlistenStopped: (() => void) | undefined;
    setStatus("starting");

    void Promise.all([import("@tauri-apps/api/core"), import("@tauri-apps/api/event")])
      .then(async ([{ invoke }, { listen }]) => {
        unlisten = await listen<string>("waves://engine", (event) => {
          if (!active) return;
          try {
            const message = JSON.parse(event.payload) as { type?: unknown };
            if (message.type === "engine_ready" || message.type === "pong") {
              setStatus("connected");
            }
          } catch {
            setStatus("unavailable");
          }
        });
        unlistenStopped = await listen("waves://engine-stopped", () => {
          if (active) setStatus("unavailable");
        });
        await invoke<string>("start_engine");
        const current = await invoke<string>("engine_status");
        if (active && current === "connected") setStatus("connected");
      })
      .catch(() => {
        if (active) setStatus("unavailable");
      });

    return () => {
      active = false;
      unlisten?.();
      unlistenStopped?.();
    };
  }, []);

  return status;
}
