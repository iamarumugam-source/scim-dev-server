"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ScimGroup } from "@/lib/scim/models/scimSchemas";
import { ChevronRight, Users } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ErrorDisplay } from "@/components/helper-components";
import DashboardPagination from "@/components/padination-handler";
import { LoadingScreen } from "@/components/LoadingScreen";
import { cn } from "@/lib/utils";
import { GroupEditor } from "@/components/scim/group-editor";
import { usePageTracking } from "@/hooks/usePageTracking";


// ─── Page ──────────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 10;

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

  const fetchGroups = useCallback(
    async (page = 1) => {
      if (!userId) return;
      setIsLoading(true);
      setError(null);
      try {
        const startIndex = (page - 1) * ITEMS_PER_PAGE + 1;
        const res = await fetch(
          `/api/${userId}/scim/v2/Groups?startIndex=${startIndex}&count=${ITEMS_PER_PAGE}`
        );
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
    },
    [userId]
  );

  useEffect(() => { if (userId) fetchGroups(1); }, [userId, fetchGroups]);

  const totalPages = Math.ceil(totalGroups / ITEMS_PER_PAGE);
  const from = (groupPage - 1) * ITEMS_PER_PAGE + 1;
  const to   = Math.min(groupPage * ITEMS_PER_PAGE, totalGroups);

  return (
    <div className="container mx-auto py-6 space-y-4">
      {error && <ErrorDisplay message={error} />}

      {isLoading ? (
        <LoadingScreen />
      ) : (
        <div className="space-y-3">
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
              <TableBody>
                {groups.length > 0 ? (
                  groups.map((group) => (
                    <Fragment key={group.id}>
                      <TableRow
                        onClick={() => setExpandedGroupId((p) => p === group.id ? null : group.id)}
                        className="cursor-pointer hover:bg-muted/40 transition-colors"
                      >
                        <TableCell className="pl-3 text-muted-foreground">
                          <ChevronRight
                            className={cn(
                              "h-4 w-4 transition-transform duration-150",
                              expandedGroupId === group.id && "rotate-90",
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-muted">
                              <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <span className="font-medium text-sm">{group.displayName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {group.id}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="tabular-nums">
                            {group.members?.length ?? 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                          {group.meta?.lastModified
                            ? new Date(group.meta.lastModified).toLocaleDateString()
                            : "—"}
                        </TableCell>
                      </TableRow>

                      {expandedGroupId === group.id && (
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableCell colSpan={5} className="p-0 border-t border-border/60">
                            <div className="px-5 py-4">
                              <GroupEditor group={group} userId={userId!} onUpdate={() => fetchGroups(groupPage)} />
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No groups found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <DashboardPagination
            currentPage={groupPage}
            totalPages={totalPages}
            onPageChange={fetchGroups}
          />
        </div>
      )}
    </div>
  );
}
