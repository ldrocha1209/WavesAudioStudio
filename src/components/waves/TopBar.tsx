import { Label } from "./primitives";

export function TopBar({
  onSettings,
  onReset,
  showReset,
}: {
  onSettings: () => void;
  onReset: () => void;
  showReset: boolean;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--hairline)] px-8">
      <div className="flex items-baseline gap-4">
        <span className="wordmark text-sm text-[var(--platinum)]">Waves</span>
        <span className="font-mono text-[10px] text-[var(--grey)]/70">0.1.0</span>
      </div>
      <div className="flex items-center gap-6">
        {showReset && (
          <button
            onClick={onReset}
            className="transition-colors duration-200 hover:text-[var(--platinum)]"
          >
            <Label className="hover:text-[var(--platinum)]">New Track</Label>
          </button>
        )}
        <button onClick={onSettings} className="transition-colors duration-200">
          <Label className="transition-colors duration-200 hover:text-[var(--platinum)]">Settings</Label>
        </button>
      </div>
    </header>
  );
}
