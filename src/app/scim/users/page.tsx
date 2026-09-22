"use client";

// ─── Users ────────────────────────────────────────────────────────────────────
//
// Server-paginated list with lazy loading, search, sorting, row selection and
// bulk actions.
//
// Two behaviours that look like bugs but are not — keep them:
//   • Search hits the SCIM filter, which supports ONLY `userName eq "…"`. Exact
//     whole-username match, no substring. The placeholder and the line under the
//     toolbar say so; if that ever changes, the server needs a `co` branch in
//     userService first.
//   • A filter matching nothing returns 404 with a SCIM error body, not an empty
//     ListResponse. That is handled as "no matches", not as an error.
//
// Status filtering and column sorting act on rows already fetched — the server
// supports neither — so the UI scopes them to what is loaded rather than
// implying a global sort.
//
// The previous page is archived, unlinked, at /scim/legacy/users.

import { useEffect, useState, useMemo, useCallback, useRef, Fragment } from "react";
import { ScimUser } from "@/lib/scim/models/scimSchemas";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import {
  Plus, Loader2, Search, X, RefreshCw, Trash2, UserX, ArrowUpDown,
  ArrowUp, ArrowDown, ChevronRight, Sparkles, Users as UsersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import {
  Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { usePageTracking } from "@/hooks/usePageTracking";
import { UserExpandedRow } from "./columns";
import { UserAvatar } from "@/components/scim/user-avatar";

const PAGE_SIZE = 30;

type SortKey = "userName" | "displayName" | "active";
type SortDir = "asc" | "desc";
type StatusFilter = "all" | "active" | "inactive";

export default function UsersPage() {
  usePageTracking();
  const { data: session } = useSession();
  const userId = session?.user?.id;

  // Lazy loading: `users` accumulates across pages instead of being replaced.
  const [users,      setUsers]      = useState<ScimUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [isLoading,  setIsLoading]  = useState(true);   // first page
  const [isPaging,   setIsPaging]   = useState(false);  // subsequent pages
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError,  setLoadError]  = useState<string | null>(null);

  const [query,       setQuery]       = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [status,  setStatus]  = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bulkBusy,    setBulkBusy]    = useState(false);

  const searchRef   = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Guards against a second fetch firing before the first resolves — the
  // IntersectionObserver can retrigger while a request is still in flight.
  const inFlight    = useRef(false);

  const hasMore = users.length < totalUsers;

  // ─── Debounce typing into the server-side filter ────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setActiveQuery(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

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

  // ─── Fetch one page ────────────────────────────────────────────────────────
  // `startIndex` is passed explicitly rather than read from state so the
  // observer callback can request the next page without a stale closure.
  const fetchPage = useCallback(async (
    startIndex: number,
    mode: "replace" | "append",
  ) => {
    if (!userId || inFlight.current) return;
    inFlight.current = true;
    if (mode === "replace") setIsLoading(true); else setIsPaging(true);
    setLoadError(null);

    try {
      const params = new URLSearchParams({
        startIndex: String(startIndex),
        count:      String(PAGE_SIZE),
      });
      // The server filter supports exactly one shape: userName eq "…".
      if (activeQuery) params.set("filter", `userName eq "${activeQuery}"`);

      const res = await fetch(`/api/${userId}/scim/v2/Users?${params}`);

      // A filter matching nothing returns 404 with a SCIM error body, not an
      // empty ListResponse. That is a legitimate "no matches", not a failure.
      if (res.status === 404 && activeQuery) {
        setUsers([]);
        setTotalUsers(0);
        return;
      }
      if (!res.ok) throw new Error(res.statusText || `HTTP ${res.status}`);

      const data  = await res.json();
      const batch = (data.Resources ?? []) as ScimUser[];
      setTotalUsers(data.totalResults ?? 0);

      setUsers((prev) => {
        if (mode === "replace") return batch;
        // De-dupe by id: rows can shift between requests if data changes
        // underneath us, which would otherwise duplicate React keys.
        const seen = new Set(prev.map((u) => u.id));
        return [...prev, ...batch.filter((u) => !seen.has(u.id))];
      });
    } catch (e) {
      const msg = (e as Error).message;
      setLoadError(msg);
      if (mode === "replace") toast.error(`Failed to load users: ${msg}`);
    } finally {
      inFlight.current = false;
      setIsLoading(false);
      setIsPaging(false);
      setIsRefreshing(false);
    }
  }, [userId, activeQuery]);

  // Reset to page one whenever the server-side query changes.
  useEffect(() => {
    setUsers([]);
    setTotalUsers(0);
    setSelected(new Set());
    setExpandedId(null);
    fetchPage(1, "replace");
  }, [fetchPage]);

  // ─── Infinite scroll ───────────────────────────────────────────────────────
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || isLoading) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !inFlight.current) {
          fetchPage(users.length + 1, "append");
        }
      },
      // Start fetching slightly before the sentinel is visible so scrolling
      // feels continuous rather than stop-start.
      { rootMargin: "240px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, isLoading, users.length, fetchPage]);

  const refresh = () => {
    setIsRefreshing(true);
    setUsers([]);
    setTotalUsers(0);
    fetchPage(1, "replace");
  };

  // Drop selections no longer on screen, so the bulk count can never claim
  // rows the user cannot see.
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(users.map((u) => u.id));
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [users]);

  // Status filter and sorting act on rows already loaded. The server supports
  // neither, so both are scoped to what has been fetched — the UI says so.
  const rows = useMemo(() => {
    let out = users;
    if (status !== "all") {
      out = out.filter((u) => (status === "active" ? u.active : !u.active));
    }
    if (sortKey) {
      const dir = sortDir === "asc" ? 1 : -1;
      out = [...out].sort((a, b) => {
        if (sortKey === "active") return ((a.active ? 1 : 0) - (b.active ? 1 : 0)) * dir;
        const av = (sortKey === "userName" ? a.userName : a.displayName ?? a.name?.formatted ?? "") || "";
        const bv = (sortKey === "userName" ? b.userName : b.displayName ?? b.name?.formatted ?? "") || "";
        return av.localeCompare(bv) * dir;
      });
    }
    return out;
  }, [users, status, sortKey, sortDir]);

  const allSelected = rows.length > 0 && rows.every((u) => selected.has(u.id));
  const isFiltered  = Boolean(activeQuery) || status !== "all";

  const toggleSort = (key: SortKey) => {
    if (sortKey !== key) { setSortKey(key); setSortDir("asc"); return; }
    if (sortDir === "asc") { setSortDir("desc"); return; }
    setSortKey(null); setSortDir("asc");
  };

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(rows.map((u) => u.id)));

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const clearFilters = () => { setQuery(""); setStatus("all"); };

  // ─── Bulk actions ──────────────────────────────────────────────────────────
  // Issued sequentially rather than with Promise.all: the tenant is rate
  // limited to 60 req/min and a parallel burst of 30 writes would trip it.

  const runBulk = async (
    kind: "delete" | "deactivate",
  ) => {
    if (!userId || selected.size === 0) return;
    setBulkBusy(true);
    const ids = [...selected];
    let ok = 0;

    for (const id of ids) {
      try {
        const res = kind === "delete"
          ? await fetch(`/api/${userId}/scim/v2/Users/${id}`, { method: "DELETE" })
          : await fetch(`/api/${userId}/scim/v2/Users/${id}`, {
              method:  "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                schemas:    ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
                Operations: [{ op: "replace", path: "active", value: false }],
              }),
            });
        if (!res.ok) throw new Error(res.statusText);
        ok++;
      } catch { /* failures counted by omission */ }
    }

    setBulkBusy(false);
    setConfirmOpen(false);
    setSelected(new Set());

    const verb = kind === "delete" ? "Deleted" : "Deactivated";
    if (ok === ids.length) toast.success(`${verb} ${ok} user${ok === 1 ? "" : "s"}.`);
    else toast.error(`${verb} ${ok} of ${ids.length} — ${ids.length - ok} failed.`);

    refresh();
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3" />
      : <ArrowDown className="h-3 w-3" />;
  };

  return (
    <motion.div
      className="container mx-auto py-6 space-y-4"
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
            placeholder="Find by exact username…"
            aria-label="Find users by exact username"
            className="font-mono text-xs"
          />
          <InputGroupAddon align="inline-end">
            {query ? (
              <InputGroupButton
                size="icon-xs" variant="ghost"
                onClick={() => setQuery("")} aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </InputGroupButton>
            ) : (
              <Kbd>⌘K</Kbd>
            )}
          </InputGroupAddon>
        </InputGroup>

        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger size="sm" className="w-[132px]" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active only</SelectItem>
            <SelectItem value="inactive">Inactive only</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline" size="sm" className="h-9 gap-1.5"
          onClick={refresh} disabled={isRefreshing || isLoading}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
        <Button size="sm" className="h-9 gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New User
        </Button>
      </div>

      {/* Honest labelling of what is server-side vs client-side. */}
      <p className="-mt-1 text-[11px] leading-relaxed text-muted-foreground">
        Search runs on the server and matches <strong>whole usernames only</strong> — the SCIM
        filter supports <code className="font-mono">userName eq</code> and nothing else.
        Status and sorting apply to the {users.length} row{users.length === 1 ? "" : "s"} loaded
        so far.
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
                <span className="text-muted-foreground"> of {rows.length} loaded</span>
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline" size="sm" className="h-7 gap-1.5 text-xs"
                  onClick={() => runBulk("deactivate")} disabled={bulkBusy}
                >
                  {bulkBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserX className="h-3 w-3" />}
                  Deactivate
                </Button>
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
                  aria-label="Select all loaded rows"
                  disabled={rows.length === 0}
                />
              </TableHead>
              <TableHead className="w-8" />
              <TableHead className="text-xs font-semibold uppercase tracking-wide">
                <button onClick={() => toggleSort("userName")} className="flex items-center gap-1.5 hover:text-foreground">
                  User <SortIcon col="userName" />
                </button>
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">
                <button onClick={() => toggleSort("displayName")} className="flex items-center gap-1.5 hover:text-foreground">
                  Name <SortIcon col="displayName" />
                </button>
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Email</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">
                <button onClick={() => toggleSort("active")} className="flex items-center gap-1.5 hover:text-foreground">
                  Status <SortIcon col="active" />
                </button>
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Groups</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  <TableCell className="pl-3"><Skeleton className="h-4 w-4 rounded" /></TableCell>
                  <TableCell />
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 flex-shrink-0 rounded-full" />
                      <div className="space-y-1.5"><Skeleton className="h-3.5 w-28" /><Skeleton className="h-2.5 w-36" /></div>
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-3.5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-3.5 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-14 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-8 rounded-full" /></TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="p-0">
                  {/* Two distinct states. Today both render "No results found",
                      which makes a too-narrow filter look like data loss. */}
                  {/* Two distinct states, on shadcn Empty. */}
                  {isFiltered ? (
                    <Empty className="border-0">
                      <EmptyHeader>
                        <EmptyMedia variant="icon"><Search className="h-4 w-4" /></EmptyMedia>
                        <EmptyTitle className="text-sm">No matching users</EmptyTitle>
                        <EmptyDescription className="text-xs">
                          {activeQuery ? (
                            <>Nothing matches the exact username{" "}
                            <code className="font-mono">{activeQuery}</code>. Partial matches
                            are not supported by the SCIM filter.</>
                          ) : (
                            <>None of the loaded users match the selected status.</>
                          )}
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
                        <EmptyMedia variant="icon"><UsersIcon className="h-4 w-4" /></EmptyMedia>
                        <EmptyTitle className="text-sm">No users yet</EmptyTitle>
                        <EmptyDescription className="text-xs">
                          Users appear here once Okta provisions them. You can also seed the
                          tenant with realistic mock data to try things out.
                        </EmptyDescription>
                      </EmptyHeader>
                      <EmptyContent className="flex-row flex-wrap justify-center gap-2">
                        <Button size="sm" className="gap-1.5">
                          <Sparkles className="h-3.5 w-3.5" /> Generate mock data
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1.5">
                          <Plus className="h-3.5 w-3.5" /> Add user
                        </Button>
                      </EmptyContent>
                    </Empty>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((u) => {
                const isSel  = selected.has(u.id);
                const isOpen = expandedId === u.id;
                const email  = u.emails?.find((e) => e.primary)?.value ?? u.emails?.[0]?.value;
                return (
                  <Fragment key={u.id}>
                    <TableRow
                      data-state={isSel ? "selected" : undefined}
                      className={cn("cursor-pointer transition-colors", isSel && "bg-primary/5 hover:bg-primary/10")}
                      onClick={() => setExpandedId(isOpen ? null : u.id)}
                    >
                      <TableCell className="pl-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSel}
                          onCheckedChange={() => toggleOne(u.id)}
                          aria-label={`Select ${u.userName}`}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <ChevronRight className={cn("h-4 w-4 transition-transform duration-150", isOpen && "rotate-90")} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <UserAvatar user={u} />
                          <div className="min-w-0">
                            <p className="truncate font-mono text-xs font-medium">{u.userName}</p>
                            <p className="truncate text-[10px] text-muted-foreground">{u.id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {u.displayName ?? u.name?.formatted ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{email ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={u.active ? "secondary" : "outline"} className="gap-1.5 text-[10px] font-medium">
                          <span className={cn("h-1.5 w-1.5 rounded-full", u.active ? "bg-green-500" : "bg-muted-foreground")} />
                          {u.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {u.groups?.length ?? 0}
                        </span>
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={7} className="border-t border-border/60 p-0">
                          <div className="px-5 py-4">
                            <UserExpandedRow user={u} userId={userId!} onUpdate={refresh} />
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}

            {/* Skeleton rows for the page currently being appended. */}
            {isPaging && Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={`pg-${i}`}>
                <TableCell className="pl-3"><Skeleton className="h-4 w-4 rounded" /></TableCell>
                <TableCell />
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 flex-shrink-0 rounded-full" />
                    <div className="space-y-1.5"><Skeleton className="h-3.5 w-28" /><Skeleton className="h-2.5 w-36" /></div>
                  </div>
                </TableCell>
                <TableCell><Skeleton className="h-3.5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-3.5 w-36" /></TableCell>
                <TableCell><Skeleton className="h-4 w-14 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-5 w-8 rounded-full" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ─── Lazy-load sentinel ──────────────────────────────────────────── */}
      {/* Observed by IntersectionObserver; also carries a manual fallback so
          keyboard-only users and failed auto-loads are not stuck. */}
      <div ref={sentinelRef} className="flex flex-col items-center gap-2 py-1">
        {loadError && users.length > 0 && (
          <p className="text-xs text-destructive">Could not load more: {loadError}</p>
        )}
        {hasMore && !isPaging && (
          <Button
            variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
            onClick={() => fetchPage(users.length + 1, "append")}
          >
            Load {Math.min(PAGE_SIZE, totalUsers - users.length)} more
          </Button>
        )}
        {!isLoading && (
          <p className="text-xs text-muted-foreground">
            {totalUsers === 0 ? (
              isFiltered ? "No matches" : "No users yet"
            ) : (
              <>
                <span className="font-medium tabular-nums text-foreground">{users.length}</span>
                {" of "}
                <span className="font-medium tabular-nums text-foreground">{totalUsers}</span>
                {" loaded"}
                {activeQuery && <> for <code className="font-mono">{activeQuery}</code></>}
                {!hasMore && totalUsers > PAGE_SIZE && " — end of list"}
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
              Delete {selected.size} user{selected.size === 1 ? "" : "s"}?
            </DialogTitle>
            <DialogDescription>
              This permanently removes {selected.size === 1 ? "this user" : "these users"} from
              the tenant. Okta will receive <code className="font-mono">404</code> for
              {selected.size === 1 ? " it" : " them"} on its next request. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={bulkBusy}>
              Cancel
            </Button>
            <Button variant="destructive" className="gap-1.5" onClick={() => runBulk("delete")} disabled={bulkBusy}>
              {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
