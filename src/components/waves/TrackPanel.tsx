import { formatTime } from "@/lib/waves/mock";
import type { Track } from "@/lib/waves/types";
import { usePlayback } from "@/lib/waves/usePlayback";
import { Label, Meta } from "./primitives";
import { TransportButton } from "./Transport";
import { Waveform } from "./Waveform";

export function TrackPanel({ track, scan }: { track: Track; scan?: number | undefined }) {
  const player = usePlayback(track.duration, track.sourcePath);

  return (
    <section className="animate-rise">
      <div className="flex items-start gap-6">
        <img
          src={track.artwork}
          alt=""
          width={96}
          height={96}
          className="h-24 w-24 shrink-0 rounded-md object-cover shadow-[var(--glow-soft)]"
        />
        <div className="min-w-0 flex-1 pt-1">
          <Label>{track.sourceKind === "youtube" ? "YouTube" : "Local file"}</Label>
          <h2 className="mt-2 truncate text-2xl leading-tight font-medium text-[var(--platinum)]">
            {track.title}
          </h2>
          <p className="mt-1.5 text-sm text-[var(--grey)]">{track.artist}</p>
          <p className="mt-3 truncate font-mono text-[11px] text-[var(--grey)]/80">
            {track.source}
          </p>
        </div>
        <Meta className="pt-1 text-sm">{formatTime(track.duration)}</Meta>
      </div>

      <div className="mt-9 flex items-center gap-6">
        <TransportButton playing={player.playing} onToggle={player.toggle} />
        <Waveform
          peaks={track.peaks}
          progress={player.progress}
          scan={scan}
          onSeek={player.seek}
          height={116}
          className="flex-1"
        />
      </div>
      <div className="mt-3 flex justify-between pl-[68px]">
        <Meta>{formatTime(player.time)}</Meta>
        <Meta>{formatTime(track.duration)}</Meta>
      </div>
    </section>
  );
}
