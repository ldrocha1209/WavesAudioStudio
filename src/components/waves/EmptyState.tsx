import { useState } from "react";
import { cn } from "@/lib/utils";
import { Label } from "./primitives";

interface EmptyStateProps {
  onFile: (name: string) => void;
  onUrl: (url: string) => void;
  onBrowse: () => void;
  loading: boolean;
}

export function EmptyState({ onFile, onUrl, onBrowse, loading }: EmptyStateProps) {
  const [url, setUrl] = useState("");
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        onFile(file ? file.name : "Untitled Session.wav");
      }}
      className={cn(
        "relative flex h-full flex-col items-center justify-center px-10 transition-all duration-300",
        dragging && "scale-[1.005]",
      )}
    >
      {/* ambient illumination */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: dragging ? 1 : 0.45,
          background:
            "radial-gradient(60% 50% at 50% 42%, color-mix(in oklab, var(--platinum) 8%, transparent), transparent 72%)",
        }}
      />

      <div className={cn("relative flex flex-col items-center", loading && "opacity-40")}>
        <h1 className="wordmark animate-rise text-[2.6rem] leading-none text-[var(--platinum)]">
          Waves
        </h1>
        <p className="animate-rise mt-5 text-sm tracking-[0.28em] text-[var(--grey)] uppercase [animation-delay:60ms]">
          Download. Separate. Create.
        </p>

        <div className="animate-rise mt-16 w-full max-w-xl [animation-delay:120ms]">
          <div
            className={cn(
              "relative rounded-lg px-10 py-12 text-center transition-all duration-300",
              dragging
                ? "bg-[var(--surface-2)] shadow-[var(--glow-strong)]"
                : "bg-[var(--surface-1)]/60 shadow-[var(--glow-soft)]",
            )}
          >
            <div className="mx-auto flex h-9 w-full max-w-56 items-end justify-center gap-[3px]">
              {Array.from({ length: 34 }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "w-[2px] rounded-full transition-all duration-300",
                    dragging ? "bg-[var(--platinum)]/80" : "bg-[var(--grey)]/40",
                  )}
                  style={{
                    height: `${18 + Math.abs(Math.sin(i * 0.7)) * (dragging ? 80 : 46)}%`,
                    transitionDelay: `${i * 6}ms`,
                  }}
                />
              ))}
            </div>
            <p className="mt-7 text-sm text-[var(--platinum)]/90">
              {dragging ? "Release to load track" : "Drop an audio file to begin"}
            </p>
            <p className="mt-2 font-mono text-[11px] tracking-wider text-[var(--grey)]">
              MP3 · WAV · FLAC · AIFF · M4A
            </p>
            <button
              type="button"
              onClick={onBrowse}
              disabled={loading}
              className="mt-5 rounded-md border border-[var(--hairline)] px-4 py-2 text-[11px] tracking-wide text-[var(--grey)] transition-colors hover:text-[var(--platinum)]"
            >
              Browse files
            </button>
          </div>

          <div className="mt-10 flex items-center gap-4">
            <span className="h-px flex-1 bg-[var(--hairline)]" />
            <Label>or paste a link</Label>
            <span className="h-px flex-1 bg-[var(--hairline)]" />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              onUrl(url);
            }}
            className="group mt-8 flex items-center gap-3 border-b border-[var(--hairline)] pb-3 transition-colors duration-200 focus-within:border-[var(--platinum)]/40"
          >
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=…"
              spellCheck={false}
              className="flex-1 bg-transparent text-sm text-[var(--platinum)] outline-none placeholder:text-[var(--grey)]/70"
            />
            <button
              type="submit"
              disabled={!url.trim() || loading}
              className={cn(
                "rounded-md px-4 py-1.5 text-xs tracking-wide transition-all duration-200",
                url.trim()
                  ? "bg-[var(--surface-3)] text-[var(--platinum)] shadow-[var(--glow-soft)] hover:shadow-[var(--glow-strong)]"
                  : "text-[var(--grey)]",
              )}
            >
              Load
            </button>
          </form>
        </div>
      </div>

      {loading && (
        <p className="animate-soft-fade absolute bottom-16 font-mono text-[11px] tracking-[0.2em] text-[var(--grey)] uppercase">
          <span className="animate-breathe">Reading source…</span>
        </p>
      )}
    </div>
  );
}
