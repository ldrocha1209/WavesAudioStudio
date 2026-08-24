import { useState } from "react";
import { FORMATS, MOCK_FOLDERS } from "@/lib/waves/mock";
import type { AudioFormat, ExportSettings, Quality } from "@/lib/waves/types";
import { cn } from "@/lib/utils";
import { GhostButton, Label, Segmented } from "./primitives";

export function ExportPanel({
  settings,
  qualities,
  onFormat,
  onQuality,
  onLocation,
  onBrowse,
  native,
  disabled,
}: {
  settings: ExportSettings;
  qualities: Quality[];
  onFormat: (format: AudioFormat) => void;
  onQuality: (quality: Quality) => void;
  onLocation: (path: string) => void;
  onBrowse: () => void;
  native: boolean;
  disabled?: boolean | undefined;
}) {
  const [browsing, setBrowsing] = useState(false);

  return (
    <section>
      <Label>Export</Label>
      <div className="mt-5 grid grid-cols-[auto_auto_1fr] items-center gap-x-10 gap-y-6">
        <div>
          <p className="mb-2 text-[11px] text-[var(--grey)]">Format</p>
          <Segmented
            options={FORMATS}
            value={settings.format}
            onChange={onFormat}
            disabled={disabled}
          />
        </div>
        <div>
          <p className="mb-2 text-[11px] text-[var(--grey)]">Quality</p>
          <Segmented
            options={qualities}
            value={settings.quality}
            onChange={onQuality}
            disabled={disabled || qualities.length === 1}
          />
        </div>
        <div className="justify-self-end text-right">
          <p className="mb-2 text-[11px] text-[var(--grey)]">Save to</p>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-[var(--platinum)]/85">{settings.location}</span>
            <GhostButton
              onClick={() => (native ? onBrowse() : setBrowsing(true))}
              disabled={disabled}
            >
              Browse
            </GhostButton>
          </div>
        </div>
      </div>

      {browsing && !native && (
        <div
          className="animate-soft-fade fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_oklab,var(--shadow-grey)_78%,transparent)] px-6"
          onClick={() => setBrowsing(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-rise w-full max-w-md rounded-lg bg-[var(--surface-1)] p-6 shadow-[var(--glow-strong)]"
          >
            <Label>Choose destination</Label>
            <div className="mt-5 space-y-1">
              {MOCK_FOLDERS.map((folder) => (
                <button
                  key={folder}
                  onClick={() => {
                    onLocation(folder);
                    setBrowsing(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-3 py-2.5 font-mono text-xs transition-colors duration-200",
                    folder === settings.location
                      ? "bg-[var(--surface-3)] text-[var(--platinum)]"
                      : "text-[var(--grey)] hover:bg-[var(--surface-2)] hover:text-[var(--platinum)]",
                  )}
                >
                  {folder}
                  {folder === settings.location && (
                    <span className="text-[10px] tracking-[0.2em] uppercase">Current</span>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <GhostButton onClick={() => setBrowsing(false)}>Cancel</GhostButton>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
