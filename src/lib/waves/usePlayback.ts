import { useEffect, useRef, useState } from "react";

/**
 * Mocked transport. Advances a playhead in real time without touching an
 * audio element — swap for real decoding when the desktop backend lands.
 */
export function usePlayback(duration: number) {
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const raf = useRef(0);
  const last = useRef(0);

  useEffect(() => {
    setPlaying(false);
    setTime(0);
  }, [duration]);

  useEffect(() => {
    if (!playing) return;
    last.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - last.current) / 1000;
      last.current = now;
      setTime((t) => {
        const next = t + dt;
        if (next >= duration) {
          setPlaying(false);
          return duration;
        }
        return next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, duration]);

  return {
    playing,
    time,
    toggle: () => setPlaying((p) => (time >= duration ? (setTime(0), true) : !p)),
    seek: (position: number) => setTime(position * duration),
    stop: () => setPlaying(false),
    progress: duration ? time / duration : 0,
  };
}
