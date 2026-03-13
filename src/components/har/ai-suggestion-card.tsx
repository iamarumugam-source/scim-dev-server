"use client";

import { useState, useRef } from "react";
import { Sparkles, Loader2, AlertCircle, X, Clipboard, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { urlName, getOidcInfo } from "./utils";
import type { HarEntry } from "./types";

// ─── Markdown renderer ────────────────────────────────────────────────────────

const mdComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-sm font-bold text-foreground mt-4 mb-1.5 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xs font-bold text-foreground uppercase tracking-wide mt-4 mb-1.5 first:mt-0 border-b border-border/50 pb-1">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-xs font-semibold text-foreground mt-3 mb-1 first:mt-0">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-[11px] text-foreground/90 leading-relaxed mb-2 last:mb-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-outside ml-4 space-y-0.5 mb-2 last:mb-0 text-[11px] text-foreground/90">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside ml-4 space-y-0.5 mb-2 last:mb-0 text-[11px] text-foreground/90">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed pl-0.5">{children}</li>
  ),
  pre: ({ children }) => (
    <pre className="bg-muted rounded-md p-3 overflow-x-auto text-[11px] font-mono text-foreground border border-border/60 mb-2 last:mb-0">
      {children}
    </pre>
  ),
  code: ({ className, children }) => {
    const isBlock = Boolean(className?.startsWith("language-"));
    return isBlock ? (
      <code className={cn("font-mono text-[11px] text-foreground", className)}>
        {children}
      </code>
    ) : (
      <code className="font-mono text-[10px] bg-muted text-foreground px-1 py-0.5 rounded border border-border/50">
        {children}
      </code>
    );
  },
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline break-all"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-foreground/80">{children}</em>
  ),
  hr: () => <hr className="border-border/60 my-3" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary/40 pl-3 text-muted-foreground italic text-[11px] mb-2 last:mb-0">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-2 last:mb-0">
      <table className="w-full text-[11px] border-collapse border border-border/60 rounded">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-muted text-foreground font-medium">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-border/40">{children}</tbody>
  ),
  tr: ({ children }) => <tr className="divide-x divide-border/40">{children}</tr>,
  th: ({ children }) => (
    <th className="px-2 py-1 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-2 py-1 text-foreground/85">{children}</td>
  ),
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  entry:   HarEntry;
  onClose: () => void;
}

function buildClipboardText(entry: HarEntry): string {
  const oidcPhase = getOidcInfo(entry.request.url, entry.request.method)?.label;

  const safeHeaders = Object.fromEntries(
    entry.request.headers
      .filter((h) => !["cookie", "authorization", "set-cookie"].includes(h.name.toLowerCase()))
      .slice(0, 12)
      .map((h) => [h.name, h.value]),
  );

  const urlParams: Record<string, string> = {};
  try { new URL(entry.request.url).searchParams.forEach((v, k) => { urlParams[k] = v; }); } catch {}

  const bodyParams: Record<string, string> = {};
  const ct = (entry.request.headers.find((h) => h.name.toLowerCase() === "content-type")?.value ?? "").toLowerCase();
  if (ct.includes("x-www-form-urlencoded") && entry.request.postData?.text) {
    try { new URLSearchParams(entry.request.postData.text).forEach((v, k) => { bodyParams[k] = v; }); } catch {}
  }

  const responseJson = (() => { try { return JSON.parse(entry.response.content?.text ?? ""); } catch { return null; } })();

  const lines: string[] = [
    "You are an expert Okta developer assistant specialising in OIDC/OAuth 2.0, SCIM, and the Okta platform.",
    "Analyse the failing API request below and provide specific, actionable troubleshooting guidance.",
    "Reference developer.okta.com for documentation. Identify the root cause first, then give numbered steps to fix it.",
    "",
    "---",
    "",
    `Analyse this failing ${oidcPhase ? `OIDC ${oidcPhase}` : "API"} request and suggest specific fixes:`,
    "",
    `  Endpoint:   ${entry.request.method} ${entry.request.url}`,
    `  Status:     ${entry.response.status} ${entry.response.statusText}`,
  ];

  if (oidcPhase) lines.push(`  OIDC Phase: ${oidcPhase}`);

  if (Object.keys(urlParams).length > 0) {
    lines.push("", "URL query parameters sent:");
    Object.entries(urlParams).forEach(([k, v]) => lines.push(`  ${k}: ${v}`));
  }

  if (Object.keys(bodyParams).length > 0) {
    lines.push("", "Request body parameters sent:");
    Object.entries(bodyParams).forEach(([k, v]) => lines.push(`  ${k}: ${v}`));
  }

  if (Object.keys(safeHeaders).length > 0) {
    lines.push("", "Key request headers:");
    Object.entries(safeHeaders).forEach(([k, v]) => lines.push(`  ${k}: ${v}`));
  }

  if (responseJson && typeof responseJson === "object") {
    const r = responseJson as Record<string, unknown>;
    lines.push("", "Response error details:");
    for (const field of ["error", "error_description", "errorCode", "errorSummary", "errorLink", "errorId"]) {
      if (r[field]) lines.push(`  ${field}: ${r[field]}`);
    }
    if (Array.isArray(r.errorCauses) && r.errorCauses.length > 0) {
      lines.push("  errorCauses:");
      (r.errorCauses as unknown[]).slice(0, 3).forEach((c) => lines.push(`    - ${JSON.stringify(c)}`));
    }
  }

  lines.push(
    "",
    "---",
    "",
    "Respond in this format:",
    "## Root Cause",
    "(one-paragraph explanation referencing the exact parameter values)",
    "",
    "## Steps to Fix",
    "(numbered list with specific values to change or verify)",
    "",
    "## Relevant Okta Documentation",
    "(bulleted list of URLs from developer.okta.com)",
  );

  return lines.join("\n");
}

export function AiSuggestionCard({ entry, onClose }: Props) {
  const [phase,      setPhase]      = useState<"idle" | "loading" | "done" | "error">("idle");
  const [suggestion, setSuggestion] = useState("");
  const [copied,     setCopied]     = useState(false);
  const abortRef                    = useRef<AbortController | null>(null);

  const copyForLLM = () => {
    navigator.clipboard.writeText(buildClipboardText(entry));
    toast.success("Context copied — paste into any LLM chat.");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const analyze = async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setPhase("loading");
    setSuggestion("");

    try {
      const safeHeaders = Object.fromEntries(
        entry.request.headers
          .filter((h) => !["cookie", "authorization", "set-cookie"].includes(h.name.toLowerCase()))
          .slice(0, 12)
          .map((h) => [h.name, h.value]),
      );

      // Parse URL query parameters explicitly
      const urlParams: Record<string, string> = {};
      try {
        new URL(entry.request.url).searchParams.forEach((v, k) => { urlParams[k] = v; });
      } catch {}

      // Parse form-encoded body parameters explicitly
      const bodyParams: Record<string, string> = {};
      const contentType = (entry.request.headers.find(
        (h) => h.name.toLowerCase() === "content-type",
      )?.value ?? "").toLowerCase();
      if (contentType.includes("x-www-form-urlencoded") && entry.request.postData?.text) {
        try {
          new URLSearchParams(entry.request.postData.text).forEach((v, k) => { bodyParams[k] = v; });
        } catch {}
      }

      // Extract structured Okta error fields from JSON response
      const responseJson = (() => {
        try { return JSON.parse(entry.response.content?.text ?? ""); } catch { return null; }
      })();

      const res = await fetch("/api/ai/suggest", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        signal:  ctrl.signal,
        body: JSON.stringify({
          url:            entry.request.url,
          method:         entry.request.method,
          status:         entry.response.status,
          statusText:     entry.response.statusText,
          oidcPhase:      getOidcInfo(entry.request.url, entry.request.method)?.label,
          requestHeaders: safeHeaders,
          urlParams:      Object.keys(urlParams).length > 0 ? urlParams : undefined,
          bodyParams:     Object.keys(bodyParams).length > 0 ? bodyParams : undefined,
          responseJson:   responseJson ?? undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `Request failed with ${res.status}`);
      }

      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let   text    = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setSuggestion(text);
      }
      setPhase("done");
    } catch (e: any) {
      if (e.name === "AbortError") return;
      setSuggestion(e.message);
      setPhase("error");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-amber-50/60 dark:bg-amber-950/20 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
          <span className="font-semibold text-foreground">AI Suggestions</span>
          <span className="text-muted-foreground font-mono">
            {entry.response.status} {entry.response.statusText} · {urlName(entry.request.url)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {phase === "idle" && (
            <Button size="sm" variant="outline" onClick={analyze} className="h-6 text-xs gap-1.5">
              <Sparkles className="h-3 w-3" /> Analyse with AI
            </Button>
          )}
          {phase === "loading" && (
            <Button size="sm" variant="outline" disabled className="h-6 text-xs gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Analysing…
            </Button>
          )}
          {(phase === "done" || phase === "error") && (
            <Button size="sm" variant="ghost" onClick={analyze} className="h-6 text-xs gap-1.5 text-muted-foreground">
              <Sparkles className="h-3 w-3" /> Re-analyse
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={copyForLLM}
            title="Copy full context to paste into ChatGPT, Gemini, Claude…"
            className="h-6 text-xs gap-1.5"
          >
            {copied
              ? <><Check className="h-3 w-3 text-emerald-500" /> Copied</>
              : <><Clipboard className="h-3 w-3" /> Copy for LLM</>}
          </Button>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors ml-0.5">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Idle placeholder */}
      {phase === "idle" && (
        <div className="px-4 py-6 text-center text-muted-foreground space-y-1">
          <Sparkles className="h-5 w-5 mx-auto text-amber-400/60 mb-2" />
          <p className="font-medium text-xs">Click "Analyse with AI" to get suggestions for this error.</p>
          <p className="text-[11px]">
            The LLM will reference developer.okta.com to provide specific troubleshooting steps.
          </p>
        </div>
      )}

      {/* Initial spinner before first tokens arrive */}
      {phase === "loading" && !suggestion && (
        <div className="px-4 py-6 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Contacting LLM…</span>
        </div>
      )}

      {/* Markdown output (streams in) */}
      {(phase === "loading" || phase === "done") && suggestion && (
        <div className="px-4 py-3 max-h-[420px] overflow-auto relative">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {suggestion}
          </ReactMarkdown>
          {phase === "loading" && (
            <span className="inline-block w-1.5 h-3 bg-foreground/40 animate-pulse align-middle ml-0.5" />
          )}
        </div>
      )}

      {/* Error state */}
      {phase === "error" && (
        <div className="px-4 py-3 flex items-start gap-2 text-destructive">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <span className="font-mono text-[11px] break-all">{suggestion}</span>
        </div>
      )}
    </div>
  );
}
