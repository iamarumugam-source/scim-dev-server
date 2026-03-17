"use client";

import { CopyButton } from "./copy-button";

const METHOD_STYLE: Record<"GET" | "POST", string> = {
  GET:  "bg-muted text-muted-foreground border-r-border",
  POST: "bg-muted text-muted-foreground border-r-border",
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
