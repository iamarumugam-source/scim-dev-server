"use client";

import { useCallback, useEffect, useState } from "react";

export interface HarHistoryEntry {
  name:       string;
  timestamp:  string; // ISO
  entryCount: number;
}

const KEY      = "har_file_history";
const MAX_ENTRIES = 10;

function load(): HarHistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as HarHistoryEntry[];
  } catch {
    return [];
  }
}

export function useHarHistory() {
  const [history, setHistory] = useState<HarHistoryEntry[]>([]);

  useEffect(() => {
    setHistory(load());
  }, []);

  const addEntry = useCallback((name: string, entryCount: number) => {
    setHistory((prev) => {
      // Remove any prior record of the same filename, then prepend the new one
      const deduped = prev.filter((e) => e.name !== name);
      const next = [
        { name, entryCount, timestamp: new Date().toISOString() },
        ...deduped,
      ].slice(0, MAX_ENTRIES);
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(KEY);
    setHistory([]);
  }, []);

  return { history, addEntry, clearHistory };
}
