"use client";

// ─── Catalogue list ───────────────────────────────────────────────────────────
//
// Shared list for the flat catalogue resources — Entitlements and Roles. Those
// two pages were ~270 lines each differing by about 80: same state, same fetch,
// same table, same create dialog. Only the icon, the accent, whether a `type`
// field exists, and the expanded editor actually differ. One component
// parameterised on those means the design cannot drift between them.
//
// Same pattern as /scim/users and /scim/groups: lazy loading, search, sorting,
// row selection with bulk delete, split empty-vs-no-match states.
//
// Search and sort are CLIENT-side. Neither the Entitlements nor the Roles
// endpoint accepts a `filter` parameter — both take only startIndex/count — so
// the UI says it is filtering the rows already loaded rather than implying a
// server-side query.

import { useEffect, useState, useMemo, useCallback, useRef, Fragment, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronRight, Plus, Loader2, Search, X, RefreshCw, Trash2,
  ArrowUpDown, ArrowUp, ArrowDown, Sparkles,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import { usePageTracking } from "@/hooks/usePageTracking";
import { ResourceTile } from "@/components/scim/resource-tile";

const PAGE_SIZE = 30;

/** Minimum shape every catalogue resource shares. */
interface CatalogItem {
  id: string;
  displayName: string;
  description?: string;
  type?: string;
  meta?: { lastModified?: string };
}

type SortKey = "displayName" | "type" | "lastModified";
type SortDir = "asc" | "desc";

export function CatalogList<T extends CatalogItem>({
  resource,
  noun,
  nounPlural,
  icon,
  hasType,
  schema,
  renderEditor,
}: {
  /** SCIM path segment, e.g. "Entitlements". */
  resource: string;
  noun: string;
  nounPlural: string;
  icon: ReactNode;
  /** Entitlements carry a `type`; Roles do not. */
  hasType?: boolean;
  schema: string;
  renderEditor: (item: T, onUpdate: () => void) => ReactNode;
}) {
  usePageTracking();
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [items,        setItems]        = useState<T[]>([]);
  const [total,        setTotal]        = useState(0);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isPaging,     setIsPaging]     = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError,    setLoadError]    = useState<string | null>(null);

  const [query,   setQuery]   = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bulkBusy,    setBulkBusy]    = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName,    setNewName]    = useState("");
  const [newType,    setNewType]    = useState("");
  const [newDesc,    setNewDesc]    = useState("");
  const [creating,   setCreating]   = useState(false);

  const searchRef   = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const inFlight    = useRef(false);

  const hasMore = items.length < total;
  const cols    = hasType ? 7 : 6;

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

  const fetchPage = useCallback(async (startIndex: number, mode: "replace" | "append") => {
    if (!userId || inFlight.current) return;
    inFlight.current = true;
    if (mode === "replace") setIsLoading(true); else setIsPaging(true);
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/${userId}/scim/v2/${resource}?startIndex=${startIndex}&count=${PAGE_SIZE}`,
      );
      if (!res.ok) throw new Error(res.statusText || `HTTP ${res.status}`);
      const data  = await res.json();
      const batch = (data.Resources ?? []) as T[];
      setTotal(data.totalResults ?? 0);
      setItems((prev) => {
        if (mode === "replace") return batch;
        const seen = new Set(prev.map((x) => x.id));
        return [...prev, ...batch.filter((x) => !seen.has(x.id))];
      });
    } catch (e) {
      const msg = (e as Error).message;
      setLoadError(msg);
      if (mode === "replace") toast.error(`Failed to load ${nounPlural}: ${msg}`);
    } finally {
      inFlight.current = false;
      setIsLoading(false);
      setIsPaging(false);
      setIsRefreshing(false);
    }
  }, [userId, resource, nounPlural]);

  useEffect(() => { fetchPage(1, "replace"); }, [fetchPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || isLoading) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !inFlight.current) {
        fetchPage(items.length + 1, "append");
      }
    }, { rootMargin: "240px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, isLoading, items.length, fetchPage]);

  const refresh = () => {
    setIsRefreshing(true);
    setItems([]); setTotal(0); setSelected(new Set());
    fetchPage(1, "replace");
  };

  // Drop selections no longer on screen so the bulk count can never claim rows
  // the user cannot see.
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(items.map((x) => x.id));
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = q
      ? items.filter((x) =>
          x.displayName?.toLowerCase().includes(q) ||
          x.description?.toLowerCase().includes(q) ||
          x.type?.toLowerCase().includes(q) ||
          x.id.toLowerCase().includes(q))
      : items;

    if (sortKey) {
      const dir = sortDir === "asc" ? 1 : -1;
      out = [...out].sort((a, b) => {
        if (sortKey === "lastModified") {
          const at = a.meta?.lastModified ? Date.parse(a.meta.lastModified) : 0;
          const bt = b.meta?.lastModified ? Date.parse(b.meta.lastModified) : 0;
          return (at - bt) * dir;
        }
        const av = (sortKey === "type" ? a.type : a.displayName) ?? "";
        const bv = (sortKey === "type" ? b.type : b.displayName) ?? "";
        return av.localeCompare(bv) * dir;
      });
    }
    return out;
  }, [items, query, sortKey, sortDir]);

  const allSelected = rows.length > 0 && rows.every((x) => selected.has(x.id));
  const isFiltered  = query.trim().length > 0;

  const toggleSort = (key: SortKey) => {
    if (sortKey !== key) { setSortKey(key); setSortDir("asc"); return; }
    if (sortDir === "asc") { setSortDir("desc"); return; }
    setSortKey(null); setSortDir("asc");
  };

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(rows.map((x) => x.id)));

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const resetDialog = () => { setNewName(""); setNewType(""); setNewDesc(""); };

  const create = async () => {
    if (!newName.trim())            { toast.error("Display name is required."); return; }
    if (hasType && !newType.trim()) { toast.error("Type is required.");         return; }
    setCreating(true);
    try {
      const res = await fetch(`/api/${userId}/scim/v2/${resource}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schemas:     [schema],
          displayName: newName.trim(),
          ...(hasType ? { type: newType.trim() } : {}),
          description: newDesc.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || `Failed to create ${noun}.`);
      toast.success(`${noun[0].toUpperCase()}${noun.slice(1)} created.`);
      resetDialog();
      setDialogOpen(false);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  // Sequential rather than parallel: the tenant is capped at 60 req/min.
  const bulkDelete = async () => {
    if (!userId || selected.size === 0) return;
    setBulkBusy(true);
    const ids = [...selected];
    let ok = 0;
    for (const id of ids) {
      try {
        const res = await fetch(`/api/${userId}/scim/v2/${resource}/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(res.statusText);
        ok++;
      } catch { /* counted by omission */ }
    }
    setBulkBusy(false);
    setConfirmOpen(false);
    setSelected(new Set());
    if (ok === ids.length) toast.success(`Deleted ${ok} ${ok === 1 ? noun : nounPlural}.`);
    else toast.error(`Deleted ${ok} of ${ids.length} — ${ids.length - ok} failed.`);
    refresh();
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const SkeletonRows = ({ n }: { n: number }) => (
    <>
      {Array.from({ length: n }).map((_, i) => (
        <TableRow key={`sk-${i}`}>
          <TableCell className="pl-3"><Skeleton className="h-4 w-4 rounded" /></TableCell>
          <TableCell />
          <TableCell>
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-md" />
              <Skeleton className="h-4 w-36" />
            </div>
          </TableCell>
          {hasType && <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>}
          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
          <TableCell><Skeleton className="h-4 w-52" /></TableCell>
          <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
        </TableRow>
      ))}
    </>
  );

  return (
    <motion.div
      className="container mx-auto space-y-4 py-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      {/* ─── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="min-w-[220px] flex-1">
          <InputGroupAddon><Search className="h-3.5 w-3.5" /></InputGroupAddon>
          <InputGroupInput
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Filter loaded ${nounPlural}…`}
            aria-label={`Filter loaded ${nounPlural}`}
            className="text-xs"
          />
          <InputGroupAddon align="inline-end">
            {query ? (
              <InputGroupButton size="icon-xs" variant="ghost" onClick={() => setQuery("")} aria-label="Clear filter">
                <X className="h-3.5 w-3.5" />
              </InputGroupButton>
            ) : <Kbd>⌘K</Kbd>}
          </InputGroupAddon>
        </InputGroup>

        <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={refresh} disabled={isRefreshing || isLoading}>
          <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
          Refresh
        </Button>

        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetDialog(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-9 gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New {noun}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New {noun}</DialogTitle>
              <DialogDescription>
                Fields marked <span className="text-destructive">*</span> are required.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Display Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  className="h-8 text-xs" value={newName}
                  placeholder={hasType ? "e.g. Admin Access" : "e.g. Developer"}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              {hasType && (
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Type <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    className="h-8 text-xs" value={newType}
                    placeholder="e.g. role · permission · license · feature"
                    onChange={(e) => setNewType(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Description
                </Label>
                <Input
                  className="h-8 text-xs" value={newDesc}
                  placeholder="Optional"
                  onChange={(e) => setNewDesc(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") create(); }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetDialog(); }}>Cancel</Button>
              <Button onClick={create} disabled={creating} className="gap-1.5">
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <p className="-mt-1 text-[11px] leading-relaxed text-muted-foreground">
        The {resource} endpoint has no server-side filter, so this searches the{" "}
        {items.length} {items.length === 1 ? noun : nounPlural} loaded so far
        {hasMore && <> of {total} — scroll to load the rest</>}. Sorting is also client-side.
      </p>

      {/* ─── Bulk action bar ─────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2">
              <span className="text-xs">
                <strong>{selected.size}</strong> selected
                <span className="text-muted-foreground"> of {rows.length} shown</span>
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="destructive" size="sm" className="h-7 gap-1.5 text-xs"
                  onClick={() => setConfirmOpen(true)} disabled={bulkBusy}
                >
                  <Trash2 className="h-3 w-3" /> Delete {selected.size}
                </Button>
                <Button
                  variant="ghost" size="sm" className="h-7 w-7 p-0"
                  onClick={() => setSelected(new Set())} aria-label="Clear selection"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Table ───────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted dark:bg-white/[0.04]">
            <TableRow>
              <TableHead className="w-9 pl-3">
                <Checkbox
                  checked={allSelected} onCheckedChange={toggleAll}
                  aria-label={`Select all shown ${nounPlural}`} disabled={rows.length === 0}
                />
              </TableHead>
              <TableHead className="w-8" />
              <TableHead className="text-xs font-semibold uppercase tracking-wide">
                <button onClick={() => toggleSort("displayName")} className="flex items-center gap-1.5 hover:text-foreground">
                  Name <SortIcon col="displayName" />
                </button>
              </TableHead>
              {hasType && (
                <TableHead className="text-xs font-semibold uppercase tracking-wide">
                  <button onClick={() => toggleSort("type")} className="flex items-center gap-1.5 hover:text-foreground">
                    Type <SortIcon col="type" />
                  </button>
                </TableHead>
              )}
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Description</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">ID</TableHead>
              <TableHead className="hidden text-xs font-semibold uppercase tracking-wide md:table-cell">
                <button onClick={() => toggleSort("lastModified")} className="flex items-center gap-1.5 hover:text-foreground">
                  Modified <SortIcon col="lastModified" />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <SkeletonRows n={6} />
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={cols} className="p-0">
                  {isFiltered ? (
                    <Empty className="border-0">
                      <EmptyHeader>
                        <EmptyMedia variant="icon"><Search className="h-4 w-4" /></EmptyMedia>
                        <EmptyTitle className="text-sm">No matching {nounPlural}</EmptyTitle>
                        <EmptyDescription className="text-xs">
                          Nothing among the loaded {nounPlural} matches{" "}
                          <code className="font-mono">{query}</code>.
                          {hasMore && " More may not be loaded yet — scroll to load them."}
                        </EmptyDescription>
                      </EmptyHeader>
                      <EmptyContent>
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setQuery("")}>
                          <X className="h-3.5 w-3.5" /> Clear filter
                        </Button>
                      </EmptyContent>
                    </Empty>
                  ) : (
                    <Empty className="border-0">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">{icon}</EmptyMedia>
                        <EmptyTitle className="text-sm">No {nounPlural} yet</EmptyTitle>
                        <EmptyDescription className="text-xs">
                          {nounPlural[0].toUpperCase()}{nounPlural.slice(1)} appear here once
                          Okta pushes them, or create one directly. The mock generator also
                          seeds a catalogue.
                        </EmptyDescription>
                      </EmptyHeader>
                      <EmptyContent className="flex-row flex-wrap justify-center gap-2">
                        <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
                          <Plus className="h-3.5 w-3.5" /> New {noun}
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1.5">
                          <Sparkles className="h-3.5 w-3.5" /> Generate mock data
                        </Button>
                      </EmptyContent>
                    </Empty>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((item) => {
                const isSel  = selected.has(item.id);
                const isOpen = expandedId === item.id;
                return (
                  <Fragment key={item.id}>
                    <TableRow
                      data-state={isSel ? "selected" : undefined}
                      className={cn("cursor-pointer transition-colors", isSel && "bg-primary/5 hover:bg-primary/10")}
                      onClick={() => setExpandedId(isOpen ? null : item.id)}
                    >
                      <TableCell className="pl-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSel} onCheckedChange={() => toggleOne(item.id)}
                          aria-label={`Select ${item.displayName}`}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <ChevronRight className={cn("h-4 w-4 transition-transform duration-150", isOpen && "rotate-90")} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {/* Tint hashed off the name, not a fixed accent: every
                              row previously carried an identical tile. */}
                          <ResourceTile icon={icon} hashKey={item.displayName} />
                          <span className="text-sm font-medium">{item.displayName}</span>
                        </div>
                      </TableCell>
                      {hasType && (
                        <TableCell>
                          {item.type
                            ? <Badge variant="outline" className="text-[10px]">{item.type}</Badge>
                            : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                      )}
                      <TableCell className="max-w-[22rem] truncate text-xs text-muted-foreground" title={item.description}>
                        {item.description || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{item.id}</TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                        {item.meta?.lastModified ? new Date(item.meta.lastModified).toLocaleDateString() : "—"}
                      </TableCell>
                    </TableRow>

                    {isOpen && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={cols} className="border-t border-border/60 p-0">
                          <div className="px-5 py-4">{renderEditor(item, refresh)}</div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}

            {isPaging && <SkeletonRows n={4} />}
          </TableBody>
        </Table>
      </div>

      {/* ─── Lazy-load sentinel ──────────────────────────────────────────── */}
      <div ref={sentinelRef} className="flex flex-col items-center gap-2 py-1">
        {loadError && items.length > 0 && (
          <p className="text-xs text-destructive">Could not load more: {loadError}</p>
        )}
        {hasMore && !isPaging && (
          <Button
            variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
            onClick={() => fetchPage(items.length + 1, "append")}
          >
            Load {Math.min(PAGE_SIZE, total - items.length)} more
          </Button>
        )}
        {!isLoading && (
          <p className="text-xs text-muted-foreground">
            {total === 0 ? `No ${nounPlural} yet` : (
              <>
                <span className="font-medium tabular-nums text-foreground">{items.length}</span>
                {" of "}
                <span className="font-medium tabular-nums text-foreground">{total}</span>
                {" loaded"}
                {isFiltered && <> · {rows.length} match “{query}”</>}
                {!hasMore && total > PAGE_SIZE && " — end of list"}
              </>
            )}
          </p>
        )}
      </div>

      {/* ─── Bulk delete confirmation ────────────────────────────────────── */}
      <Dialog open={confirmOpen} onOpenChange={(o) => !bulkBusy && setConfirmOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Delete {selected.size} {selected.size === 1 ? noun : nounPlural}?
            </DialogTitle>
            <DialogDescription>
              Users currently assigned {selected.size === 1 ? "this" : "these"} keep the
              reference in their resource until the next sync, which will then report it
              as unknown. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={bulkBusy}>
              Cancel
            </Button>
            <Button variant="destructive" className="gap-1.5" onClick={bulkDelete} disabled={bulkBusy}>
              {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
