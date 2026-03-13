"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ScimRole } from "@/lib/scim/models/scimSchemas";
import { ChevronRight, Crown, Plus, Loader2, X } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorDisplay } from "@/components/helper-components";
import DashboardPagination from "@/components/padination-handler";
import { LoadingScreen } from "@/components/LoadingScreen";
import { cn } from "@/lib/utils";
import { RoleEditor } from "@/components/scim/role-editor";
import { usePageTracking } from "@/hooks/usePageTracking";

const ITEMS_PER_PAGE = 10;

export default function RolesPage() {
  usePageTracking();
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [roles,       setRoles]       = useState<ScimRole[]>([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [isLoading,   setIsLoading]   = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [expandedId,  setExpandedId]  = useState<string | null>(null);

  const [showCreate,    setShowCreate]    = useState(false);
  const [newName,       setNewName]       = useState("");
  const [newDesc,       setNewDesc]       = useState("");
  const [creating,      setCreating]      = useState(false);

  const fetchRoles = useCallback(async (p = 1) => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const startIndex = (p - 1) * ITEMS_PER_PAGE + 1;
      const res = await fetch(`/api/${userId}/scim/v2/Roles?startIndex=${startIndex}&count=${ITEMS_PER_PAGE}`);
      if (!res.ok) throw new Error(`Failed to fetch roles: ${res.statusText}`);
      const data = await res.json();
      setRoles(data.Resources || []);
      setTotal(data.totalResults || 0);
      setPage(p);
    } catch (e: any) {
      const msg = e.message || "An unknown error occurred.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => { if (userId) fetchRoles(1); }, [userId, fetchRoles]);

  const createRole = async () => {
    if (!newName.trim()) { toast.error("Display name is required."); return; }
    setCreating(true);
    try {
      const res = await fetch(`/api/${userId}/scim/v2/Roles`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ displayName: newName.trim(), description: newDesc.trim() || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed to create role.");
      toast.success("Role created.");
      setNewName("");
      setNewDesc("");
      setShowCreate(false);
      fetchRoles(1);
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
          {total > 0 ? `${total} role${total !== 1 ? "s" : ""}` : "No roles yet."}
        </p>
        <Button size="sm" variant="outline" onClick={() => setShowCreate((p) => !p)} className="h-7 text-xs gap-1.5">
          {showCreate ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {showCreate ? "Cancel" : "New Role"}
        </Button>
      </div>

      {showCreate && (
        <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">New Role</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Display Name <span className="text-destructive">*</span>
              </label>
              <Input className="h-7 text-xs" placeholder="e.g. Admin" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Description</label>
              <Input className="h-7 text-xs" placeholder="Optional" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} maxLength={1000} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={createRole} disabled={creating} className="h-7 text-xs gap-1.5">
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
                  <TableHead className="text-xs font-semibold uppercase tracking-wide hidden sm:table-cell">ID</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide hidden md:table-cell">Description</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide hidden md:table-cell">Last Modified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.length > 0 ? (
                  roles.map((r) => (
                    <Fragment key={r.id}>
                      <TableRow
                        onClick={() => setExpandedId((p) => p === r.id ? null : r.id)}
                        className="cursor-pointer hover:bg-muted/40 transition-colors"
                      >
                        <TableCell className="pl-3 text-muted-foreground">
                          <ChevronRight className={cn("h-4 w-4 transition-transform duration-150", expandedId === r.id && "rotate-90")} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-muted">
                              <Crown className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <span className="font-medium text-sm">{r.displayName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground hidden sm:table-cell">
                          {r.id.slice(0, 8)}…
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground hidden md:table-cell max-w-[200px] truncate">
                          {r.description || <span className="text-muted-foreground/40">—</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                          {r.meta?.lastModified ? new Date(r.meta.lastModified).toLocaleDateString() : "—"}
                        </TableCell>
                      </TableRow>

                      {expandedId === r.id && (
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableCell colSpan={5} className="p-0 border-t border-border/60">
                            <div className="px-5 py-4">
                              <RoleEditor
                                role={r}
                                userId={userId!}
                                onUpdate={() => fetchRoles(page)}
                                onDelete={() => { setExpandedId(null); fetchRoles(page); }}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No roles found. Create one above.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <DashboardPagination currentPage={page} totalPages={totalPages} onPageChange={fetchRoles} />
        </div>
      )}
    </div>
  );
}
