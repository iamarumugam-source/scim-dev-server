"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { FileSearch, X, Search, Copy, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JsonViewer } from "@/components/json-viewer";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface HarHeader { name: string; value: string }
interface HarEntry {
  startedDateTime: string;
  time: number;
  request: {
    method: string;
    url: string;
    httpVersion: string;
    headers: HarHeader[];
    queryString: HarHeader[];
    cookies: HarHeader[];
    postData?: { mimeType: string; text: string };
    headersSize: number;
    bodySize: number;
  };
  response: {
    status: number;
    statusText: string;
    httpVersion: string;
    headers: HarHeader[];
    cookies: HarHeader[];
    content: { size: number; mimeType: string; text?: string };
    redirectURL: string;
    headersSize: number;
    bodySize: number;
  };
  timings: {
    blocked?: number;
    dns?: number;
    connect?: number;
    send: number;
    wait: number;
    receive: number;
    ssl?: number;
  };
}

interface HarFile {
  log: {
    version: string;
    creator: { name: string; version: string };
    entries: HarEntry[];
  };
}

type ResourceType = "All" | "Fetch/XHR" | "Doc" | "CSS" | "JS" | "Font" | "Img" | "Other" | "OIDC";
type OidcPhase   = "discovery" | "authorize" | "token" | "userinfo" | "keys" | "introspect" | "revoke" | "logout" | "session" | "idx";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function getResourceType(entry: HarEntry): ResourceType {
  const mime = entry.response.content?.mimeType ?? "";
  const url  = entry.request.url;
  if (mime.includes("json") || mime.includes("xml") || mime.includes("form"))      return "Fetch/XHR";
  if (mime.includes("html"))                                                         return "Doc";
  if (mime.includes("css") || url.endsWith(".css"))                                 return "CSS";
  if (mime.includes("javascript") || mime.includes("/js") || url.endsWith(".js"))   return "JS";
  if (mime.includes("font") || /\.(woff2?|ttf|eot|otf)/.test(url))                 return "Font";
  if (mime.includes("image"))                                                        return "Img";
  return "Other";
}

function getStatusClass(status: number) {
  if (status >= 500) return "text-red-600 dark:text-red-400 font-semibold";
  if (status >= 400) return "text-red-500 dark:text-red-400";
  if (status >= 300) return "text-purple-600 dark:text-purple-400";
  return "";
}

function getRowClass(status: number) {
  if (status >= 400) return "bg-red-50/60 dark:bg-red-950/20";
  if (status >= 300) return "bg-purple-50/40 dark:bg-purple-950/10";
  return "";
}

function getMethodClass(method: string) {
  switch (method?.toUpperCase()) {
    case "GET":    return "text-blue-600 dark:text-blue-400";
    case "POST":   return "text-green-600 dark:text-green-400";
    case "PUT":
    case "PATCH":  return "text-amber-600 dark:text-amber-400";
    case "DELETE": return "text-red-600 dark:text-red-400";
    default:       return "text-muted-foreground";
  }
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024)         return `${bytes} B`;
  if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDuration(ms: number): string {
  if (ms < 1)    return "< 1 ms";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function urlName(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || u.hostname;
  } catch {
    return url;
  }
}

function tryParseJson(text?: string): unknown {
  if (!text) return undefined;
  try { return JSON.parse(text); } catch { return text; }
}

const OIDC_PATTERNS: Array<{
  pattern: RegExp;
  methods?: string[];
  label: string;
  phase: OidcPhase;
}> = [
  { pattern: /\/.well-known\/openid-configuration/,       label: "Discovery",        phase: "discovery"  },
  { pattern: /\/.well-known\/oauth-authorization-server/, label: "AS Metadata",       phase: "discovery"  },
  { pattern: /\/v1\/authorize$/,                           label: "Authorize",        phase: "authorize"  },
  { pattern: /\/v1\/par$/,             methods: ["POST"],  label: "PAR",              phase: "authorize"  },
  { pattern: /\/login\/login\.htm/,                        label: "Login Page",       phase: "authorize"  },
  { pattern: /\/login\/sessionCookieRedirect/,             label: "Session Redirect", phase: "authorize"  },
  { pattern: /\/sso\/idps\//,                              label: "SSO IdP",          phase: "authorize"  },
  { pattern: /\/v1\/token$/,           methods: ["POST"],  label: "Token",            phase: "token"      },
  { pattern: /\/v1\/userinfo$/,                            label: "UserInfo",         phase: "userinfo"   },
  { pattern: /\/v1\/keys$/,            methods: ["GET"],   label: "JWKS",             phase: "keys"       },
  { pattern: /\/v1\/introspect$/,      methods: ["POST"],  label: "Introspect",       phase: "introspect" },
  { pattern: /\/v1\/revoke$/,          methods: ["POST"],  label: "Revoke",           phase: "revoke"     },
  { pattern: /\/v1\/logout$/,                              label: "Logout",           phase: "logout"     },
  { pattern: /\/v1\/end_session$/,                         label: "End Session",      phase: "logout"     },
  { pattern: /\/v1\/device\/authorize$/,                   label: "Device Auth",      phase: "authorize"  },
  { pattern: /\/api\/v1\/authn$/,      methods: ["POST"],  label: "Authn",            phase: "session"    },
  { pattern: /\/api\/v1\/sessions/,                        label: "Session",          phase: "session"    },
  { pattern: /\/idp\/idx\/introspect$/, methods: ["POST"], label: "IDX Introspect",   phase: "idx"        },
  { pattern: /\/idp\/idx\/identify$/,   methods: ["POST"], label: "IDX Identify",     phase: "idx"        },
  { pattern: /\/idp\/idx\/challenge/,                      label: "IDX Challenge",    phase: "idx"        },
  { pattern: /\/idp\/idx\//,                               label: "IDX",              phase: "idx"        },
];

interface OidcInfo { label: string; phase: OidcPhase }

function getOidcInfo(url: string, method: string): OidcInfo | null {
  try {
    const path = new URL(url).pathname;
    for (const def of OIDC_PATTERNS) {
      if (def.pattern.test(path) && (!def.methods || def.methods.includes(method.toUpperCase()))) {
        return { label: def.label, phase: def.phase };
      }
    }
  } catch {}
  return null;
}

function hasOktaHeader(entry: HarEntry): boolean {
  return entry.request.headers.some(
    (h) => h.name.toLowerCase().includes("okta") || h.value.toLowerCase().includes("okta"),
  );
}

const OIDC_STYLES: Record<OidcPhase, { badge: string; row: string }> = {
  discovery:  { badge: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",    row: "bg-slate-50/60 dark:bg-slate-900/20"   },
  authorize:  { badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/70 dark:text-blue-300",     row: "bg-blue-50/50 dark:bg-blue-950/20"     },
  token:      { badge: "bg-green-100 text-green-700 dark:bg-green-900/70 dark:text-green-300", row: "bg-green-50/50 dark:bg-green-950/20"   },
  userinfo:   { badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/70 dark:text-violet-300", row: "bg-violet-50/50 dark:bg-violet-950/20" },
  keys:       { badge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/70 dark:text-cyan-300",     row: "bg-cyan-50/50 dark:bg-cyan-950/20"     },
  introspect: { badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/70 dark:text-amber-300", row: "bg-amber-50/50 dark:bg-amber-950/20"   },
  revoke:     { badge: "bg-red-100 text-red-600 dark:bg-red-900/70 dark:text-red-300",         row: "bg-red-50/30 dark:bg-red-950/10"       },
  logout:     { badge: "bg-red-100 text-red-600 dark:bg-red-900/70 dark:text-red-300",         row: "bg-red-50/30 dark:bg-red-950/10"       },
  session:    { badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/70 dark:text-orange-300", row: "bg-orange-50/50 dark:bg-orange-950/20" },
  idx:        { badge: "bg-pink-100 text-pink-700 dark:bg-pink-900/70 dark:text-pink-300",     row: "bg-pink-50/50 dark:bg-pink-950/20"     },
};

const OKTA_STYLE = {
  badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/70 dark:text-indigo-300",
  row:   "bg-indigo-50/40 dark:bg-indigo-950/15",
};

// ─── Drop zone ──────────────────────────────────────────────────────────────────

function DropZone({ onFile }: { onFile: (har: HarFile, name: string) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const inputRef                    = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as HarFile;
        if (!parsed?.log?.entries) { setError("Invalid HAR — no entries found."); return; }
        onFile(parsed, file.name);
      } catch { setError("Failed to parse file. Make sure it is a valid HAR."); }
    };
    reader.readAsText(file);
  }, [onFile]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-16 cursor-pointer transition-colors",
        isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30",
      )}
    >
      <input ref={inputRef} type="file" accept=".har" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <FileSearch className="h-7 w-7 text-muted-foreground" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">Drop a HAR file here or click to browse</p>
        <p className="text-xs text-muted-foreground mt-1">Chrome DevTools → Network tab → ⋮ → Save all as HAR with content</p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

// ─── Headers panel ──────────────────────────────────────────────────────────────

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
            <div key={i} className="flex gap-2 py-0.5 text-xs font-mono leading-5">
              <span className="text-foreground/70 flex-shrink-0 min-w-[160px] max-w-[220px] truncate" title={h.name}>
                {h.name}:
              </span>
              <span className="text-foreground break-all min-w-0">{h.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HeadersPanel({ entry }: { entry: HarEntry }) {
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
            <div key={k} className="flex gap-2 py-0.5 leading-5">
              <span className="text-foreground/70 flex-shrink-0 min-w-[160px]">{k}:</span>
              <span className="text-foreground break-all min-w-0">{v}</span>
            </div>
          ))}
        </div>
      </div>
      <HeaderSection title="Response Headers" headers={entry.response.headers} />
      <HeaderSection title="Request Headers"  headers={entry.request.headers} />
      {entry.request.queryString.length > 0 && (
        <HeaderSection title="Query String Parameters" headers={entry.request.queryString} />
      )}
      {entry.request.cookies.length > 0 && (
        <HeaderSection title="Request Cookies" headers={entry.request.cookies} />
      )}
    </div>
  );
}

// ─── Timing panel ───────────────────────────────────────────────────────────────

const TIMING_BARS: { key: keyof HarEntry["timings"]; label: string; color: string }[] = [
  { key: "blocked", label: "Stalled",          color: "bg-gray-400" },
  { key: "dns",     label: "DNS Lookup",        color: "bg-teal-400" },
  { key: "connect", label: "Initial connection", color: "bg-orange-400" },
  { key: "ssl",     label: "SSL",               color: "bg-purple-400" },
  { key: "send",    label: "Request sent",       color: "bg-green-400" },
  { key: "wait",    label: "Waiting (TTFB)",     color: "bg-green-600" },
  { key: "receive", label: "Content download",   color: "bg-blue-500" },
];

function TimingPanel({ timings, total }: { timings: HarEntry["timings"]; total: number }) {
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

// ─── Splunk panel ───────────────────────────────────────────────────────────────

function SplunkPanel({ entry, orgId, cell, orgPending }: { entry: HarEntry; orgId: string | null; cell: string | null; orgPending: boolean }) {
  const requestId = entry.response.headers.find(h => h.name.toLowerCase() === "x-okta-request-id")?.value ?? "";
  const query     = cell ? `index="${cell}*" "${requestId}"` : null;

  const [copiedId,    setCopiedId]    = useState(false);
  const [copiedQuery, setCopiedQuery] = useState(false);

  const copy = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
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
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Fetching…</span>
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
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Fetching…</span>
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

// ─── Waterfall cell ─────────────────────────────────────────────────────────────

function WaterfallBar({ entry, startOffset, totalSpan }: { entry: HarEntry; startOffset: number; totalSpan: number }) {
  if (totalSpan <= 0) return null;
  const left  = (startOffset / totalSpan) * 100;
  const width = Math.max((entry.time / totalSpan) * 100, 0.3);

  const wait    = (Math.max(0, entry.timings.wait) / entry.time) * width;
  const receive = (Math.max(0, entry.timings.receive) / entry.time) * width;
  const other   = width - wait - receive;

  return (
    <div className="relative h-3 w-full">
      <div className="absolute h-full" style={{ left: `${left}%`, width: `${width}%` }}>
        <div className="flex h-full w-full overflow-hidden rounded-sm">
          <div className="bg-green-200 dark:bg-green-900"  style={{ width: `${(other / width) * 100}%` }} />
          <div className="bg-green-500 dark:bg-green-500"  style={{ width: `${(wait / width) * 100}%` }} />
          <div className="bg-blue-500  dark:bg-blue-400"   style={{ width: `${(receive / width) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

const TYPE_FILTERS: ResourceType[] = ["All", "Fetch/XHR", "Doc", "CSS", "JS", "Font", "Img", "Other", "OIDC"];

export default function HarAnalyser() {
  const [har,           setHar]           = useState<HarFile | null>(null);
  const [fileName,      setFileName]      = useState("");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [search,        setSearch]        = useState("");
  const [typeFilter,    setTypeFilter]    = useState<ResourceType>("All");
  const [orgInfoCache,  setOrgInfoCache]  = useState<Record<string, { id: string | null; cell: string | null } | null>>({});
  const orgPendingRef = useRef<Set<string>>(new Set());

  const fetchOrgInfo = useCallback(async (hostname: string) => {
    if (hostname in orgInfoCache || orgPendingRef.current.has(hostname)) return;
    orgPendingRef.current.add(hostname);
    try {
      const res  = await fetch(`https://${hostname}/.well-known/okta-organization`);
      const data = res.ok ? await res.json() : null;
      setOrgInfoCache(prev => ({ ...prev, [hostname]: data ? { id: data.id ?? null, cell: data.cell ?? null } : null }));
    } catch {
      setOrgInfoCache(prev => ({ ...prev, [hostname]: null }));
    } finally {
      orgPendingRef.current.delete(hostname);
    }
  }, [orgInfoCache]);

  const handleFile = useCallback((parsed: HarFile, name: string) => {
    setHar(parsed);
    setFileName(name);
    setSelectedIndex(null);
    setSearch("");
    setTypeFilter("All");
    setOrgInfoCache({});
    orgPendingRef.current.clear();
  }, []);

  const handleClear = () => {
    setHar(null);
    setFileName("");
    setSelectedIndex(null);
    setOrgInfoCache({});
    orgPendingRef.current.clear();
  };

  const entries = har?.log.entries ?? [];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter((e) => {
      const matchesSearch = !q || e.request.url.toLowerCase().includes(q);
      const matchesType   = typeFilter === "All"
        ? true
        : typeFilter === "OIDC"
          ? getOidcInfo(e.request.url, e.request.method) !== null
          : getResourceType(e) === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [entries, search, typeFilter]);

  const { startMs, spanMs } = useMemo(() => {
    if (!entries.length) return { startMs: 0, spanMs: 0 };
    const starts = entries.map(e => new Date(e.startedDateTime).getTime());
    const ends   = entries.map((e, i) => starts[i] + e.time);
    const s = Math.min(...starts);
    return { startMs: s, spanMs: Math.max(...ends) - s };
  }, [entries]);

  const selected = selectedIndex !== null ? filtered[selectedIndex] : null;

  useEffect(() => {
    if (!selected) return;
    const hasRequestId = selected.response.headers.some(h => h.name.toLowerCase() === "x-okta-request-id");
    if (!hasRequestId) return;
    try {
      const hostname = new URL(selected.request.url).hostname;
      fetchOrgInfo(hostname);
    } catch {}
  }, [selected, fetchOrgInfo]);

  if (!har) return <DropZone onFile={handleFile} />;

  return (
    <div className="flex flex-col rounded-lg border border-border overflow-hidden bg-card h-[80vh]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/40 flex-wrap flex-shrink-0">
        <button onClick={handleClear} className="text-muted-foreground hover:text-foreground transition-colors" title="Clear">
          <X className="h-4 w-4" />
        </button>
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelectedIndex(null); }}
            placeholder="Filter"
            className="h-6 pl-6 text-xs font-mono bg-background"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => { setTypeFilter(t); setSelectedIndex(null); }}
              className={cn(
                "px-2 py-0.5 text-xs rounded transition-colors",
                typeFilter === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums flex-shrink-0">
          {filtered.length} / {entries.length} requests
        </span>
      </div>

      {/* Table — scrolls independently */}
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full text-xs font-mono border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted text-muted-foreground">
              <th className="text-left font-medium px-2 py-1.5 w-[30%]">Name</th>
              <th className="text-left font-medium px-2 py-1.5 w-16">Status</th>
              <th className="text-left font-medium px-2 py-1.5 w-16 hidden sm:table-cell">Method</th>
              <th className="text-left font-medium px-2 py-1.5 w-20 hidden md:table-cell">Type</th>
              <th className="text-right font-medium px-2 py-1.5 w-16 hidden lg:table-cell">Size</th>
              <th className="text-right font-medium px-2 py-1.5 w-16">Time</th>
              <th className="text-left font-medium px-2 py-1.5 hidden xl:table-cell">Waterfall</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-muted-foreground text-xs">
                  No requests match the current filter.
                </td>
              </tr>
            ) : (
              filtered.map((entry, idx) => {
                const isSelected  = selectedIndex === idx;
                const startOffset = new Date(entry.startedDateTime).getTime() - startMs;
                const oidcInfo    = getOidcInfo(entry.request.url, entry.request.method);
                const oidcStyle   = oidcInfo ? OIDC_STYLES[oidcInfo.phase] : null;
                const isOkta      = !oidcInfo && hasOktaHeader(entry);
                return (
                  <tr
                    key={idx}
                    onClick={() => setSelectedIndex(isSelected ? null : idx)}
                    className={cn(
                      "cursor-pointer border-b border-border/40 transition-colors",
                      isSelected
                        ? "bg-primary/10 dark:bg-primary/20"
                        : oidcStyle
                          ? oidcStyle.row
                          : isOkta
                            ? OKTA_STYLE.row
                            : getRowClass(entry.response.status),
                      !isSelected && "hover:bg-muted/50",
                    )}
                  >
                    <td className="px-2 py-1 max-w-0 overflow-hidden">
                      <div className="flex items-center gap-1.5 truncate" title={entry.request.url}>
                        {oidcInfo && (
                          <span className={cn("flex-shrink-0 text-[10px] font-sans font-medium px-1 py-px rounded leading-tight", oidcStyle?.badge)}>
                            {oidcInfo.label}
                          </span>
                        )}
                        {isOkta && (
                          <span className={cn("flex-shrink-0 text-[10px] font-sans font-medium px-1 py-px rounded leading-tight", OKTA_STYLE.badge)}>
                            Okta
                          </span>
                        )}
                        <span className="truncate">{urlName(entry.request.url)}</span>
                      </div>
                      <div className="truncate text-muted-foreground/60 text-[10px]">
                        {(() => { try { return new URL(entry.request.url).hostname; } catch { return ""; } })()}
                      </div>
                    </td>
                    <td className={cn("px-2 py-1", getStatusClass(entry.response.status))}>
                      {entry.response.status}
                    </td>
                    <td className={cn("px-2 py-1 hidden sm:table-cell", getMethodClass(entry.request.method))}>
                      {entry.request.method}
                    </td>
                    <td className="px-2 py-1 text-muted-foreground hidden md:table-cell">
                      {getResourceType(entry)}
                    </td>
                    <td className="px-2 py-1 text-right text-muted-foreground hidden lg:table-cell tabular-nums">
                      {formatBytes(entry.response.content?.size ?? entry.response.bodySize)}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">
                      {formatDuration(entry.time)}
                    </td>
                    <td className="px-2 py-1 hidden xl:table-cell min-w-[100px]">
                      <WaterfallBar entry={entry} startOffset={startOffset} totalSpan={spanMs} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom drawer — scrolls independently, table above remains scrollable */}
      {selected && (
        <div className="flex-shrink-0 h-[320px] border-t border-border flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/40 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {(() => {
                const oi = getOidcInfo(selected.request.url, selected.request.method);
                const os = oi ? OIDC_STYLES[oi.phase] : null;
                const io = !oi && hasOktaHeader(selected);
                return (
                  <>
                    {oi && <span className={cn("flex-shrink-0 text-[10px] font-sans font-medium px-1.5 py-px rounded", os?.badge)}>{oi.label}</span>}
                    {io && <span className={cn("flex-shrink-0 text-[10px] font-sans font-medium px-1.5 py-px rounded", OKTA_STYLE.badge)}>Okta</span>}
                  </>
                );
              })()}
              <span className="text-xs font-mono truncate text-foreground/80" title={selected.request.url}>
                {urlName(selected.request.url)}
              </span>
              <span className="text-[10px] text-muted-foreground flex-shrink-0 font-mono">
                {selected.response.status} · {formatDuration(selected.time)}
              </span>
            </div>
            <button onClick={() => setSelectedIndex(null)} className="text-muted-foreground hover:text-foreground ml-2 flex-shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {(() => {
            const oktaRequestId = selected.response.headers.find(h => h.name.toLowerCase() === "x-okta-request-id")?.value;
            const hostname      = (() => { try { return new URL(selected.request.url).hostname; } catch { return ""; } })();
            const cached        = orgInfoCache[hostname];
            const orgId         = cached?.id ?? null;
            const cell          = cached?.cell ?? null;
            const orgPending    = orgPendingRef.current.has(hostname);
            return (
              <div className="flex-1 overflow-auto min-h-0 p-3">
                <Tabs defaultValue="headers">
                  <TabsList className="h-7 text-xs">
                    <TabsTrigger value="headers"  className="text-xs h-6 px-2">Headers</TabsTrigger>
                    <TabsTrigger value="preview"  className="text-xs h-6 px-2">Preview</TabsTrigger>
                    <TabsTrigger value="response" className="text-xs h-6 px-2">Response</TabsTrigger>
                    <TabsTrigger value="timing"   className="text-xs h-6 px-2">Timing</TabsTrigger>
                    {oktaRequestId && (
                      <TabsTrigger value="splunk" className="text-xs h-6 px-2 text-violet-600 dark:text-violet-400 data-[state=active]:text-violet-700 dark:data-[state=active]:text-violet-300">
                        Splunk
                      </TabsTrigger>
                    )}
                  </TabsList>
                  <TabsContent value="headers" className="mt-2">
                    <HeadersPanel entry={selected} />
                  </TabsContent>
                  <TabsContent value="preview" className="mt-2">
                    <JsonViewer
                      data={tryParseJson(selected.response.content?.text) ?? selected.response.content}
                      className="max-h-[220px]"
                    />
                  </TabsContent>
                  <TabsContent value="response" className="mt-2">
                    <pre className="rounded-md border border-border bg-card p-3 text-xs font-mono overflow-auto max-h-[220px] whitespace-pre-wrap break-all">
                      {selected.response.content?.text ?? "(empty)"}
                    </pre>
                  </TabsContent>
                  <TabsContent value="timing" className="mt-2">
                    <TimingPanel timings={selected.timings} total={selected.time} />
                  </TabsContent>
                  {oktaRequestId && (
                    <TabsContent value="splunk" className="mt-2">
                      <SplunkPanel entry={selected} orgId={orgId} cell={cell} orgPending={orgPending || !(hostname in orgInfoCache)} />
                    </TabsContent>
                  )}
                </Tabs>
              </div>
            );
          })()}
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center gap-4 px-3 py-1.5 border-t border-border bg-muted/30 text-[11px] text-muted-foreground font-mono flex-wrap flex-shrink-0">
        <span>{filtered.length} requests</span>
        <span>
          {formatBytes(filtered.reduce((s, e) => s + Math.max(0, e.response.content?.size ?? e.response.bodySize ?? 0), 0))} transferred
        </span>
        <span>
          {formatDuration(filtered.reduce((s, e) => s + e.time, 0))} total load time
        </span>
      </div>
    </div>
  );
}
