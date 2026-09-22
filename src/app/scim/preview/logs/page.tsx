"use client";

// ─── UNLINKED PREVIEW ─────────────────────────────────────────────────────────
//
// Redesign of /scim/logs. Reachable only by typing the URL — not in the sidebar
// or the breadcrumb map. Under /scim/*, so the auth middleware covers it. Fully
// self-contained: it does not import LogViewer, so it cannot regress the live
// page.
//
// No usePageTracking() — a preview should not pollute page-view analytics.
//
// ── Problems in the current viewer this addresses ─────────────────────────────
//
// Correctness:
//   • Expansion was keyed by ARRAY INDEX (`expandedIndex === index`) and rows
//     used `key={index}`. With 5s auto-refresh prepending new rows, the wrong
//     entry stays open and React reuses rows across different logs. Keyed by log
//     id here.
//   • Auto-refresh called setExpandedIndex(null) on every tick, so live mode
//     slammed shut whatever you were reading. Expansion survives refresh now.
//   • The Live button rendered `{autoRefresh ? "Live" : "Live"}` — the label
//     never changed, so you could not tell the mode from the text.
//   • Clear wiped every log with no confirmation.
//
// Usability:
//   • No filtering of any kind. For a debugging tool that is the main gap: when
//     provisioning fails you want the 4xx/5xx immediately. Status facets, a
//     method filter and a search box now do that.
//   • Timestamps showed hour:minute only. A burst of provisioning calls lands in
//     the same minute and became indistinguishable. Seconds + relative age now.
//   • Only one row could be open at a time, so two requests could not be
//     compared. Multiple rows expand.
//   • The auth scheme is recorded in the headers (credential redacted, scheme
//     kept) but was never surfaced — it is exactly what you check when Okta gets
//     a 401. It is now a column.
//
// Filtering is CLIENT-side over loaded rows: the logs endpoint accepts only
// limit/offset, no filter params. The UI says so rather than implying otherwise.

import { useEffect, useState, useMemo, useCallback, useRef, Fragment } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronRight, RefreshCw, Loader2, Trash2, Radio, Search, X, ArrowDownLeft,
  ArrowUpRight, ScrollText, Copy, Check, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JsonViewer } from "@/components/json-viewer";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput,
} from "@/components/ui/input-group";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { VizTokens } from "@/components/scim/dashboard/viz";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 30;

interface LogEntry {
  id:         string;
  log_data:   any;
  response:   any;
  created_at: string;
}

type StatusClass = "2xx" | "3xx" | "4xx" | "5xx";
const STATUS_CLASSES: StatusClass[] = ["2xx", "3xx", "4xx", "5xx"];

// Status classes use the reserved status roles from VizTokens, so an error here
// is the same red as an error on the dashboard.
const CLASS_STYLE: Record<StatusClass, string> = {
  "2xx": "border-[color:var(--status-good)] text-[color:var(--status-good)]",
  "3xx": "border-[color:var(--status-warning)] text-[color:var(--status-warning)]",
  "4xx": "border-[color:var(--status-serious)] text-[color:var(--status-serious)]",
  "5xx": "border-[color:var(--status-critical)] text-[color:var(--status-critical)]",
};

// Selected facets get a solid dot in the status colour plus a filled surface;
// unselected are plain neutral. The previous version only varied opacity, so
// "nothing selected" (= unfiltered) looked like "all disabled", which reads as
// broken rather than as showing everything.
const CLASS_DOT: Record<StatusClass, string> = {
  "2xx": "bg-[color:var(--status-good)]",
  "3xx": "bg-[color:var(--status-warning)]",
  "4xx": "bg-[color:var(--status-serious)]",
  "5xx": "bg-[color:var(--status-critical)]",
};

function statusClass(status?: number): StatusClass | null {
  if (!status) return null;
  if (status >= 500) return "5xx";
  if (status >= 400) return "4xx";
  if (status >= 300) return "3xx";
  if (status >= 200) return "2xx";
  return null;
}

const METHOD_STYLE: Record<string, string> = {
  GET:    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/40",
  POST:   "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/40",
  PUT:    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/40",
  PATCH:  "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/40",
  DELETE: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700/40",
};

/** Seconds matter: provisioning bursts all land inside one minute. */
function absTime(ts: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(new Date(ts));
}

function relTime(ts: string): string {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
  if (secs < 60)    return `${secs}s ago`;
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

/**
 * The auth scheme used, from the redacted authorization header. This is the
 * first thing you check on a 401 and it was never shown.
 */
function authScheme(log: LogEntry): string {
  const h = log.log_data?.headers ?? {};
  const raw = h.authorization ?? h.Authorization;
  if (!raw) return "none";
  const scheme = String(raw).split(" ")[0];
  return scheme || "none";
}

/** Path without host or the tenant prefix — both identical on every row. */
function shortPath(url?: string): string {
  if (!url) return "—";
  return url
    .replace(/^https?:\/\/[^/]+/, "")
    .replace(/^\/api\/[^/]+/, "…");
}

function CopyBtn({ value, label }: { value: unknown; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        typeof value === "string" ? value : JSON.stringify(value, null, 2),
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { toast.error("Could not copy."); }
  };
  return (
    <Button variant="ghost" size="sm" onClick={copy} className="h-6 gap-1.5 text-[11px]">
      {copied ? <Check className="h-3 w-3 text-[color:var(--status-good)]" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

export default function LogsPreviewPage() {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [logs,       setLogs]       = useState<LogEntry[]>([]);
  const [total,      setTotal]      = useState(0);
  const [hasMore,    setHasMore]    = useState(false);
  const [isLoading,  setIsLoading]  = useState(true);
  const [isPaging,   setIsPaging]   = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh,  setAutoRefresh]  = useState(false);
  const [clearOpen,  setClearOpen]  = useState(false);
  const [clearing,   setClearing]   = useState(false);
  const [loadError,  setLoadError]  = useState<string | null>(null);

  const [query,      setQuery]      = useState("");
  const [classes,    setClasses]    = useState<Set<StatusClass>>(new Set());
  const [methods,    setMethods]    = useState<Set<string>>(new Set());
  // Keyed by log id, not array index — the index-keyed version reopened the
  // wrong row whenever the list shifted.
  const [expanded,   setExpanded]   = useState<Set<string>>(new Set());

  const searchRef = useRef<HTMLInputElement>(null);
  const inFlight   = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const fetchPage = useCallback(async (offset: number, mode: "replace" | "append") => {
    if (!userId || inFlight.current) return;
    inFlight.current = true;
    if (mode === "append") setIsPaging(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/${userId}/scim/v2/logs?limit=${PAGE_SIZE}&offset=${offset}`);
      if (!res.ok) throw new Error(res.statusText || `HTTP ${res.status}`);
      const data = await res.json();
      const batch = (data.logs ?? []) as LogEntry[];
      setTotal(data.total ?? 0);
      setHasMore(Boolean(data.hasMore));
      setLogs((prev) => {
        if (mode === "replace") return batch;
        const seen = new Set(prev.map((l) => l.id));
        return [...prev, ...batch.filter((l) => !seen.has(l.id))];
      });
      // Deliberately NOT clearing `expanded` here: the old viewer reset it on
      // every refresh, so live mode closed whatever you were reading.
    } catch (e) {
      const msg = (e as Error).message;
      setLoadError(msg);
      if (mode === "replace") toast.error(`Failed to load logs: ${msg}`);
    } finally {
      inFlight.current = false;
      setIsLoading(false);
      setIsPaging(false);
      setIsRefreshing(false);
    }
  }, [userId]);

  useEffect(() => { if (userId) fetchPage(0, "replace"); }, [userId, fetchPage]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => fetchPage(0, "replace"), 5_000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchPage]);

  const refresh = () => { setIsRefreshing(true); fetchPage(0, "replace"); };

  const clearLogs = async () => {
    if (!userId) return;
    setClearing(true);
    try {
      const res = await fetch(`/api/${userId}/scim/v2/logs`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear logs.");
      setLogs([]); setTotal(0); setHasMore(false); setExpanded(new Set());
      toast.success("Logs cleared.");
      setClearOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setClearing(false);
    }
  };

  // Counts across LOADED rows — labelled as such, since the endpoint cannot
  // aggregate server-side.
  const classCounts = useMemo(() => {
    const c: Record<StatusClass, number> = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 };
    for (const l of logs) {
      const k = statusClass(l.response?.status?.status);
      if (k) c[k]++;
    }
    return c;
  }, [logs]);

  const availableMethods = useMemo(
    () => [...new Set(logs.map((l) => String(l.log_data?.method ?? "")).filter(Boolean))].sort(),
    [logs],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((l) => {
      const st = l.response?.status?.status;
      const k  = statusClass(st);
      if (classes.size && (!k || !classes.has(k))) return false;
      if (methods.size && !methods.has(String(l.log_data?.method))) return false;
      if (!q) return true;
      return (
        String(l.log_data?.url ?? "").toLowerCase().includes(q) ||
        String(l.log_data?.method ?? "").toLowerCase().includes(q) ||
        String(st ?? "").includes(q) ||
        String(l.log_data?.ip ?? "").toLowerCase().includes(q)
      );
    });
  }, [logs, query, classes, methods]);

  const isFiltered = query.trim().length > 0 || classes.size > 0 || methods.size > 0;

  const toggleClass = (c: StatusClass) =>
    setClasses((p) => { const n = new Set(p); if (n.has(c)) n.delete(c); else n.add(c); return n; });
  const toggleMethod = (m: string) =>
    setMethods((p) => { const n = new Set(p); if (n.has(m)) n.delete(m); else n.add(m); return n; });
  const toggleRow = (id: string) =>
    setExpanded((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const clearFilters = () => { setQuery(""); setClasses(new Set()); setMethods(new Set()); };

  return (
    <motion.div
      className="viz container mx-auto space-y-4 py-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <VizTokens />

      <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
        <ScrollText className="text-amber-600 dark:text-amber-400" />
        <AlertTitle className="text-amber-900 dark:text-amber-200">
          Design preview — not linked from navigation
        </AlertTitle>
        <AlertDescription className="text-amber-800/80 dark:text-amber-300/70">
          Proposed redesign of <code className="font-mono">/scim/logs</code>: status facets,
          method filter, search, an auth-scheme column, second-precision timestamps, and
          multiple rows open at once. The shipped page is unchanged.
        </AlertDescription>
      </Alert>

      {/* ─── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="min-w-[220px] flex-1">
          <InputGroupAddon><Search className="h-3.5 w-3.5" /></InputGroupAddon>
          <InputGroupInput
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by path, method, status or IP…"
            aria-label="Filter loaded logs"
            className="text-xs"
          />
          <InputGroupAddon align="inline-end">
            {query ? (
              <InputGroupButton size="icon-xs" variant="ghost" onClick={() => setQuery("")} aria-label="Clear search">
                <X className="h-3.5 w-3.5" />
              </InputGroupButton>
            ) : <Kbd>⌘K</Kbd>}
          </InputGroupAddon>
        </InputGroup>

        <Button
          variant={autoRefresh ? "default" : "outline"} size="sm"
          onClick={() => setAutoRefresh((v) => !v)}
          className="h-9 gap-1.5"
          // The old label read "Live" in both states, so the mode was invisible.
          title={autoRefresh ? "Stop live polling" : "Poll every 5 seconds"}
        >
          <Radio className={cn("h-3.5 w-3.5", autoRefresh && "animate-pulse")} />
          {autoRefresh ? "Live · 5s" : "Go live"}
        </Button>

        <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={refresh} disabled={isRefreshing || isLoading}>
          <RefreshCw className={cn("h-3.5 w-3.5", (isRefreshing || isLoading) && "animate-spin")} />
          Refresh
        </Button>

        <Button
          variant="outline" size="sm"
          className="h-9 gap-1.5 text-destructive hover:text-destructive"
          onClick={() => setClearOpen(true)} disabled={total === 0}
        >
          <Trash2 className="h-3.5 w-3.5" /> Clear
        </Button>
      </div>

      {/* ─── Filter bar ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-muted/20 px-3 py-2">

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Filter className="h-3 w-3" /> Status
          </span>
          <div className="flex items-center gap-1">
            {STATUS_CLASSES.map((c) => {
              const on   = classes.has(c);
              const n    = classCounts[c];
              const none = n === 0;
              return (
                <button
                  key={c}
                  onClick={() => toggleClass(c)}
                  aria-pressed={on}
                  disabled={none && !on}
                  title={none ? `No ${c} responses loaded` : on ? `Stop filtering by ${c}` : `Show only ${c}`}
                  className={cn(
                    "flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium transition-colors",
                    on
                      ? cn("bg-background shadow-sm", CLASS_STYLE[c])
                      : "border-border bg-transparent text-muted-foreground hover:bg-background hover:text-foreground",
                    none && !on && "opacity-40",
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", on ? CLASS_DOT[c] : "bg-muted-foreground/40")} />
                  {c}
                  <span className="tabular-nums opacity-70">{n}</span>
                </button>
              );
            })}
          </div>
        </div>

        {availableMethods.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Method
            </span>
            <div className="flex flex-wrap items-center gap-1">
              {availableMethods.map((m) => {
                const on = methods.has(m);
                return (
                  <button
                    key={m}
                    onClick={() => toggleMethod(m)}
                    aria-pressed={on}
                    title={on ? `Stop filtering by ${m}` : `Show only ${m}`}
                    className={cn(
                      "h-7 rounded-md border px-2 font-mono text-[10px] font-bold transition-colors",
                      on
                        ? cn("shadow-sm", METHOD_STYLE[m] ?? "border-border text-foreground")
                        : "border-border bg-transparent text-muted-foreground hover:bg-background hover:text-foreground",
                    )}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
          {isFiltered && (
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-[11px]" onClick={clearFilters}>
              <X className="h-3 w-3" /> Clear
            </Button>
          )}
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {isLoading ? "Loading…" : (
              <>
                {isFiltered && (
                  <><span className="font-medium text-foreground">{rows.length}</span> shown · </>
                )}
                <span className="font-medium text-foreground">{logs.length}</span> loaded
                {total > logs.length && <> of {total}</>}
              </>
            )}
          </span>
        </div>
      </div>

      <p className="-mt-1 text-[11px] text-muted-foreground">
        The logs endpoint takes only <code className="font-mono">limit</code>/
        <code className="font-mono">offset</code> — no server-side filter — so facets, method
        and search apply to the rows loaded so far, and the counts above are of those rows.
      </p>

      {/* ─── Table ───────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted dark:bg-white/[0.04]">
            <TableRow>
              <TableHead className="w-8" />
              <TableHead className="w-20 text-xs font-semibold uppercase tracking-wide">Method</TableHead>
              <TableHead className="w-16 text-xs font-semibold uppercase tracking-wide">Status</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Path</TableHead>
              <TableHead className="hidden w-24 text-xs font-semibold uppercase tracking-wide md:table-cell">Auth</TableHead>
              <TableHead className="hidden w-32 text-xs font-semibold uppercase tracking-wide lg:table-cell">IP</TableHead>
              <TableHead className="w-44 text-right text-xs font-semibold uppercase tracking-wide">Time</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={`sk-${i}`} className="animate-pulse">
                  <TableCell />
                  <TableCell><div className="h-4 w-12 rounded bg-muted" /></TableCell>
                  <TableCell><div className="h-4 w-8 rounded bg-muted" /></TableCell>
                  <TableCell><div className="h-4 w-56 rounded bg-muted" /></TableCell>
                  <TableCell className="hidden md:table-cell"><div className="h-4 w-14 rounded bg-muted" /></TableCell>
                  <TableCell className="hidden lg:table-cell"><div className="h-4 w-20 rounded bg-muted" /></TableCell>
                  <TableCell><div className="ml-auto h-4 w-28 rounded bg-muted" /></TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="p-0">
                  {isFiltered ? (
                    <Empty className="border-0">
                      <EmptyHeader>
                        <EmptyMedia variant="icon"><Search className="h-4 w-4" /></EmptyMedia>
                        <EmptyTitle className="text-sm">No matching requests</EmptyTitle>
                        <EmptyDescription className="text-xs">
                          No loaded request matches the current filters.
                          {hasMore && " Older requests are not loaded yet."}
                        </EmptyDescription>
                      </EmptyHeader>
                      <EmptyContent>
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={clearFilters}>
                          <X className="h-3.5 w-3.5" /> Clear filters
                        </Button>
                      </EmptyContent>
                    </Empty>
                  ) : (
                    <Empty className="border-0">
                      <EmptyHeader>
                        <EmptyMedia variant="icon"><ScrollText className="h-4 w-4" /></EmptyMedia>
                        <EmptyTitle className="text-sm">No requests logged yet</EmptyTitle>
                        <EmptyDescription className="text-xs">
                          Every SCIM request to this tenant is recorded here. Assign a user in
                          Okta, or call an endpoint with your API key, and it will appear.
                        </EmptyDescription>
                      </EmptyHeader>
                      <EmptyContent>
                        <Button
                          variant={autoRefresh ? "default" : "outline"} size="sm" className="gap-1.5"
                          onClick={() => setAutoRefresh(true)}
                        >
                          <Radio className={cn("h-3.5 w-3.5", autoRefresh && "animate-pulse")} />
                          {autoRefresh ? "Watching…" : "Watch for requests"}
                        </Button>
                      </EmptyContent>
                    </Empty>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((log) => {
                const status = log.response?.status?.status as number | undefined;
                const k      = statusClass(status);
                const isOpen = expanded.has(log.id);
                const method = String(log.log_data?.method ?? "");
                const scheme = authScheme(log);
                return (
                  <Fragment key={log.id}>
                    <TableRow
                      onClick={() => toggleRow(log.id)}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-muted/40",
                        k === "5xx" && "bg-destructive/5",
                        isOpen && "bg-muted/30",
                      )}
                    >
                      <TableCell className="pl-3 text-muted-foreground">
                        <ChevronRight className={cn("h-4 w-4 transition-transform duration-150", isOpen && "rotate-90")} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          "px-1.5 py-px font-mono text-[10px] font-bold",
                          METHOD_STYLE[method] ?? "border-border text-muted-foreground",
                        )}>
                          {method || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          "px-1.5 py-px font-mono text-[10px] font-semibold tabular-nums",
                          k ? CLASS_STYLE[k] : "border-border text-muted-foreground",
                        )}>
                          {status ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[24rem] truncate font-mono text-xs" title={log.log_data?.url}>
                        {shortPath(log.log_data?.url)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className={cn(
                          "font-mono text-[10px]",
                          scheme === "none" ? "text-[color:var(--status-serious)]" : "text-muted-foreground",
                        )}>
                          {scheme}
                        </span>
                      </TableCell>
                      <TableCell className="hidden font-mono text-[11px] text-muted-foreground lg:table-cell">
                        {log.log_data?.ip ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <span className="font-mono text-[11px] tabular-nums text-foreground/80">
                          {absTime(log.created_at)}
                        </span>
                        <span className="ml-1.5 text-[10px] text-muted-foreground">
                          {relTime(log.created_at)}
                        </span>
                      </TableCell>
                    </TableRow>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableCell colSpan={7} className="overflow-hidden border-t border-border/60 p-0">
                            <motion.div
                              className="w-full overflow-hidden px-4 py-3"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <Tabs defaultValue={k === "4xx" || k === "5xx" ? "response" : "request"}>
                                <div className="flex items-center gap-2">
                                  <TabsList className="h-7">
                                    <TabsTrigger value="request" className="h-6 gap-1.5 px-2 text-xs">
                                      <ArrowDownLeft className="h-3 w-3" /> Request
                                    </TabsTrigger>
                                    <TabsTrigger value="response" className="h-6 gap-1.5 px-2 text-xs">
                                      <ArrowUpRight className="h-3 w-3" /> Response
                                    </TabsTrigger>
                                  </TabsList>
                                  <div className="ml-auto flex items-center gap-1">
                                    <CopyBtn value={log.log_data?.url} label="Copy URL" />
                                    <CopyBtn value={log} label="Copy entry" />
                                  </div>
                                </div>
                                {/* Failures open on Response, where the SCIM error
                                    detail is — that is what you came to read. */}
                                <TabsContent value="request" className="mt-2">
                                  <JsonViewer data={log.log_data} className="max-h-[320px]" />
                                </TabsContent>
                                <TabsContent value="response" className="mt-2">
                                  <JsonViewer data={log.response} className="max-h-[320px]" />
                                </TabsContent>
                              </Tabs>
                            </motion.div>
                          </TableCell>
                        </TableRow>
                      )}
                    </AnimatePresence>
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ─── Load more ───────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-2">
        {loadError && logs.length > 0 && (
          <p className="text-xs text-destructive">Could not load: {loadError}</p>
        )}
        {hasMore && !isLoading && (
          <Button
            variant="outline" size="sm" className="h-8 min-w-[160px] gap-1.5 text-xs"
            onClick={() => fetchPage(logs.length, "append")} disabled={isPaging}
          >
            {isPaging
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</>
              : `Load more (${total - logs.length} remaining)`}
          </Button>
        )}
        {!isLoading && !hasMore && total > PAGE_SIZE && (
          <p className="text-xs text-muted-foreground">End of list — {total} requests.</p>
        )}
      </div>

      {/* ─── Clear confirmation ──────────────────────────────────────────── */}
      {/* Previously a single click wiped every log with no confirmation. */}
      <Dialog open={clearOpen} onOpenChange={(o) => !clearing && setClearOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Clear all {total.toLocaleString()} log entries?</DialogTitle>
            <DialogDescription>
              This deletes the entire request history for this tenant. Dashboard traffic
              breakdowns read from these entries, so they will reset too. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearOpen(false)} disabled={clearing}>
              Cancel
            </Button>
            <Button variant="destructive" className="gap-1.5" onClick={clearLogs} disabled={clearing}>
              {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Clear logs
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
