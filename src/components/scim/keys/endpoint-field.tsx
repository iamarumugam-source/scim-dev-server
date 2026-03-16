"use client";

import { CopyButton } from "./copy-button";

const METHOD_STYLE: Record<"GET" | "POST", string> = {
  GET:  "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-r-blue-200 dark:border-r-blue-800",
  POST: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400 border-r-green-200 dark:border-r-green-800",
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
