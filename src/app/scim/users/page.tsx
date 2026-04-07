"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { ScimUser } from "@/lib/scim/models/scimSchemas";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "motion/react";
import { getColumns, UserExpandedRow } from "./columns";
import { DataTable } from "./data-table";
import { PaginationState } from "@tanstack/react-table";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePageTracking } from "@/hooks/usePageTracking";

export default function UsersPage() {
  usePageTracking();
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [users,      setUsers]      = useState<ScimUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [isLoading,  setIsLoading]  = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating,   setCreating]   = useState(false);
  const [newUser,    setNewUser]     = useState({ userName: "", givenName: "", familyName: "", email: "", active: true });
  const initialUser = { userName: "", givenName: "", familyName: "", email: "", active: true };

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize:  30,
  });

  const fetchUsers = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const startIndex = pagination.pageIndex * pagination.pageSize + 1;
      const res = await fetch(`/api/${userId}/scim/v2/Users?startIndex=${startIndex}&count=${pagination.pageSize}`);
      if (!res.ok) throw new Error(`Failed to fetch users: ${res.statusText}`);
      const data = await res.json();
      setUsers(data.Resources || []);
      setTotalUsers(data.totalResults || 0);
    } catch (e: any) {
      toast.error(`Failed to fetch users: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [userId, pagination]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleDeleteUser = async (userToDeleteId: string) => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/${userId}/scim/v2/Users/${userToDeleteId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || res.statusText);
      }
      toast.success("User successfully deleted.");
      fetchUsers();
    } catch (e: any) {
      toast.error(`Failed to delete user: ${e.message}`);
    }
  };

  const createUser = async () => {
    if (!newUser.userName.trim()) { toast.error("Username is required."); return; }
    if (!newUser.email.trim())    { toast.error("Email is required.");    return; }
    setCreating(true);
    try {
      const body = {
        schemas:  ["urn:ietf:params:scim:schemas:core:2.0:User"],
        userName: newUser.userName.trim(),
        name: {
          givenName:  newUser.givenName.trim()  || undefined,
          familyName: newUser.familyName.trim() || undefined,
          formatted:  [newUser.givenName, newUser.familyName].filter(Boolean).join(" ") || undefined,
        },
        emails:  [{ value: newUser.email.trim(), type: "work", primary: true }],
        active:  newUser.active,
      };
      const res = await fetch(`/api/${userId}/scim/v2/Users`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed to create user.");
      toast.success("User created.");
      setNewUser(initialUser);
      setDialogOpen(false);
      fetchUsers();
    } catch (e: any) { toast.error(e.message); }
    finally { setCreating(false); }
  };

  const pageCount = useMemo(() => Math.ceil(totalUsers / pagination.pageSize), [totalUsers, pagination.pageSize]);
  const columns   = useMemo(() => getColumns({ handleDeleteUser }), [handleDeleteUser]);

  return (
    <motion.div
      className="container mx-auto py-6 space-y-4"
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 18, mass: 0.8 }}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {isLoading
            ? <Skeleton className="h-3.5 w-24 inline-block" />
            : totalUsers > 0 ? `${totalUsers} user${totalUsers !== 1 ? "s" : ""}` : "No users yet."}
        </span>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setNewUser(initialUser); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New User</DialogTitle>
              <DialogDescription>
                Create a new provisioned user. Fields marked <span className="text-destructive">*</span> are required.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Username <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    className="h-8 text-xs font-mono"
                    placeholder="e.g. john.doe@acme.com"
                    value={newUser.userName}
                    onChange={(e) => setNewUser((p) => ({ ...p, userName: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">First Name</Label>
                  <Input className="h-8 text-xs" placeholder="John" value={newUser.givenName}  onChange={(e) => setNewUser((p) => ({ ...p, givenName:  e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Last Name</Label>
                  <Input className="h-8 text-xs" placeholder="Doe"  value={newUser.familyName} onChange={(e) => setNewUser((p) => ({ ...p, familyName: e.target.value }))} />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    className="h-8 text-xs"
                    type="email"
                    placeholder="john.doe@acme.com"
                    value={newUser.email}
                    onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") createUser(); }}
                  />
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Active</Label>
                <Switch checked={newUser.active} onCheckedChange={(v) => setNewUser((p) => ({ ...p, active: v }))} />
                <span className="text-xs text-muted-foreground">{newUser.active ? "Active" : "Inactive"}</span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogOpen(false); setNewUser(initialUser); }}>Cancel</Button>
              <Button onClick={createUser} disabled={creating} className="gap-1.5">
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {isLoading ? (
          <motion.div key="loading" className="space-y-3" exit={{ opacity: 0, transition: { duration: 0.15 } }}>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader className="bg-muted dark:bg-white/[0.04]">
                  <TableRow>
                    <TableHead className="w-9" />
                    <TableHead className="text-xs font-semibold uppercase tracking-wide">User</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide">Name</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide">Email</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide">Status</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide">Groups</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell />
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                          <div className="space-y-1.5"><Skeleton className="h-3.5 w-28" /><Skeleton className="h-2.5 w-36" /></div>
                        </div>
                      </TableCell>
                      <TableCell><div className="space-y-1"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-2.5 w-20" /></div></TableCell>
                      <TableCell><Skeleton className="h-3.5 w-36" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-14 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-8 rounded-full" /></TableCell>
                      <TableCell />
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <DataTable
              columns={columns}
              data={users}
              pageCount={pageCount}
              totalCount={totalUsers}
              pagination={pagination}
              setPagination={setPagination}
              renderExpandedRow={(user) => (
                <UserExpandedRow user={user} userId={userId!} onUpdate={fetchUsers} />
              )}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
