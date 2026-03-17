"use client";

import { useState } from "react";
import { OIDC_PARAM_INFO } from "./constants";
import { tryBase64UrlDecode } from "./utils";
import { Button } from "@/components/ui/button";
import type { HarEntry } from "./types";

export function OidcUrlPanel({ entry }: { entry: HarEntry }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const params: { key: string; value: string }[] = [];

  try {
    new URL(entry.request.url).searchParams.forEach((v, k) => params.push({ key: k, value: v }));
  } catch {}

  const contentType = (entry.request.headers.find(
    (h) => h.name.toLowerCase() === "content-type",
  )?.value ?? "").toLowerCase();

  if (contentType.includes("x-www-form-urlencoded") && entry.request.postData?.text) {
    try {
      new URLSearchParams(entry.request.postData.text).forEach((v, k) => params.push({ key: k, value: v }));
    } catch {}
  }

  if (params.length === 0) {
    return (
      <div className="rounded-md border border-border bg-card p-4 text-xs text-muted-foreground font-mono">
        No URL or form parameters found for this request.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border overflow-hidden bg-card text-xs font-mono">
      {params.map(({ key, value }, i) => {
        const info    = OIDC_PARAM_INFO[key];
        const isScope = key === "scope";
        const decoded = info?.decode ? tryBase64UrlDecode(value) : null;
        const isOpen  = expanded[key] ?? false;

        return (
          <div key={i} className="border-b border-border/50 last:border-0">
            <div className="flex items-start gap-3 px-3 py-2 hover:bg-muted/30 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground">{key}</span>
                  {info && (
                    <span className="text-[10px] text-muted-foreground font-sans">— {info.description}</span>
                  )}
                </div>
                {isScope ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {value.split(/\s+/).map((s) => (
                      <span key={s} className="px-1.5 py-px rounded bg-muted text-foreground/80 text-[10px]">{s}</span>
                    ))}
                  </div>
                ) : (
                  <div className="mt-0.5 text-foreground/80 break-all">{value}</div>
                )}
              </div>
              {decoded && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setExpanded((p) => ({ ...p, [key]: !isOpen }))}
                  className="flex-shrink-0 h-auto p-0 text-[10px] mt-0.5"
                >
                  {isOpen ? "hide" : "decode"}
                </Button>
              )}
            </div>
            {decoded && isOpen && (
              <div className="px-3 pb-3 bg-muted/20 border-t border-border/40">
                <div className="pt-2 mb-1.5">
                  <span className="text-[10px] font-sans text-muted-foreground uppercase tracking-wide">
                    {decoded.parsed ? "Decoded JSON" : "Decoded value"}
                  </span>
                </div>
                <pre className="text-[11px] text-foreground/90 whitespace-pre-wrap break-all leading-relaxed">
                  {decoded.text}
                </pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
