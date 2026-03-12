"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { HarEntry, HarHeader } from "./types";

function HeaderSection({ title, headers }: { title: string; headers: HarHeader[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-border/60 last:border-0">
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors"
      >
        <span className={cn("transition-transform", open ? "rotate-90" : "")} style={{ fontSize: 9 }}>▶</span>
        {title}
        <span className="ml-1 text-muted-foreground font-normal">({headers.length})</span>
      </button>
      {open && (
        <div className="px-3 pb-2">
          {headers.map((h, i) => (
            <div key={i} className="flex gap-2 py-0.5 text-xs font-mono leading-5 rounded hover:bg-muted/40 px-1 -mx-1 transition-colors">
              <span className="font-semibold text-foreground flex-shrink-0 min-w-[160px] max-w-[220px] truncate" title={h.name}>
                {h.name}:
              </span>
              <span className="text-foreground/80 break-all min-w-0">{h.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function HeadersPanel({ entry }: { entry: HarEntry }) {
  return (
    <div className="rounded-md border border-border overflow-hidden text-xs font-mono bg-card">
      <div className="border-b border-border/60">
        <div className="px-3 py-1.5 text-xs font-semibold text-foreground">General</div>
        <div className="px-3 pb-2 space-y-0.5">
          {[
            ["Request URL",    entry.request.url],
            ["Request Method", entry.request.method],
            ["Status Code",    `${entry.response.status} ${entry.response.statusText}`],
            ["HTTP Version",   entry.response.httpVersion],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2 py-0.5 leading-5 rounded hover:bg-muted/40 px-1 -mx-1 transition-colors">
              <span className="font-semibold text-foreground flex-shrink-0 min-w-[160px]">{k}:</span>
              <span className="text-foreground/80 break-all min-w-0">{v}</span>
            </div>
          ))}
        </div>
      </div>
      <HeaderSection title="Response Headers"        headers={entry.response.headers} />
      <HeaderSection title="Request Headers"         headers={entry.request.headers} />
      {entry.request.queryString.length > 0 && (
        <HeaderSection title="Query String Parameters" headers={entry.request.queryString} />
      )}
      {entry.request.cookies.length > 0 && (
        <HeaderSection title="Request Cookies"       headers={entry.request.cookies} />
      )}
    </div>
  );
}
