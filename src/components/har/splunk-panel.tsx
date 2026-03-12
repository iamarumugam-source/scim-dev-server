"use client";

import { useState } from "react";
import { Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { HarEntry } from "./types";

interface Props {
  entry:      HarEntry;
  orgId:      string | null;
  cell:       string | null;
  orgPending: boolean;
}

export function SplunkPanel({ entry, orgId, cell, orgPending }: Props) {
  const requestId = entry.response.headers.find(h => h.name.toLowerCase() === "x-okta-request-id")?.value ?? "";
  const query     = cell ? `index="${cell}*" "${requestId}"` : null;

  const [copiedId,    setCopiedId]    = useState(false);
  const [copiedQuery, setCopiedQuery] = useState(false);

  const copy = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-4 font-mono text-xs">
      <div className="space-y-1.5">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          x-okta-request-id
        </p>
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
          <span className="flex-1 break-all text-foreground">{requestId}</span>
          <button onClick={() => copy(requestId, setCopiedId)} className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors">
            {copiedId ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Okta Org ID
          <span className="ml-1.5 normal-case font-normal text-muted-foreground/60">(from /.well-known/okta-organization)</span>
        </p>
        {orgPending ? (
          <div className="flex items-center gap-2 text-muted-foreground px-1">
            <Loader2 className="h-3 w-3 animate-spin" /><span>Fetching…</span>
          </div>
        ) : orgId ? (
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-foreground">{orgId}</div>
        ) : (
          <div className="text-muted-foreground/60 px-1">Could not retrieve org info — CORS or network error.</div>
        )}
      </div>

      <div className="space-y-1.5">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cell</p>
        {orgPending ? (
          <div className="flex items-center gap-2 text-muted-foreground px-1">
            <Loader2 className="h-3 w-3 animate-spin" /><span>Fetching…</span>
          </div>
        ) : cell ? (
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-foreground">{cell}</div>
        ) : !orgPending && orgId !== null ? (
          <div className="text-muted-foreground/60 px-1">Cell not returned in org metadata.</div>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Splunk Query</p>
        {query ? (
          <div className="relative rounded-md border border-border bg-muted/30">
            <pre className="px-3 py-2 pr-10 text-xs overflow-auto whitespace-pre-wrap break-all text-foreground">{query}</pre>
            <button
              onClick={() => copy(query, setCopiedQuery)}
              className="absolute right-2 top-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {copiedQuery ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        ) : (
          <div className="text-muted-foreground/60 px-1">
            {orgPending ? "Waiting for cell…" : "Cell unavailable — cannot construct query."}
          </div>
        )}
      </div>
    </div>
  );
}
