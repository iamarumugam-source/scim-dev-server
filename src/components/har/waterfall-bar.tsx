"use client";

import type { HarEntry } from "./types";

interface Props {
  entry:       HarEntry;
  startOffset: number;
  totalSpan:   number;
}

export function WaterfallBar({ entry, startOffset, totalSpan }: Props) {
  if (totalSpan <= 0) return null;

  const left    = (startOffset / totalSpan) * 100;
  const width   = Math.max((entry.time / totalSpan) * 100, 0.3);
  const wait    = (Math.max(0, entry.timings.wait)    / entry.time) * width;
  const receive = (Math.max(0, entry.timings.receive) / entry.time) * width;
  const other   = width - wait - receive;

  return (
    <div className="relative h-3 w-full">
      <div className="absolute h-full" style={{ left: `${left}%`, width: `${width}%` }}>
        <div className="flex h-full w-full overflow-hidden rounded-sm">
          <div className="bg-green-200 dark:bg-green-900" style={{ width: `${(other   / width) * 100}%` }} />
          <div className="bg-green-500 dark:bg-green-500" style={{ width: `${(wait    / width) * 100}%` }} />
          <div className="bg-blue-500  dark:bg-blue-400"  style={{ width: `${(receive / width) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
