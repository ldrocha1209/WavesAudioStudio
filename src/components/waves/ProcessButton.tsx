import { cn } from "@/lib/utils";

export function ProcessButton({
  onClick,
  disabled,
  processing,
}: {
  onClick: () => void;
  disabled?: boolean;
  processing?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || processing}
      className={cn(
        "relative rounded-md px-11 py-3.5 text-xs tracking-[0.24em] uppercase transition-all duration-200",
        "active:scale-[0.985]",
        disabled
          ? "cursor-not-allowed bg-[var(--surface-1)] text-[var(--grey)]/50"
          : processing
            ? "bg-[var(--surface-2)] text-[var(--grey)]"
            : "bg-[var(--platinum)] text-[var(--shadow-grey)] shadow-[var(--glow-soft)] hover:shadow-[var(--glow-strong)]",
      )}
    >
      {processing ? "Processing…" : "Process Track"}
    </button>
  );
}
