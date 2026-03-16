"use client";

import { useCallback, useRef } from "react";

export function useSound(url: string) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  return useCallback(
    (volume = 1) => {
      try {
        if (!audioRef.current) {
          audioRef.current = new Audio(url);
        }
        audioRef.current.volume = Math.min(1, Math.max(0, volume));
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      } catch {}
    },
    [url],
  );
}
