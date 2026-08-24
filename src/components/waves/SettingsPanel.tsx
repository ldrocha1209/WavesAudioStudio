import { FORMATS, MOCK_FOLDERS, qualitiesFor } from "@/lib/waves/mock";
import type { AppSettings } from "@/lib/waves/types";
import type { EngineProofStatus } from "@/lib/waves/useEngineProof";
import { cn } from "@/lib/utils";
import { GhostButton, Label, Segmented } from "./primitives";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-8 border-b border-[var(--hairline)] py-5 last:border-b-0">
      <span className="text-sm text-[var(--platinum)]/90">{label}</span>
      {children}
    </div>
  );
}

export function SettingsPanel({
  open,
  settings,
  onChange,
  onClose,
  engineProofStatus,
  native,
}: {
  open: boolean;
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  onClose: () => void;
  engineProofStatus: EngineProofStatus;
  native: boolean;
}) {
  if (!open) return null;

  return (
    <div
      className="animate-soft-fade fixed inset-0 z-40 flex justify-end bg-[color-mix(in_oklab,var(--shadow-grey)_72%,transparent)]"
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="scrollarea animate-rise h-full w-[440px] bg-[var(--surface-1)] px-9 py-8 shadow-[var(--glow-strong)]"
      >
        <div className="flex items-center justify-between">
          <Label>Settings</Label>
          <button
            onClick={onClose}
            className="text-[10px] tracking-[0.2em] text-[var(--grey)] uppercase transition-colors duration-200 hover:text-[var(--platinum)]"
          >
            Close
          </button>
        </div>

        <div className="mt-8">
          <Row label="Default output folder">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-[var(--grey)]">{settings.outputFolder}</span>
              <GhostButton
                disabled={native}
                title={native ? "Choose a destination from the export screen" : undefined}
                onClick={() => {
                  const next =
                    MOCK_FOLDERS[
                      (MOCK_FOLDERS.indexOf(settings.outputFolder) + 1) % MOCK_FOLDERS.length
                    ]!;
                  onChange({ ...settings, outputFolder: next });
                }}
              >
                {native ? "Set per export" : "Change"}
              </GhostButton>
            </div>
          </Row>
          <Row label="Default format">
            <Segmented
              options={FORMATS}
              value={settings.defaultFormat}
              onChange={(defaultFormat) =>
                onChange({
                  ...settings,
                  defaultFormat,
                  defaultQuality: qualitiesFor(defaultFormat).includes(settings.defaultQuality)
                    ? settings.defaultQuality
                    : qualitiesFor(defaultFormat)[0],
                })
              }
            />
          </Row>
          <Row label="Default quality">
            <Segmented
              options={qualitiesFor(settings.defaultFormat)}
              value={settings.defaultQuality}
              onChange={(defaultQuality) => onChange({ ...settings, defaultQuality })}
              disabled={qualitiesFor(settings.defaultFormat).length === 1}
            />
          </Row>
          <Row label="Hardware acceleration">
            <Segmented
              options={["Automatic", "GPU", "CPU only"] as const}
              value={settings.hardwareAcceleration}
              onChange={(hardwareAcceleration) => onChange({ ...settings, hardwareAcceleration })}
            />
          </Row>
          <Row label="Appearance">
            <Segmented
              options={["Shadow", "Shadow (contrast)"] as const}
              value={settings.appearance}
              onChange={(appearance) => onChange({ ...settings, appearance })}
            />
          </Row>
        </div>

        <div className={cn("mt-10 rounded-md bg-[var(--surface-2)]/60 px-5 py-5")}>
          <Label>About</Label>
          <p className="mt-4 text-sm text-[var(--platinum)]/85">Waves 1.0.0 — local build</p>
          <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-[var(--grey)]">
            Downloads, conversions, and stem separation run locally. YouTube access requires an
            internet connection.
          </p>
          <p className="mt-3 font-mono text-[10px] tracking-wide text-[var(--grey)] uppercase">
            Desktop engine · {engineProofStatus}
          </p>
        </div>
      </aside>
    </div>
  );
}
