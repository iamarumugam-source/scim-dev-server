"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ScimGroup } from "@/lib/scim/models/scimSchemas";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import { LoadingSpinner, ErrorDisplay } from "@/components/helper-components";
import DashboardPagination from "@/components/padination-handler";

export default function GroupsDisplay() {
  const { data: session } = useSession();
  const [groups, setGroups] = useState<ScimGroup[]>([]);
  const [isGroupsLoading, setIsGroupsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [groupPage, setGroupPage] = useState(1);
  const [totalGroups, setTotalGroups] = useState(0);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  const ITEMS_PER_PAGE = 10;
  const userId = session?.user?.id;

  const fetchGroups = useCallback(
    async (page = 1) => {
      setIsGroupsLoading(true);
      setError(null);
      try {
        const startIndex = (page - 1) * ITEMS_PER_PAGE + 1;
        const response = await fetch(
          `/api/${userId}/scim/v2/Groups?startIndex=${startIndex}&count=${ITEMS_PER_PAGE}`
        );
        if (!response.ok) {
          throw new Error(`Failed to fetch groups: ${response.statusText}`);
        }
        const groupsData = await response.json();
        setGroups(groupsData.Resources || []);
        setTotalGroups(groupsData.totalResults || 0);
        setGroupPage(page);
      } catch (e: any) {
        const errorMessage = e.message || "An unknown error occurred.";
        setError(errorMessage);
        toast.error(`Failed to fetch groups: ${errorMessage}`);
      } finally {
        setIsGroupsLoading(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    if (userId) {
      fetchGroups(1);
    }
  }, [userId, fetchGroups]);

  const toggleGroupExpansion = (groupId: string) => {
    setExpandedGroupId((prevId) => (prevId === groupId ? null : groupId));
  };

  const groupTotalPages = Math.ceil(totalGroups / ITEMS_PER_PAGE);

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-4">Groups</h1>
      {error && <ErrorDisplay message={error} />}

      {isGroupsLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Group Name</TableHead>
                  <TableHead className="w-[150px]">Members</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.length > 0 ? (
                  groups.map((group) => (
                    <Fragment key={group.id}>
                      <TableRow
                        onClick={() => toggleGroupExpansion(group.id)}
                        className="cursor-pointer"
                      >
                        <TableCell className="pl-4">
                          {expandedGroupId === group.id ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {group.displayName}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {group.members?.length || 0} Members
                          </Badge>
                        </TableCell>
                      </TableRow>
                      {expandedGroupId === group.id && (
                        <TableRow>
                          <TableCell colSpan={3} className="p-0">
                            <div className="p-4 bg-muted/50">
                              {group.members && group.members.length > 0 ? (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Username</TableHead>
                                      <TableHead>User ID</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {group.members.map((member) => (
                                      <TableRow key={member.value}>
                                        <TableCell>{member.display}</TableCell>
                                        <TableCell className="text-muted-foreground">
                                          {member.value}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              ) : (
                                <p className="text-sm text-muted-foreground px-4 py-2">
                                  No members in this group.
                                </p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center">
                      No groups found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DashboardPagination
            currentPage={groupPage}
            totalPages={groupTotalPages}
            onPageChange={fetchGroups}
          />
        </>
      )}
    </div>
  );
}
