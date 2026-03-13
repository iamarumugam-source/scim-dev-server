"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ScimEntitlement } from "@/lib/scim/models/scimSchemas";
import { ChevronRight, BadgeCheck, Plus, Loader2, X } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorDisplay } from "@/components/helper-components";
import DashboardPagination from "@/components/padination-handler";
import { LoadingScreen } from "@/components/LoadingScreen";
import { cn } from "@/lib/utils";
import { EntitlementEditor } from "@/components/scim/entitlement-editor";
import { usePageTracking } from "@/hooks/usePageTracking";

const ITEMS_PER_PAGE = 10;

export default function EntitlementsPage() {
  usePageTracking();
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [entitlements,       setEntitlements]       = useState<ScimEntitlement[]>([]);
  const [total,              setTotal]              = useState(0);
  const [page,               setPage]               = useState(1);
  const [isLoading,          setIsLoading]          = useState(true);
  const [error,              setError]              = useState<string | null>(null);
  const [expandedId,         setExpandedId]         = useState<string | null>(null);

  // Create form
  const [showCreate,         setShowCreate]         = useState(false);
  const [newDisplayName,     setNewDisplayName]     = useState("");
  const [newType,            setNewType]            = useState("");
  const [newDescription,     setNewDescription]     = useState("");
  const [creating,           setCreating]           = useState(false);

  const fetchEntitlements = useCallback(
    async (p = 1) => {
      if (!userId) return;
      setIsLoading(true);
      setError(null);
      try {
        const startIndex = (p - 1) * ITEMS_PER_PAGE + 1;
        const res = await fetch(`/api/${userId}/scim/v2/Entitlements?startIndex=${startIndex}&count=${ITEMS_PER_PAGE}`);
        if (!res.ok) throw new Error(`Failed to fetch entitlements: ${res.statusText}`);
        const data = await res.json();
        setEntitlements(data.Resources || []);
        setTotal(data.totalResults || 0);
        setPage(p);
      } catch (e: any) {
        const msg = e.message || "An unknown error occurred.";
        setError(msg);
        toast.error(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => { if (userId) fetchEntitlements(1); }, [userId, fetchEntitlements]);

  const createEntitlement = async () => {
    if (!newDisplayName.trim()) { toast.error("Display name is required."); return; }
    if (!newType.trim())        { toast.error("Type is required.");         return; }
    setCreating(true);
    try {
      const res = await fetch(`/api/${userId}/scim/v2/Entitlements`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          displayName: newDisplayName.trim(),
          type:        newType.trim(),
          description: newDescription.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed to create entitlement.");
      toast.success("Entitlement created.");
      setNewDisplayName("");
      setNewType("");
      setNewDescription("");
      setShowCreate(false);
      fetchEntitlements(1);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <div className="container mx-auto py-6 space-y-4">
      {error && <ErrorDisplay message={error} />}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {total > 0 ? `${total} entitlement${total !== 1 ? "s" : ""}` : "No entitlements yet."}
        </p>
        <Button size="sm" variant="outline" onClick={() => setShowCreate((p) => !p)} className="h-7 text-xs gap-1.5">
          {showCreate ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {showCreate ? "Cancel" : "New Entitlement"}
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">New Entitlement</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Display Name <span className="text-destructive">*</span>
              </label>
              <Input
                className="h-7 text-xs"
                placeholder="e.g. Admin Access"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Type <span className="text-destructive">*</span>
              </label>
              <Input
                className="h-7 text-xs"
                placeholder="e.g. role"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Description
              </label>
              <Input
                className="h-7 text-xs"
                placeholder="Optional"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                maxLength={1000}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={createEntitlement} disabled={creating} className="h-7 text-xs gap-1.5">
              {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Create
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <LoadingScreen />
      ) : (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="w-9" />
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Display Name</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Type</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide hidden sm:table-cell">ID</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide hidden md:table-cell">Description</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide hidden md:table-cell">Last Modified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entitlements.length > 0 ? (
                  entitlements.map((e) => (
                    <Fragment key={e.id}>
                      <TableRow
                        onClick={() => setExpandedId((p) => p === e.id ? null : e.id)}
                        className="cursor-pointer hover:bg-muted/40 transition-colors"
                      >
                        <TableCell className="pl-3 text-muted-foreground">
                          <ChevronRight className={cn("h-4 w-4 transition-transform duration-150", expandedId === e.id && "rotate-90")} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-muted">
                              <BadgeCheck className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <span className="font-medium text-sm">{e.displayName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[11px]">{e.type}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground hidden sm:table-cell">
                          {e.id.slice(0, 8)}…
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground hidden md:table-cell max-w-[200px] truncate">
                          {e.description || <span className="text-muted-foreground/40">—</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                          {e.meta?.lastModified ? new Date(e.meta.lastModified).toLocaleDateString() : "—"}
                        </TableCell>
                      </TableRow>

                      {expandedId === e.id && (
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableCell colSpan={6} className="p-0 border-t border-border/60">
                            <div className="px-5 py-4">
                              <EntitlementEditor
                                entitlement={e}
                                userId={userId!}
                                onUpdate={() => fetchEntitlements(page)}
                                onDelete={() => { setExpandedId(null); fetchEntitlements(page); }}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No entitlements found. Create one above.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <DashboardPagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={fetchEntitlements}
          />
        </div>
      )}
    </div>
  );
}
