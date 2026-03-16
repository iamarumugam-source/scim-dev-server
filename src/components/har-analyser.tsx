"use client";

import { useState, useCallback, useRef, useMemo, useEffect, Fragment } from "react";
import { X, Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JsonViewer } from "@/components/json-viewer";
import { cn } from "@/lib/utils";

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
  const orgPendingRef   = useRef<Set<string>>(new Set());
  const [drawerHeight,  setDrawerHeight]  = useState(320);
  const isDragging      = useRef(false);
  const dragStartY      = useRef(0);
  const dragStartHeight = useRef(0);

  const onDragHandleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current      = true;
    dragStartY.current      = e.clientY;
    dragStartHeight.current = drawerHeight;
    e.preventDefault();
    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta   = dragStartY.current - ev.clientY;
      const clamped = Math.max(150, Math.min(window.innerHeight * 0.85, dragStartHeight.current + delta));
      setDrawerHeight(clamped);
    };
    const onMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup",   onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup",   onMouseUp);
  }, [drawerHeight]);

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

      {/* Table */}
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
              <th className="w-14 px-2 py-1.5 text-center">
                <Sparkles className="h-3 w-3 text-amber-500 mx-auto" />
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-muted-foreground text-xs">
                  No requests match the current filter.
                </td>
              </tr>
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
                    <tr
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
                      <td className="px-2 py-1 text-center">
                        {showAiButton ? (
                          <button
                            title="Get AI suggestions for this error"
                            onClick={(e) => { e.stopPropagation(); setAiCardIndex(hasAiCard ? null : idx); }}
                            className={cn(
                              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-sans font-semibold border transition-colors",
                              hasAiCard
                                ? "bg-amber-200 text-amber-800 border-amber-400 dark:bg-amber-800/60 dark:text-amber-200 dark:border-amber-600"
                                : "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 hover:border-amber-400 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700 dark:hover:bg-amber-900/60",
                            )}
                          >
                            <Sparkles className="h-3 w-3" />
                            AI
                          </button>
                        ) : (
                          <span className="text-border/40">—</span>
                        )}
                      </td>
                    </tr>
                    {hasAiCard && (
                      <tr className="border-b border-border/40 bg-amber-50/30 dark:bg-amber-950/10">
                        <td colSpan={8} className="p-2">
                          <AiSuggestionCard entry={entry} onClose={() => setAiCardIndex(null)} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

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
          <div
            className="flex-shrink-0 border-t border-border flex flex-col overflow-hidden"
            style={{ height: drawerHeight }}
          >
            <div
              onMouseDown={onDragHandleMouseDown}
              className="flex-shrink-0 h-2.5 flex items-center justify-center cursor-ns-resize group bg-transparent hover:bg-muted/50 transition-colors"
              title="Drag to resize"
            >
              <div className="w-10 h-0.5 rounded-full bg-border/60 group-hover:bg-primary/40 transition-colors" />
            </div>

            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/40 flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {oidcStyle && <span className={cn("flex-shrink-0 text-[10px] font-sans font-medium px-1.5 py-px rounded", oidcStyle.badge)}>{oidcInfo!.label}</span>}
                {isOkta    && <span className={cn("flex-shrink-0 text-[10px] font-sans font-medium px-1.5 py-px rounded", OKTA_STYLE.badge)}>Okta</span>}
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

            <Tabs defaultValue="headers" className="flex flex-col flex-1 min-h-0">
              <div className="flex-shrink-0 px-3 pt-2 pb-0 bg-card border-b border-border/60">
                <TabsList className="h-7 text-xs">
                  <TabsTrigger value="headers"   className="text-xs h-6 px-2">Headers</TabsTrigger>
                  {oidcInfo && (
                    <TabsTrigger value="urlparams" className="text-xs h-6 px-2 text-blue-600 dark:text-blue-400 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-300">
                      URL Params
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="preview"   className="text-xs h-6 px-2">Preview</TabsTrigger>
                  <TabsTrigger value="response"  className="text-xs h-6 px-2">Response</TabsTrigger>
                  <TabsTrigger value="timing"    className="text-xs h-6 px-2">Timing</TabsTrigger>
                  {oktaRequestId && (
                    <TabsTrigger value="splunk" className="text-xs h-6 px-2 text-violet-600 dark:text-violet-400 data-[state=active]:text-violet-700 dark:data-[state=active]:text-violet-300">
                      Splunk
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>

              <div className="flex-1 overflow-auto min-h-0 p-3">
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

      {/* Status bar */}
      <div className="flex items-center gap-4 px-3 py-1.5 border-t border-border bg-muted/30 text-[11px] text-muted-foreground font-mono flex-wrap flex-shrink-0">
        <span>{filtered.length} requests</span>
        <span>{formatBytes(filtered.reduce((s, e) => s + Math.max(0, e.response.content?.size ?? e.response.bodySize ?? 0), 0))} transferred</span>
        <span>{formatDuration(filtered.reduce((s, e) => s + e.time, 0))} total load time</span>
      </div>
    </div>
  );
}
