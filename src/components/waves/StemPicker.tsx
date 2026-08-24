import { STEM_OPTIONS } from "@/lib/waves/mock";
import type { OutputChoiceId, OutputId } from "@/lib/waves/types";
import { cn } from "@/lib/utils";
import { Label } from "./primitives";

export function StemPicker({
  selection,
  onToggle,
  disabled,
}: {
  selection: OutputId[];
  onToggle: (output: OutputChoiceId) => void;
  disabled?: boolean | undefined;
}) {
  return (
    <section>
      <Label>What do you want from this track</Label>
      <div className="mt-5 grid grid-cols-4 gap-2">
        {STEM_OPTIONS.map((option) => {
          const allSelected = ["vocals", "instrumental", "drums", "bass", "other"].every((id) =>
            selection.includes(id as OutputId),
          );
          const selected =
            option.id === "all"
              ? allSelected
              : option.id === "original"
                ? selection.includes(option.id)
                : !allSelected && selection.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onToggle(option.id)}
              className={cn(
                "group relative overflow-hidden rounded-md px-4 py-3.5 text-left transition-all duration-200",
                "disabled:cursor-not-allowed disabled:opacity-40",
                selected
                  ? "bg-[var(--surface-2)] shadow-[var(--glow-strong)]"
                  : "bg-[var(--surface-1)]/70 hover:bg-[var(--surface-1)]",
                option.id === "all" && "col-span-1",
              )}
            >
              <span
                className={cn(
                  "block text-sm transition-colors duration-200",
                  selected
                    ? "text-[var(--platinum)]"
                    : "text-[var(--grey)] group-hover:text-[var(--platinum)]/80",
                )}
              >
                {option.label}
              </span>
              <span className="mt-1 block text-[11px] leading-snug text-[var(--grey)]/70">
                {option.hint}
              </span>
              <span
                className={cn(
                  "absolute inset-x-0 bottom-0 h-px transition-opacity duration-200",
                  selected ? "opacity-100" : "opacity-0",
                )}
                style={{
                  background:
                    "linear-gradient(90deg, transparent, color-mix(in oklab, var(--platinum) 70%, transparent), transparent)",
                }}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
