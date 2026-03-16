"use client";

import { useCallback } from "react";

export function useMetaColor() {
  const setMetaColor = useCallback((color: string) => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) {
      meta.content = color;
    }
  }, []);

  return { setMetaColor };
}
