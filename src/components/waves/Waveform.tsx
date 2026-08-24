import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

interface WaveformProps {
  peaks: number[];
  /** 0..1 playhead position */
  progress?: number | undefined;
  /** 0..1 processed / rendered portion, drawn as illumination */
  scan?: number | undefined;
  onSeek?: ((position: number) => void) | undefined;
  height?: number | undefined;
  className?: string | undefined;
  subtle?: boolean | undefined;
}

export function Waveform({
  peaks,
  progress = 0,
  scan,
  onSeek,
  height = 132,
  className,
  subtle = false,
}: WaveformProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!onSeek || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      onSeek(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)));
    },
    [onSeek],
  );

  const active = scan ?? progress;

  return (
    <div
      ref={ref}
      onClick={handleClick}
      className={cn(
        "group/wave relative w-full select-none",
        onSeek && "cursor-pointer",
        className,
      )}
      style={{ height }}
    >
      {/* illumination behind the active region */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 transition-[width] duration-200 ease-out"
        style={{
          width: `${active * 100}%`,
          background:
            "radial-gradient(120% 80% at 100% 50%, color-mix(in oklab, var(--platinum) 14%, transparent), transparent 70%)",
        }}
      />
      <div className="flex h-full w-full items-center gap-[2px]">
        {peaks.map((peak, i) => {
          const played = i / peaks.length <= active;
          return (
            <span
              key={i}
              className={cn(
                "flex-1 rounded-[1px] transition-[opacity,background-color] duration-200",
                played
                  ? subtle
                    ? "bg-[var(--platinum)]/55"
                    : "bg-[var(--platinum)]/85"
                  : "bg-[var(--grey)]/35",
              )}
              style={{
                height: `${Math.max(2, peak * 100)}%`,
                boxShadow:
                  played && !subtle
                    ? "0 0 6px color-mix(in oklab, var(--platinum) 22%, transparent)"
                    : undefined,
              }}
            />
          );
        })}
      </div>

      {/* playhead */}
      {progress > 0 && (
        <div
          className="pointer-events-none absolute inset-y-0 w-px bg-[var(--platinum)] transition-[left] duration-100 ease-linear"
          style={{
            left: `${progress * 100}%`,
            boxShadow: "0 0 12px 1px color-mix(in oklab, var(--platinum) 45%, transparent)",
          }}
        />
      )}
    </div>
  );
}
