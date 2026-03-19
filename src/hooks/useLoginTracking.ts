"use client";

import { useEffect } from "react";

/** Session-storage key — ensures we log at most once per browser session. */
const SESSION_KEY = "login_tracked";

/**
 * Fires a single POST to record a login event the first time this hook
 * runs in a new browser session for the given user.  Subsequent renders
 * or page navigations within the same tab session are no-ops.
 */
export function useLoginTracking(userId: string | undefined): void {
  useEffect(() => {
    if (!userId) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    sessionStorage.setItem(SESSION_KEY, "1");
    fetch(`/api/${userId}/login-activity`, { method: "POST" }).catch(() => {});
  }, [userId]);
}
