"use client";

import { CopyButton } from "./copy-button";

// Both entries used to be the same muted grey, so the map existed but the method
// was never actually distinguishable. Colour follows the usual HTTP convention:
// green reads "safe/read", blue reads "write".
const METHOD_STYLE: Record<"GET" | "POST", string> = {
  GET:  "bg-emerald-100 text-emerald-700 border-r-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-r-emerald-800",
  POST: "bg-blue-100 text-blue-700 border-r-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-r-blue-800",
};

interface EndpointFieldProps {
  method: "GET" | "POST";
  value: string;
}

export function EndpointField({ method, value }: EndpointFieldProps) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">URL</p>
      <div className="flex items-stretch rounded-md border border-border bg-muted/30 overflow-hidden">
        {/* Method label — full height, pinned left, separated by a border */}
        <div className={`flex items-center px-3 text-[11px] font-bold font-mono tracking-wide border-r ${METHOD_STYLE[method]}`}>
          {method}
        </div>
        {/* URL + copy */}
        <div className="flex items-center flex-1 min-w-0 gap-2 px-3 py-2">
          <code className="flex-1 text-xs font-mono text-foreground truncate min-w-0">{value}</code>
          <CopyButton value={value} />
        </div>
      </div>
    </div>
  );
}
