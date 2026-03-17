"use client";

import { useState, useCallback, useRef, useMemo, useEffect, Fragment } from "react";
import { X, Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JsonViewer } from "@/components/json-viewer";
import { cn } from "@/lib/utils";
import {
  TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";

import type { HarFile, HarEntry, ResourceType } from "./har/types";
import { OIDC_STYLES, OKTA_STYLE, TYPE_FILTERS } from "./har/constants";
import {
  getResourceType, getStatusClass, getRowClass, getMethodClass,
  formatBytes, formatDuration, urlName, tryParseJson,
  getOidcInfo, hasOktaHeader,
} from "./har/utils";
import { DropZone }          from "./har/drop-zone";
import { useHarHistory }     from "@/hooks/useHarHistory";
import { HeadersPanel }      from "./har/headers-panel";
import { TimingPanel }       from "./har/timing-panel";
import { SplunkPanel }       from "./har/splunk-panel";
import { OidcUrlPanel }      from "./har/oidc-url-panel";
import { WaterfallBar }      from "./har/waterfall-bar";
import { AiSuggestionCard }  from "./har/ai-suggestion-card";

export default function HarAnalyser() {
  const [har,           setHar]           = useState<HarFile | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [aiCardIndex,   setAiCardIndex]   = useState<number | null>(null);
  const [search,        setSearch]        = useState("");
  const [typeFilter,    setTypeFilter]    = useState<ResourceType>("All");
  const [orgInfoCache,  setOrgInfoCache]  = useState<Record<string, { id: string | null; cell: string | null } | null>>({});
  const orgPendingRef    = useRef<Set<string>>(new Set());
  const [splitPercent,   setSplitPercent]  = useState(80);
  const isDragging       = useRef(false);
  const dragStartY       = useRef(0);
  const dragStartPercent = useRef(80);
  const contentAreaRef   = useRef<HTMLDivElement>(null);

  const onDragHandleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current       = true;
    dragStartY.current       = e.clientY;
    dragStartPercent.current = splitPercent;
    e.preventDefault();
    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current || !contentAreaRef.current) return;
      const containerH  = contentAreaRef.current.clientHeight;
      const delta       = ev.clientY - dragStartY.current;
      const deltaPct    = (delta / containerH) * 100;
      const next        = Math.max(25, Math.min(85, dragStartPercent.current + deltaPct));
      setSplitPercent(next);
    };
    const onMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup",   onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup",   onMouseUp);
  }, [splitPercent]);

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

  const { history, addEntry, clearHistory } = useHarHistory();

  const handleFile = useCallback((parsed: HarFile, name: string) => {
    setHar(parsed);
    setSelectedIndex(null);
    setAiCardIndex(null);
    setSearch("");
    setTypeFilter("All");
    setOrgInfoCache({});
    orgPendingRef.current.clear();
    addEntry(name, parsed.log.entries.length);
  }, [addEntry]);

  const handleClear = () => {
    setHar(null);
    setSelectedIndex(null);
    setAiCardIndex(null);
    setOrgInfoCache({});
    orgPendingRef.current.clear();
  };

  const entries  = har?.log.entries ?? [];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter((e) => {
      const matchesSearch = !q || e.request.url.toLowerCase().includes(q);
      const matchesType   = typeFilter === "All"  ? true
        : typeFilter === "OIDC"                   ? getOidcInfo(e.request.url, e.request.method) !== null
        : getResourceType(e) === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [entries, search, typeFilter]);

  const { startMs, spanMs } = useMemo(() => {
    if (!entries.length) return { startMs: 0, spanMs: 0 };
    const starts = entries.map(e => new Date(e.startedDateTime).getTime());
    const ends   = entries.map((e, i) => starts[i] + e.time);
    const s      = Math.min(...starts);
    return { startMs: s, spanMs: Math.max(...ends) - s };
  }, [entries]);

  const selected = selectedIndex !== null ? filtered[selectedIndex] : null;

  useEffect(() => {
    if (!selected) return;
    const hasRequestId = selected.response.headers.some(h => h.name.toLowerCase() === "x-okta-request-id");
    if (!hasRequestId) return;
    try { fetchOrgInfo(new URL(selected.request.url).hostname); } catch {}
  }, [selected, fetchOrgInfo]);

  if (!har) return <DropZone onFile={handleFile} history={history} onClearHistory={clearHistory} />;

  return (
    <div
      className="flex flex-col w-full rounded-lg border border-border overflow-hidden bg-card"
      style={{ height: 'calc(100dvh - var(--header-height) - 2rem)' }}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/40 flex-wrap flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={handleClear} title="Clear" className="h-7 w-7 text-muted-foreground">
          <X className="h-4 w-4" />
        </Button>
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelectedIndex(null); }}
            placeholder="Filter"
            className="h-6 pl-6 text-xs bg-background"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {TYPE_FILTERS.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={typeFilter === t ? "default" : "ghost"}
              onClick={() => { setTypeFilter(t); setSelectedIndex(null); }}
              className="h-6 px-2 text-xs"
            >
              {t}
            </Button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums flex-shrink-0">
          {filtered.length} / {entries.length} requests
        </span>
      </div>

      {/* Content area */}
      <div ref={contentAreaRef} className="flex flex-col flex-1 min-h-0">

      {/* Table */}
      <div style={{ flex: selected ? `0 0 ${splitPercent}%` : '1 1 0%', minHeight: 0, overflow: 'auto' }}>
        <table className="w-full text-xs table-fixed">
          <TableHeader className="sticky top-0 z-10 bg-muted">
            <TableRow className="hover:bg-muted">
              <TableHead className="w-[30%] px-2 py-1.5 text-xs font-semibold uppercase tracking-wide">Name</TableHead>
              <TableHead className="w-16 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide">Status</TableHead>
              <TableHead className="w-16 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide hidden sm:table-cell">Method</TableHead>
              <TableHead className="w-20 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide hidden md:table-cell">Type</TableHead>
              <TableHead className="w-16 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-right hidden lg:table-cell">Size</TableHead>
              <TableHead className="w-16 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-right">Time</TableHead>
              <TableHead className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide hidden xl:table-cell">Waterfall</TableHead>
              <TableHead className="w-14 px-2 py-1.5 text-center">
                <Sparkles className="h-3 w-3 text-amber-500 mx-auto" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-xs">
                  No requests match the current filter.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((entry, idx) => {
                const isSelected  = selectedIndex === idx;
                const hasAiCard   = aiCardIndex === idx;
                const isError     = entry.response.status >= 400 || entry.response.status === 0;
                const startOffset = new Date(entry.startedDateTime).getTime() - startMs;
                const oidcInfo    = getOidcInfo(entry.request.url, entry.request.method);
                const oidcStyle   = oidcInfo ? OIDC_STYLES[oidcInfo.phase] : null;
                const isOkta      = !oidcInfo && hasOktaHeader(entry);
                const showAiButton = isError && oidcInfo !== null;
                return (
                  <Fragment key={idx}>
                    <TableRow
                      onClick={() => setSelectedIndex(isSelected ? null : idx)}
                      className={cn(
                        "cursor-pointer border-b border-border/40 transition-colors",
                        isSelected
                          ? "bg-primary/10 dark:bg-primary/20"
                          : oidcStyle ? oidcStyle.row
                          : isOkta    ? OKTA_STYLE.row
                          : getRowClass(entry.response.status),
                        !isSelected && "hover:bg-muted/50",
                      )}
                    >
                      <TableCell className="px-2 py-1 max-w-0 overflow-hidden">
                        <div className="flex items-center gap-1.5 truncate" title={entry.request.url}>
                          {oidcInfo && (
                            <span className={cn("flex-shrink-0 text-[10px] font-medium px-1 py-px rounded leading-tight", oidcStyle?.badge)}>
                              {oidcInfo.label}
                            </span>
                          )}
                          {isOkta && (
                            <span className={cn("flex-shrink-0 text-[10px] font-medium px-1 py-px rounded leading-tight", OKTA_STYLE.badge)}>
                              Okta
                            </span>
                          )}
                          <span className="truncate font-mono">{urlName(entry.request.url)}</span>
                        </div>
                        <div className="truncate text-muted-foreground/60 text-[10px] font-mono">
                          {(() => { try { return new URL(entry.request.url).hostname; } catch { return ""; } })()}
                        </div>
                      </TableCell>
                      <TableCell className={cn("px-2 py-1 font-mono tabular-nums", getStatusClass(entry.response.status))}>
                        {entry.response.status}
                      </TableCell>
                      <TableCell className={cn("px-2 py-1 font-mono hidden sm:table-cell", getMethodClass(entry.request.method))}>
                        {entry.request.method}
                      </TableCell>
                      <TableCell className="px-2 py-1 text-muted-foreground hidden md:table-cell">
                        {getResourceType(entry)}
                      </TableCell>
                      <TableCell className="px-2 py-1 text-right text-muted-foreground hidden lg:table-cell font-mono tabular-nums">
                        {formatBytes(entry.response.content?.size ?? entry.response.bodySize)}
                      </TableCell>
                      <TableCell className="px-2 py-1 text-right font-mono tabular-nums text-muted-foreground">
                        {formatDuration(entry.time)}
                      </TableCell>
                      <TableCell className="px-2 py-1 hidden xl:table-cell min-w-[100px]">
                        <WaterfallBar entry={entry} startOffset={startOffset} totalSpan={spanMs} />
                      </TableCell>
                      <TableCell className="px-2 py-1 text-center">
                        {showAiButton ? (
                          <Button
                            variant="outline"
                            size="sm"
                            title="Get AI suggestions for this error"
                            onClick={(e) => { e.stopPropagation(); setAiCardIndex(hasAiCard ? null : idx); }}
                            className={cn(
                              "h-6 px-1.5 gap-1 text-[10px] font-semibold shadow-none",
                              hasAiCard
                                ? "bg-amber-200 text-amber-800 border-amber-400 hover:bg-amber-200 hover:text-amber-800 dark:bg-amber-800/60 dark:text-amber-200 dark:border-amber-600 dark:hover:bg-amber-800/60 dark:hover:text-amber-200"
                                : "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 hover:text-amber-800 hover:border-amber-400 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700 dark:hover:bg-amber-900/60 dark:hover:text-amber-300",
                            )}
                          >
                            AI
                          </Button>
                        ) : (
                          <span className="text-border/40">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                    {hasAiCard && (
                      <TableRow className="bg-amber-50/30 dark:bg-amber-950/10">
                        <TableCell colSpan={8} className="p-2 overflow-hidden">
                          <AiSuggestionCard entry={entry} onClose={() => setAiCardIndex(null)} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </table>
      </div>

      {/* Drag handle — only visible when detail panel is open */}
      {selected && (
        <div
          onMouseDown={onDragHandleMouseDown}
          className="flex-shrink-0 h-2 flex items-center justify-center cursor-ns-resize group bg-transparent hover:bg-muted/50 transition-colors border-t border-border"
        >
          <div className="w-10 h-0.5 rounded-full bg-border group-hover:bg-primary/60 transition-colors" />
        </div>
      )}

      {/* Bottom drawer */}
      {selected && (() => {
        const oktaRequestId = selected.response.headers.find(h => h.name.toLowerCase() === "x-okta-request-id")?.value;
        const hostname      = (() => { try { return new URL(selected.request.url).hostname; } catch { return ""; } })();
        const cached        = orgInfoCache[hostname];
        const orgId         = cached?.id ?? null;
        const cell          = cached?.cell ?? null;
        const orgPending    = orgPendingRef.current.has(hostname);
        const oidcInfo      = getOidcInfo(selected.request.url, selected.request.method);
        const oidcStyle     = oidcInfo ? OIDC_STYLES[oidcInfo.phase] : null;
        const isOkta        = !oidcInfo && hasOktaHeader(selected);
        return (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/40 flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {oidcStyle && <span className={cn("flex-shrink-0 text-[10px] font-sans font-medium px-1.5 py-px rounded", oidcStyle.badge)}>{oidcInfo!.label}</span>}
                {isOkta    && <span className={cn("flex-shrink-0 text-[10px] font-sans font-medium px-1.5 py-px rounded", OKTA_STYLE.badge)}>Okta</span>}
                <span className="text-xs font-mono truncate text-foreground/80" title={selected.request.url}>
                  {urlName(selected.request.url)}
                </span>
                <span className="text-[10px] text-muted-foreground flex-shrink-0 font-mono tabular-nums">
                  {selected.response.status} · {formatDuration(selected.time)}
                </span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedIndex(null)} className="h-6 w-6 ml-2 flex-shrink-0 text-muted-foreground">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            <Tabs defaultValue="headers" className="flex flex-col flex-1 min-h-0">
              <div className="flex-shrink-0 px-4 pt-3 pb-2 bg-card border-b border-border/60">
                <TabsList className="h-8">
                  <TabsTrigger value="headers"   className="text-xs px-3">Headers</TabsTrigger>
                  {oidcInfo && (
                    <TabsTrigger value="urlparams" className="text-xs px-3 text-blue-600 dark:text-blue-400 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-300">
                      URL Params
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="preview"   className="text-xs px-3">Preview</TabsTrigger>
                  <TabsTrigger value="response"  className="text-xs px-3">Response</TabsTrigger>
                  <TabsTrigger value="timing"    className="text-xs px-3">Timing</TabsTrigger>
                  {oktaRequestId && (
                    <TabsTrigger value="splunk" className="text-xs px-3 text-violet-600 dark:text-violet-400 data-[state=active]:text-violet-700 dark:data-[state=active]:text-violet-300">
                      Splunk
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>

              <div className="flex-1 overflow-auto min-h-0 p-4">
                <TabsContent value="headers" className="mt-0">
                  <HeadersPanel entry={selected} />
                </TabsContent>
                {oidcInfo && (
                  <TabsContent value="urlparams" className="mt-0">
                    <OidcUrlPanel entry={selected} />
                  </TabsContent>
                )}
                <TabsContent value="preview" className="mt-0">
                  <JsonViewer data={tryParseJson(selected.response.content?.text) ?? selected.response.content} />
                </TabsContent>
                <TabsContent value="response" className="mt-0">
                  <pre className="rounded-md border border-border bg-card p-3 text-xs font-mono whitespace-pre-wrap break-all">
                    {selected.response.content?.text ?? "(empty)"}
                  </pre>
                </TabsContent>
                <TabsContent value="timing" className="mt-0">
                  <TimingPanel timings={selected.timings} total={selected.time} />
                </TabsContent>
                {oktaRequestId && (
                  <TabsContent value="splunk" className="mt-0">
                    <SplunkPanel entry={selected} orgId={orgId} cell={cell} orgPending={orgPending || !(hostname in orgInfoCache)} />
                  </TabsContent>
                )}
              </div>
            </Tabs>
          </div>
        );
      })()}

      </div>{/* end content area */}

      {/* Status bar */}
      <div className="flex items-center gap-4 px-3 py-1.5 border-t border-border bg-muted/30 text-[11px] text-muted-foreground flex-wrap flex-shrink-0">
        <span><span className="font-mono tabular-nums">{filtered.length}</span> requests</span>
        <span><span className="font-mono tabular-nums">{formatBytes(filtered.reduce((s, e) => s + Math.max(0, e.response.content?.size ?? e.response.bodySize ?? 0), 0))}</span> transferred</span>
        <span><span className="font-mono tabular-nums">{formatDuration(filtered.reduce((s, e) => s + e.time, 0))}</span> total load time</span>
      </div>
    </div>
  );
}
