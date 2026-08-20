import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Label({ children, className }: { children: ReactNode; className?: string | undefined }) {
  return (
    <span
      className={cn(
        "text-[10px] uppercase tracking-[0.22em] text-[var(--grey)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Meta({ children, className }: { children: ReactNode; className?: string | undefined }) {
  return <span className={cn("font-mono text-xs text-[var(--grey)]", className)}>{children}</span>;
}

interface SegmentedProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean | undefined;
  className?: string | undefined;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
  className,
}: SegmentedProps<T>) {
  return (
    <div className={cn("inline-flex gap-1 rounded-md bg-[var(--surface-1)] p-1", className)}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option)}
            className={cn(
              "rounded-[5px] px-3.5 py-1.5 text-xs transition-all duration-200",
              "disabled:cursor-not-allowed disabled:opacity-40",
              selected
                ? "bg-[var(--surface-3)] text-[var(--platinum)] shadow-[var(--glow-soft)]"
                : "text-[var(--grey)] hover:text-[var(--platinum)]/80",
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

export function GhostButton({
  children,
  onClick,
  className,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string | undefined;
  disabled?: boolean | undefined;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-md border border-[var(--hairline)] px-3.5 py-1.5 text-xs text-[var(--grey)]",
        "transition-all duration-200 hover:border-[var(--platinum)]/25 hover:text-[var(--platinum)]",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}
