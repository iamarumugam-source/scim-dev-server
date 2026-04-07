"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ScimGroup } from "@/lib/scim/models/scimSchemas";
import { ChevronRight, Boxes, Plus, Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorDisplay } from "@/components/helper-components";
import DashboardPagination from "@/components/padination-handler";
import { cn } from "@/lib/utils";
import { GroupEditor } from "@/components/scim/group-editor";
import { usePageTracking } from "@/hooks/usePageTracking";

const MotionTableRow = motion.create(TableRow);

const ITEMS_PER_PAGE = 10;

const staggerList = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const rowVariants  = {
  hidden: { opacity: 0, x: -6 },
  show:   { opacity: 1, x: 0, transition: { duration: 0.2, ease: "easeOut" } },
};

export default function GroupsPage() {
  usePageTracking();
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [groups,          setGroups]          = useState<ScimGroup[]>([]);
  const [totalGroups,     setTotalGroups]     = useState(0);
  const [groupPage,       setGroupPage]       = useState(1);
  const [isLoading,       setIsLoading]       = useState(true);
  const [error,           setError]           = useState<string | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName,    setNewName]    = useState("");
  const [creating,   setCreating]   = useState(false);

  const fetchGroups = useCallback(async (page = 1) => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const startIndex = (page - 1) * ITEMS_PER_PAGE + 1;
      const res = await fetch(`/api/${userId}/scim/v2/Groups?startIndex=${startIndex}&count=${ITEMS_PER_PAGE}`);
      if (!res.ok) throw new Error(`Failed to fetch groups: ${res.statusText}`);
      const data = await res.json();
      setGroups(data.Resources || []);
      setTotalGroups(data.totalResults || 0);
      setGroupPage(page);
    } catch (e: any) {
      const msg = e.message || "An unknown error occurred.";
      setError(msg);
      toast.error(`Failed to fetch groups: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => { if (userId) fetchGroups(1); }, [userId, fetchGroups]);

  const createGroup = async () => {
    if (!newName.trim()) { toast.error("Group name is required."); return; }
    setCreating(true);
    try {
      const res = await fetch(`/api/${userId}/scim/v2/Groups`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ displayName: newName.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed to create group.");
      toast.success("Group created.");
      setNewName(""); setDialogOpen(false);
      fetchGroups(1);
    } catch (e: any) { toast.error(e.message); }
    finally { setCreating(false); }
  };

  const totalPages = Math.ceil(totalGroups / ITEMS_PER_PAGE);

  return (
    <motion.div
      className="container mx-auto py-6 space-y-4"
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 18, mass: 0.8 }}
    >
      {error && <ErrorDisplay message={error} />}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {isLoading ? <Skeleton className="h-3.5 w-24 inline-block" /> : totalGroups > 0 ? `${totalGroups} group${totalGroups !== 1 ? "s" : ""}` : "No groups yet."}
        </span>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setNewName(""); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New Group
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>New Group</DialogTitle>
              <DialogDescription>
                Create a new provisioned group.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2 space-y-1">
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
              <Button variant="outline" onClick={() => { setDialogOpen(false); setNewName(""); }}>Cancel</Button>
              <Button onClick={createGroup} disabled={creating} className="gap-1.5">
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
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Group Name</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Group ID</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide w-28">Members</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide hidden md:table-cell">Last Modified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell />
                    <TableCell><div className="flex items-center gap-2"><Skeleton className="h-7 w-7 rounded-md" /><Skeleton className="h-4 w-32" /></div></TableCell>
                    <TableCell><Skeleton className="h-4 w-64 font-mono" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-8 rounded-full" /></TableCell>
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
                    <TableHead className="text-xs font-semibold uppercase tracking-wide">Group Name</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide">Group ID</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide w-28">Members</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide hidden md:table-cell">Last Modified</TableHead>
                  </TableRow>
                </TableHeader>
                <motion.tbody

                  className="[                  variants={staggerList}_tr:last-child]:border-0" variants={staggerList}
                  initial="hidden"
                  animate="show"
                >
                  {groups.length > 0 ? (
                    groups.map((group) => (
                      <Fragment key={group.id}>
                        <MotionTableRow
                          variants={rowVariants}
                          onClick={() => setExpandedGroupId((p) => p === group.id ? null : group.id)}
                          className="cursor-pointer hover:bg-muted/40 transition-colors"
                        >
                          <TableCell className="pl-3 text-muted-foreground">
                            <ChevronRight className={cn("h-4 w-4 transition-transform duration-150", expandedGroupId === group.id && "rotate-90")} />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-muted">
                                <Boxes className="h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                              <span className="font-medium text-sm">{group.displayName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{group.id}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="tabular-nums">{group.members?.length ?? 0}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                            {group.meta?.lastModified ? new Date(group.meta.lastModified).toLocaleDateString() : "—"}
                          </TableCell>
                        </MotionTableRow>

                        <AnimatePresence>
                          {expandedGroupId === group.id && (
                            <TableRow className="bg-muted/20 hover:bg-muted/20">
                              <TableCell colSpan={5} className="p-0 border-t border-border/60">
                                <motion.div
                                  className="px-5 py-4"
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.22 }}
                                >
                                  <GroupEditor group={group} userId={userId!} onUpdate={() => fetchGroups(groupPage)} />
                                </motion.div>
                              </TableCell>
                            </TableRow>
                          )}
                        </AnimatePresence>
                      </Fragment>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No groups found.</TableCell>
                    </TableRow>
                  )}
                </motion.tbody>
              </Table>
            </div>

            <DashboardPagination currentPage={groupPage} totalPages={totalPages} onPageChange={fetchGroups} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
