"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ScimEntitlement } from "@/lib/scim/models/scimSchemas";
import { ChevronRight, BadgeCheck, Plus, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

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
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorDisplay } from "@/components/helper-components";
import DashboardPagination from "@/components/padination-handler";
import { cn } from "@/lib/utils";
import { EntitlementEditor } from "@/components/scim/entitlement-editor";
import { usePageTracking } from "@/hooks/usePageTracking";

const MotionTableRow = motion.create(TableRow);

const ITEMS_PER_PAGE = 10;
const staggerList = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const rowVariants  = {
  hidden: { opacity: 0, x: -6 },
  show:   { opacity: 1, x: 0, transition: { duration: 0.2, ease: "easeOut" } },
};

export default function EntitlementsPage() {
  usePageTracking();
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [entitlements,   setEntitlements]   = useState<ScimEntitlement[]>([]);
  const [total,          setTotal]          = useState(0);
  const [page,           setPage]           = useState(1);
  const [isLoading,      setIsLoading]      = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [expandedId,     setExpandedId]     = useState<string | null>(null);
  const [dialogOpen,     setDialogOpen]     = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newType,        setNewType]        = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating,       setCreating]       = useState(false);

  const fetchEntitlements = useCallback(async (p = 1) => {
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
  }, [userId]);

  useEffect(() => { if (userId) fetchEntitlements(1); }, [userId, fetchEntitlements]);

  const createEntitlement = async () => {
    if (!newDisplayName.trim()) { toast.error("Display name is required."); return; }
    if (!newType.trim())        { toast.error("Type is required.");         return; }
    setCreating(true);
    try {
      const res = await fetch(`/api/${userId}/scim/v2/Entitlements`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: newDisplayName.trim(), type: newType.trim(), description: newDescription.trim() || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed to create entitlement.");
      toast.success("Entitlement created.");
      setNewDisplayName(""); setNewType(""); setNewDescription(""); setDialogOpen(false);
      fetchEntitlements(1);
    } catch (e: any) { toast.error(e.message); }
    finally { setCreating(false); }
  };

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <motion.div
      className="container mx-auto py-6 space-y-4"
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 18, mass: 0.8 }}
    >
      {error && <ErrorDisplay message={error} />}

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {isLoading ? <Skeleton className="h-3.5 w-28 inline-block" /> : total > 0 ? `${total} entitlement${total !== 1 ? "s" : ""}` : "No entitlements yet."}
        </span>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setNewDisplayName(""); setNewType(""); setNewDescription(""); } }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New Entitlement
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New Entitlement</DialogTitle>
              <DialogDescription>
                Create a new entitlement. Fields marked <span className="text-destructive">*</span> are required.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {[
                { label: "Display Name", value: newDisplayName, set: setNewDisplayName, placeholder: "e.g. Admin Access", required: true },
                { label: "Type",         value: newType,        set: setNewType,        placeholder: "e.g. role",          required: true },
                { label: "Description",  value: newDescription, set: setNewDescription, placeholder: "Optional",           required: false },
              ].map(({ label, value, set, placeholder, required }) => (
                <div key={label} className="space-y-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {label}{required && <span className="text-destructive ml-0.5">*</span>}
                  </Label>
                  <Input className="h-8 text-xs" placeholder={placeholder} value={value} onChange={(e) => set(e.target.value)} />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogOpen(false); setNewDisplayName(""); setNewType(""); setNewDescription(""); }}>Cancel</Button>
              <Button onClick={createEntitlement} disabled={creating} className="gap-1.5">
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {isLoading ? (
          <motion.div key="loading" className="overflow-hidden rounded-lg border" exit={{ opacity: 0, transition: { duration: 0.15 } }}>
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
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell />
                    <TableCell><div className="flex items-center gap-2"><Skeleton className="h-7 w-7 rounded-md" /><Skeleton className="h-4 w-36" /></div></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-20 font-mono" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            className="space-y-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
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
                <motion.tbody

                  className="[                  variants={staggerList}_tr:last-child]:border-0" variants={staggerList}
                  initial="hidden"
                  animate="show"
                >
                  {entitlements.length > 0 ? (
                    entitlements.map((e) => (
                      <Fragment key={e.id}>
                        <MotionTableRow
                          variants={rowVariants}
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
                          <TableCell><Badge variant="secondary" className="text-[11px]">{e.type}</Badge></TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground hidden sm:table-cell">{e.id.slice(0, 8)}…</TableCell>
                          <TableCell className="text-xs text-muted-foreground hidden md:table-cell max-w-[200px] truncate">
                            {e.description || <span className="text-muted-foreground/40">—</span>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                            {e.meta?.lastModified ? new Date(e.meta.lastModified).toLocaleDateString() : "—"}
                          </TableCell>
                        </MotionTableRow>
                        <AnimatePresence>
                          {expandedId === e.id && (
                            <TableRow className="bg-muted/20 hover:bg-muted/20">
                              <TableCell colSpan={6} className="p-0 border-t border-border/60">
                                <motion.div
                                  className="px-5 py-4"
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.22 }}
                                >
                                  <EntitlementEditor
                                    entitlement={e} userId={userId!}
                                    onUpdate={() => fetchEntitlements(page)}
                                    onDelete={() => { setExpandedId(null); fetchEntitlements(page); }}
                                  />
                                </motion.div>
                              </TableCell>
                            </TableRow>
                          )}
                        </AnimatePresence>
                      </Fragment>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No entitlements found. Create one above.</TableCell>
                    </TableRow>
                  )}
                </motion.tbody>
              </Table>
            </div>
            <DashboardPagination currentPage={page} totalPages={totalPages} onPageChange={fetchEntitlements} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
