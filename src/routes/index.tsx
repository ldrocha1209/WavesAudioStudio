import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CompletePanel } from "@/components/waves/CompletePanel";
import { EmptyState } from "@/components/waves/EmptyState";
import { ErrorNotice } from "@/components/waves/ErrorNotice";
import { ExportPanel } from "@/components/waves/ExportPanel";
import { ProcessButton } from "@/components/waves/ProcessButton";
import { ProcessingPanel } from "@/components/waves/ProcessingPanel";
import { SettingsPanel } from "@/components/waves/SettingsPanel";
import { StemPicker } from "@/components/waves/StemPicker";
import { TopBar } from "@/components/waves/TopBar";
import { TrackPanel } from "@/components/waves/TrackPanel";
import { useWaves } from "@/lib/waves/useWaves";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Waves — Download, Separate, Create" },
      {
        name: "description",
        content:
          "Waves is a desktop audio utility for producers: load a track from a file or link, separate stems, and export studio-quality audio locally.",
      },
      { property: "og:title", content: "Waves — Download, Separate, Create" },
      {
        property: "og:description",
        content:
          "Desktop audio utility for producers: load a track, separate vocals, drums, bass and more, export locally.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WavesApp,
});

function WavesApp() {
  const waves = useWaves();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { phase, track, error } = waves;

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[var(--shadow-grey)]">
      <TopBar
        onSettings={() => setSettingsOpen(true)}
        onReset={waves.reset}
        showReset={phase !== "empty" && phase !== "loading"}
      />

      <main className="scrollarea relative flex-1">
        {phase === "empty" || phase === "loading" ? (
          <div className="relative h-full">
            <EmptyState onFile={waves.loadFile} onUrl={waves.loadUrl} loading={phase === "loading"} />
            {error && (
              <div className="absolute inset-x-0 bottom-8 mx-auto w-full max-w-xl px-6">
                <ErrorNotice error={error} onDismiss={waves.clearError} />
              </div>
            )}
          </div>
        ) : (
          track && (
            <div className="mx-auto w-full max-w-4xl px-10 py-12">
              {phase === "processing" ? (
                <ProcessingPanel
                  track={track}
                  stages={waves.stages}
                  overall={waves.overall}
                  onCancel={waves.cancel}
                />
              ) : phase === "complete" ? (
                <CompletePanel
                  outputs={waves.outputs}
                  settings={waves.exportSettings}
                  duration={track.duration}
                  onReset={waves.reset}
                />
              ) : (
                <div className="space-y-14">
                  <TrackPanel track={track} />
                  {error && <ErrorNotice error={error} onDismiss={waves.clearError} />}
                  <StemPicker value={waves.stem} onChange={waves.setStem} />
                  <ExportPanel
                    settings={waves.exportSettings}
                    qualities={waves.qualities}
                    onFormat={waves.setFormat}
                    onQuality={(quality) =>
                      waves.setExportSettings((prev) => ({ ...prev, quality }))
                    }
                    onLocation={(location) =>
                      waves.setExportSettings((prev) => ({ ...prev, location }))
                    }
                  />
                  <div className="flex flex-col items-center gap-4 pt-2 pb-4">
                    <ProcessButton onClick={waves.process} />
                    <p className="font-mono text-[11px] text-[var(--grey)]/70">
                      Processing runs locally · nothing leaves this machine
                    </p>
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </main>

      <SettingsPanel
        open={settingsOpen}
        settings={waves.settings}
        onChange={waves.applySettings}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
