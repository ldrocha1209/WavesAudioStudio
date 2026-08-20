import { ERROR_COPY } from "@/lib/waves/useWaves";
import type { WavesError } from "@/lib/waves/types";

export function ErrorNotice({ error, onDismiss }: { error: WavesError; onDismiss: () => void }) {
  const copy = ERROR_COPY[error];
  return (
    <div className="animate-rise flex items-start gap-4 rounded-md bg-[var(--surface-1)] px-5 py-4 shadow-[var(--glow-soft)]">
      <span
        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--platinum)]"
        style={{ boxShadow: "0 0 10px 1px color-mix(in oklab, var(--platinum) 50%, transparent)" }}
      />
      <div className="flex-1">
        <p className="text-sm text-[var(--platinum)]">{copy.title}</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--grey)]">{copy.detail}</p>
      </div>
      <button
        onClick={onDismiss}
        className="text-[10px] tracking-[0.2em] text-[var(--grey)] uppercase transition-colors duration-200 hover:text-[var(--platinum)]"
      >
        Dismiss
      </button>
    </div>
  );
}
