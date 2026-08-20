import type { Stage, Track } from "@/lib/waves/types";
import { cn } from "@/lib/utils";
import { GhostButton, Label } from "./primitives";
import { Waveform } from "./Waveform";

export function ProcessingPanel({
  track,
  stages,
  overall,
  onCancel,
}: {
  track: Track;
  stages: Stage[];
  overall: number;
  onCancel: () => void;
}) {
  const active = stages.find((s) => s.status === "active");

  return (
    <section className="animate-soft-fade">
      <div className="flex items-baseline justify-between">
        <div>
          <Label>{active ? active.label : "Finishing"}</Label>
          <h2 className="mt-3 text-xl font-medium text-[var(--platinum)]">{track.title}</h2>
        </div>
        <span className="font-mono text-3xl font-light text-[var(--platinum)] tabular-nums">
          {Math.round(overall * 100)}
          <span className="text-base text-[var(--grey)]">%</span>
        </span>
      </div>

      <Waveform peaks={track.peaks} scan={overall} height={140} className="mt-10" />

      <div className="mt-12 flex items-stretch gap-px overflow-hidden rounded-md bg-[var(--hairline)]">
        {stages.map((stage) => (
          <div
            key={stage.id}
            className={cn(
              "relative flex-1 bg-[var(--surface-1)] px-5 py-4 transition-colors duration-300",
              stage.status !== "pending" && "bg-[var(--surface-2)]",
            )}
          >
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "text-xs transition-colors duration-300",
                  stage.status === "pending" ? "text-[var(--grey)]/60" : "text-[var(--platinum)]",
                )}
              >
                {stage.label}
              </span>
              <span className="font-mono text-[11px] text-[var(--grey)] tabular-nums">
                {stage.status === "done" ? "✓" : stage.status === "active" ? `${Math.round(stage.progress * 100)}%` : "—"}
              </span>
            </div>
            <div className="mt-3 h-px w-full bg-[var(--hairline)]">
              <div
                className="h-px bg-[var(--platinum)] transition-[width] duration-150 ease-linear"
                style={{
                  width: `${stage.progress * 100}%`,
                  boxShadow:
                    stage.status === "active"
                      ? "0 0 10px 1px color-mix(in oklab, var(--platinum) 45%, transparent)"
                      : undefined,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 flex justify-center">
        <GhostButton onClick={onCancel}>Cancel</GhostButton>
      </div>
    </section>
  );
}
