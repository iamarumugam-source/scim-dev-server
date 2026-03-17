"use client";

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "scim_user_timezone";

/** Returns the browser's detected IANA timezone as a safe fallback. */
function browserTimezone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; }
  catch { return "UTC"; }
}

/**
 * Read / write the user's preferred timezone.
 * Persisted in localStorage; defaults to the browser's detected timezone.
 */
export function useUserTimezone() {
  const [timezone, setTimezoneState] = useState<string>("UTC");
  const [isReady,  setIsReady]       = useState(false);

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    const stored = typeof window !== "undefined"
      ? localStorage.getItem(STORAGE_KEY)
      : null;
    setTimezoneState(stored ?? browserTimezone());
    setIsReady(true);
  }, []);

  const setTimezone = useCallback((tz: string) => {
    setTimezoneState(tz);
    try { localStorage.setItem(STORAGE_KEY, tz); } catch {}
  }, []);

  return { timezone, setTimezone, isReady };
}
