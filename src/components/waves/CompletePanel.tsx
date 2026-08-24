import { useState } from "react";
import type { ExportSettings, OutputFile } from "@/lib/waves/types";
import { usePlayback } from "@/lib/waves/usePlayback";
import { cn } from "@/lib/utils";
import { GhostButton, Label, Meta } from "./primitives";
import { TransportButton } from "./Transport";
import { Waveform } from "./Waveform";

function OutputRow({
  output,
  duration,
  active,
  onActivate,
}: {
  output: OutputFile;
  duration: number;
  active: boolean;
  onActivate: () => void;
}) {
  const player = usePlayback(duration);
  const playing = active && player.playing;

  return (
    <div
      className={cn(
        "flex items-center gap-5 rounded-md px-5 py-4 transition-all duration-200",
        playing ? "bg-[var(--surface-2)] shadow-[var(--glow-soft)]" : "bg-[var(--surface-1)]/70",
      )}
    >
      <TransportButton
        size={34}
        playing={playing}
        onToggle={() => {
          onActivate();
          player.toggle();
        }}
      />
      <div className="w-64 shrink-0">
        <p className="text-sm text-[var(--platinum)]">{output.label}</p>
        <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--grey)]">
          {output.filename} · {output.size}
        </p>
      </div>
      <Waveform
        peaks={output.peaks}
        progress={playing ? player.progress : 0}
        height={38}
        subtle
        className="flex-1"
      />
    </div>
  );
}

export function CompletePanel({
  outputs,
  settings,
  duration,
  onReset,
  onOpenFolder,
}: {
  outputs: OutputFile[];
  settings: ExportSettings;
  duration: number;
  onReset: () => void;
  onOpenFolder: () => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);

  return (
    <section className="animate-rise">
      <div className="text-center">
        <Label>Complete</Label>
        <h2 className="mt-4 text-3xl font-medium text-[var(--platinum)]">Your track is ready.</h2>
        <p className="mt-3 font-mono text-xs text-[var(--grey)]">
          {outputs.length} file{outputs.length > 1 ? "s" : ""} · {settings.format} ·{" "}
          {settings.quality} · {settings.location}
        </p>
      </div>

      <div className="mt-12 space-y-2">
        {outputs.map((output) => (
          <OutputRow
            key={output.id}
            output={output}
            duration={duration}
            active={activeId === output.id}
            onActivate={() => setActiveId(output.id)}
          />
        ))}
      </div>

      <div className="mt-12 flex items-center justify-center gap-3">
        <GhostButton
          onClick={() => {
            onOpenFolder();
            setOpened(true);
            setTimeout(() => setOpened(false), 1800);
          }}
        >
          {opened ? "Opening in Finder…" : "Open Folder"}
        </GhostButton>
        <button
          onClick={onReset}
          className="rounded-md bg-[var(--platinum)] px-8 py-2.5 text-xs tracking-[0.22em] text-[var(--shadow-grey)] uppercase shadow-[var(--glow-soft)] transition-all duration-200 hover:shadow-[var(--glow-strong)] active:scale-[0.985]"
        >
          Process Another Track
        </button>
      </div>

      <div className="mt-8 text-center">
        <Meta>Written to {settings.location}</Meta>
      </div>
    </section>
  );
}
