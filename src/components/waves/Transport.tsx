import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

export function TransportButton({
  playing,
  onToggle,
  size = 44,
}: {
  playing: boolean;
  onToggle: () => void;
  size?: number;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={playing ? "Pause" : "Play"}
      style={{ width: size, height: size }}
      className={cn(
        "group flex shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)]",
        "text-[var(--platinum)] transition-all duration-200",
        "hover:bg-[var(--surface-3)] hover:shadow-[var(--glow-strong)] active:scale-[0.97]",
        playing ? "shadow-[var(--glow-soft)]" : "shadow-none",
      )}
    >
      {playing ? (
        <Pause size={size * 0.34} strokeWidth={1.5} fill="currentColor" />
      ) : (
        <Play size={size * 0.34} strokeWidth={1.5} fill="currentColor" className="ml-[1px]" />
      )}
    </button>
  );
}
