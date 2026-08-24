import { useEffect, useRef, useState } from "react";

let activeAudio: HTMLAudioElement | null = null;

export function usePlayback(duration: number, path?: string) {
  const native = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const raf = useRef(0);
  const last = useRef(0);

  useEffect(() => {
    setPlaying(false);
    setTime(0);
    if (!path || !native) {
      setAudio(null);
      return;
    }
    let element: HTMLAudioElement | undefined;
    void import("@tauri-apps/api/core").then(({ convertFileSrc }) => {
      element = new Audio(convertFileSrc(path));
      element.preload = "metadata";
      element.addEventListener("timeupdate", () => setTime(element?.currentTime ?? 0));
      element.addEventListener("play", () => setPlaying(true));
      element.addEventListener("pause", () => setPlaying(false));
      element.addEventListener("ended", () => setPlaying(false));
      setAudio(element);
    });
    return () => {
      if (element) {
        element.pause();
        element.removeAttribute("src");
        element.load();
        if (activeAudio === element) activeAudio = null;
      }
    };
  }, [duration, native, path]);

  useEffect(() => {
    if (audio || !playing) return;
    last.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - last.current) / 1000;
      last.current = now;
      setTime((current) => {
        const next = current + dt;
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
  }, [audio, playing, duration]);

  const toggle = () => {
    if (audio) {
      if (audio.paused) {
        if (activeAudio && activeAudio !== audio) activeAudio.pause();
        activeAudio = audio;
        if (audio.currentTime >= audio.duration) audio.currentTime = 0;
        void audio.play();
      } else {
        audio.pause();
      }
      return;
    }
    if (!native) setPlaying((current) => (time >= duration ? (setTime(0), true) : !current));
  };

  const seek = (position: number) => {
    const next = position * duration;
    if (audio) audio.currentTime = next;
    setTime(next);
  };

  return {
    playing,
    time,
    toggle,
    seek,
    stop: () => (audio ? audio.pause() : setPlaying(false)),
    progress: duration ? time / duration : 0,
  };
}
