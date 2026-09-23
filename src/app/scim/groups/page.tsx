"use client";

// ─── Groups ───────────────────────────────────────────────────────────────────
//
// Same pattern as /scim/users: lazy loading, search, sorting, row selection and
// bulk actions, with the detail editor in an expandable row.
//
// One deliberate difference from Users, because the server differs: the Groups
// endpoint accepts ONLY startIndex/count — there is no `filter` parameter and
// groupService.getGroups takes no filter argument. So search here is CLIENT-side
// over the rows already loaded, and the UI says so. Group counts are small (the
// mock generator caps at 100), so lazy loading reaches the full set quickly and
// the practical difference is slight — but it is not the same guarantee Users
// gives, and pretending otherwise would mislead.

import { useEffect, useState, useMemo, useCallback, useRef, Fragment } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ScimGroup } from "@/lib/scim/models/scimSchemas";
import {
  ChevronRight, Boxes, Plus, Loader2, Search, X, RefreshCw, Trash2,
  ArrowUpDown, ArrowUp, ArrowDown, Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Kbd } from "@/components/ui/kbd";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { GroupEditor } from "@/components/scim/group-editor";
import { ResourceIcon } from "@/components/scim/resource-icon";
import { usePageTracking } from "@/hooks/usePageTracking";

const PAGE_SIZE = 30;

type SortKey = "displayName" | "members" | "lastModified";
type SortDir = "asc" | "desc";

export default function GroupsPage() {
  usePageTracking();
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [groups,     setGroups]     = useState<ScimGroup[]>([]);
  const [total,      setTotal]      = useState(0);
  const [isLoading,  setIsLoading]  = useState(true);
  const [isPaging,   setIsPaging]   = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError,  setLoadError]  = useState<string | null>(null);

  const [query,   setQuery]   = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bulkBusy,   setBulkBusy]   = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName,    setNewName]    = useState("");
  const [creating,   setCreating]   = useState(false);

  const searchRef   = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Guards a second fetch firing before the first resolves — the observer can
  // retrigger while a request is still in flight.
  const inFlight    = useRef(false);

  const hasMore = groups.length < total;

  // ⌘K / Ctrl+K focuses search.
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

  const fetchPage = useCallback(async (
    startIndex: number,
    mode: "replace" | "append",
  ) => {
    if (!userId || inFlight.current) return;
    inFlight.current = true;
    if (mode === "replace") setIsLoading(true); else setIsPaging(true);
    setLoadError(null);

    try {
      const res = await fetch(
        `/api/${userId}/scim/v2/Groups?startIndex=${startIndex}&count=${PAGE_SIZE}`,
      );
      if (!res.ok) throw new Error(res.statusText || `HTTP ${res.status}`);

      const data  = await res.json();
      const batch = (data.Resources ?? []) as ScimGroup[];
      setTotal(data.totalResults ?? 0);

      setGroups((prev) => {
        if (mode === "replace") return batch;
        // De-dupe by id: rows can shift between requests if data changes
        // underneath us, which would otherwise duplicate React keys.
        const seen = new Set(prev.map((g) => g.id));
        return [...prev, ...batch.filter((g) => !seen.has(g.id))];
      });
    } catch (e) {
      const msg = (e as Error).message;
      setLoadError(msg);
      if (mode === "replace") toast.error(`Failed to load groups: ${msg}`);
    } finally {
      inFlight.current = false;
      setIsLoading(false);
      setIsPaging(false);
      setIsRefreshing(false);
    }
  }, [userId]);

  useEffect(() => { fetchPage(1, "replace"); }, [fetchPage]);

  // ─── Infinite scroll ───────────────────────────────────────────────────────
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || isLoading) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !inFlight.current) {
          fetchPage(groups.length + 1, "append");
        }
      },
      { rootMargin: "240px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, isLoading, groups.length, fetchPage]);

  const refresh = () => {
    setIsRefreshing(true);
    setGroups([]);
    setTotal(0);
    setSelected(new Set());
    fetchPage(1, "replace");
  };

  // Drop selections no longer on screen, so the bulk count can never claim rows
  // the user cannot see.
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(groups.map((g) => g.id));
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [groups]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = q
      ? groups.filter((g) =>
          g.displayName?.toLowerCase().includes(q) || g.id.toLowerCase().includes(q))
      : groups;

    if (sortKey) {
      const dir = sortDir === "asc" ? 1 : -1;
      out = [...out].sort((a, b) => {
        if (sortKey === "members") {
          return ((a.members?.length ?? 0) - (b.members?.length ?? 0)) * dir;
        }
        if (sortKey === "lastModified") {
          const at = a.meta?.lastModified ? Date.parse(a.meta.lastModified) : 0;
          const bt = b.meta?.lastModified ? Date.parse(b.meta.lastModified) : 0;
          return (at - bt) * dir;
        }
        return (a.displayName ?? "").localeCompare(b.displayName ?? "") * dir;
      });
    }
    return out;
  }, [groups, query, sortKey, sortDir]);

  const allSelected = rows.length > 0 && rows.every((g) => selected.has(g.id));
  const isFiltered  = query.trim().length > 0;

  const toggleSort = (key: SortKey) => {
    if (sortKey !== key) { setSortKey(key); setSortDir("asc"); return; }
    if (sortDir === "asc") { setSortDir("desc"); return; }
    setSortKey(null); setSortDir("asc");
  };

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(rows.map((g) => g.id)));

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const createGroup = async () => {
    if (!newName.trim()) { toast.error("Group name is required."); return; }
    setCreating(true);
    try {
      const res = await fetch(`/api/${userId}/scim/v2/Groups`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schemas:     ["urn:ietf:params:scim:schemas:core:2.0:Group"],
          displayName: newName.trim(),
          members:     [],
        }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed to create group.");
      toast.success("Group created.");
      setNewName("");
      setDialogOpen(false);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  // Sequential rather than Promise.all: the tenant is rate limited to 60 req/min
  // and a parallel burst would trip it.
  const bulkDelete = async () => {
    if (!userId || selected.size === 0) return;
    setBulkBusy(true);
    const ids = [...selected];
    let ok = 0;

    for (const id of ids) {
      try {
        const res = await fetch(`/api/${userId}/scim/v2/Groups/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(res.statusText);
        ok++;
      } catch { /* failures counted by omission */ }
    }

    setBulkBusy(false);
    setConfirmOpen(false);
    setSelected(new Set());

    if (ok === ids.length) toast.success(`Deleted ${ok} group${ok === 1 ? "" : "s"}.`);
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
              <Skeleton className="h-4 w-32" />
            </div>
          </TableCell>
          <TableCell><Skeleton className="h-4 w-56" /></TableCell>
          <TableCell><Skeleton className="h-5 w-8 rounded-full" /></TableCell>
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
          <InputGroupAddon>
            <Search className="h-3.5 w-3.5" />
          </InputGroupAddon>
          <InputGroupInput
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter loaded groups by name or id…"
            aria-label="Filter loaded groups"
            className="text-xs"
          />
          <InputGroupAddon align="inline-end">
            {query ? (
              <InputGroupButton
                size="icon-xs" variant="ghost"
                onClick={() => setQuery("")} aria-label="Clear filter"
              >
                <X className="h-3.5 w-3.5" />
              </InputGroupButton>
            ) : (
              <Kbd>⌘K</Kbd>
            )}
          </InputGroupAddon>
        </InputGroup>

        <Button
          variant="outline" size="sm" className="h-9 gap-1.5"
          onClick={refresh} disabled={isRefreshing || isLoading}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
          Refresh
        </Button>

        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setNewName(""); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-9 gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New Group
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>New Group</DialogTitle>
              <DialogDescription>Create a new provisioned group.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1 py-2">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Group Name <span className="text-destructive">*</span>
              </Label>
              <Input
                className="h-8 text-xs"
                placeholder="e.g. Engineering Team"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") createGroup(); }}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogOpen(false); setNewName(""); }}>
                Cancel
              </Button>
              <Button onClick={createGroup} disabled={creating} className="gap-1.5">
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* States what is server-side vs client-side, rather than implying parity
          with the Users page. */}
      <p className="-mt-1 text-[11px] leading-relaxed text-muted-foreground">
        The Groups endpoint has no server-side filter, so this searches the{" "}
        {groups.length} group{groups.length === 1 ? "" : "s"} loaded so far
        {hasMore && <> of {total} — scroll to load the rest</>}. Sorting is also
        client-side.
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
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all shown groups"
                  disabled={rows.length === 0}
                />
              </TableHead>
              <TableHead className="w-8" />
              <TableHead className="text-xs font-semibold uppercase tracking-wide">
                <button onClick={() => toggleSort("displayName")} className="flex items-center gap-1.5 hover:text-foreground">
                  Group Name <SortIcon col="displayName" />
                </button>
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Group ID</TableHead>
              <TableHead className="w-28 text-xs font-semibold uppercase tracking-wide">
                <button onClick={() => toggleSort("members")} className="flex items-center gap-1.5 hover:text-foreground">
                  Members <SortIcon col="members" />
                </button>
              </TableHead>
              <TableHead className="hidden text-xs font-semibold uppercase tracking-wide md:table-cell">
                <button onClick={() => toggleSort("lastModified")} className="flex items-center gap-1.5 hover:text-foreground">
                  Last Modified <SortIcon col="lastModified" />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <SkeletonRows n={6} />
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="p-0">
                  {isFiltered ? (
                    <Empty className="border-0">
                      <EmptyHeader>
                        <EmptyMedia variant="icon"><Search className="h-4 w-4" /></EmptyMedia>
                        <EmptyTitle className="text-sm">No matching groups</EmptyTitle>
                        <EmptyDescription className="text-xs">
                          Nothing among the loaded groups matches{" "}
                          <code className="font-mono">{query}</code>.
                          {hasMore && " Older groups may not be loaded yet — scroll to load more."}
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
                        <EmptyMedia variant="icon"><Boxes className="h-4 w-4" /></EmptyMedia>
                        <EmptyTitle className="text-sm">No groups yet</EmptyTitle>
                        <EmptyDescription className="text-xs">
                          Groups appear here once Okta pushes them, or you can create one
                          directly and seed members from the mock generator.
                        </EmptyDescription>
                      </EmptyHeader>
                      <EmptyContent className="flex-row flex-wrap justify-center gap-2">
                        <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
                          <Plus className="h-3.5 w-3.5" /> New group
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
              rows.map((g) => {
                const isSel  = selected.has(g.id);
                const isOpen = expandedId === g.id;
                return (
                  <Fragment key={g.id}>
                    <TableRow
                      data-state={isSel ? "selected" : undefined}
                      className={cn("cursor-pointer transition-colors", isSel && "bg-primary/5 hover:bg-primary/10")}
                      onClick={() => setExpandedId(isOpen ? null : g.id)}
                    >
                      <TableCell className="pl-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSel}
                          onCheckedChange={() => toggleOne(g.id)}
                          aria-label={`Select ${g.displayName}`}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <ChevronRight className={cn("h-4 w-4 transition-transform duration-150", isOpen && "rotate-90")} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <ResourceIcon icon={<Boxes className="h-4 w-4" />} />
                          <span className="text-sm font-medium">{g.displayName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{g.id}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="tabular-nums">{g.members?.length ?? 0}</Badge>
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                        {g.meta?.lastModified ? new Date(g.meta.lastModified).toLocaleDateString() : "—"}
                      </TableCell>
                    </TableRow>

                    {isOpen && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={6} className="border-t border-border/60 p-0">
                          <div className="px-5 py-4">
                            <GroupEditor group={g} userId={userId!} onUpdate={refresh} />
                          </div>
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
        {loadError && groups.length > 0 && (
          <p className="text-xs text-destructive">Could not load more: {loadError}</p>
        )}
        {hasMore && !isPaging && (
          <Button
            variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
            onClick={() => fetchPage(groups.length + 1, "append")}
          >
            Load {Math.min(PAGE_SIZE, total - groups.length)} more
          </Button>
        )}
        {!isLoading && (
          <p className="text-xs text-muted-foreground">
            {total === 0 ? "No groups yet" : (
              <>
                <span className="font-medium tabular-nums text-foreground">{groups.length}</span>
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
              Delete {selected.size} group{selected.size === 1 ? "" : "s"}?
            </DialogTitle>
            <DialogDescription>
              This removes {selected.size === 1 ? "the group" : "the groups"} and{" "}
              {selected.size === 1 ? "its" : "their"} memberships. The member users
              themselves are not deleted. This cannot be undone.
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
