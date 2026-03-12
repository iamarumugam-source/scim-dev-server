"use client";

import { cn } from "@/lib/utils";
import { TIMING_BARS } from "./constants";
import { formatDuration } from "./utils";
import type { HarEntry } from "./types";

interface Props {
  timings: HarEntry["timings"];
  total:   number;
}

export function TimingPanel({ timings, total }: Props) {
  const positiveTotal = TIMING_BARS.reduce((s, b) => s + Math.max(0, timings[b.key] ?? 0), 0);

  return (
    <div className="rounded-md border border-border overflow-hidden bg-card p-3 space-y-2 text-xs font-mono">
      {TIMING_BARS.map(({ key, label, color }) => {
        const val = timings[key];
        if (val === undefined || val < 0) return null;
        const pct = positiveTotal > 0 ? (val / positiveTotal) * 100 : 0;
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="text-muted-foreground w-40 flex-shrink-0">{label}</span>
            <div className="flex-1 h-3 bg-muted rounded-sm overflow-hidden">
              <div className={cn("h-full rounded-sm", color)} style={{ width: `${pct}%`, minWidth: pct > 0 ? 2 : 0 }} />
            </div>
            <span className="text-right w-20 tabular-nums">{formatDuration(val)}</span>
          </div>
        );
      })}
      <div className="border-t border-border/60 pt-1.5 flex justify-between">
        <span className="text-muted-foreground">Total</span>
        <span className="tabular-nums font-semibold">{formatDuration(total)}</span>
      </div>
    </div>
  );
}
