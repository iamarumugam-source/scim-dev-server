"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ScimUser, ScimGroup } from "@/lib/scim/models/scimSchemas";
import { Badge } from "@/components/ui/badge";
import { Toaster, toast } from "sonner";
import { ChevronDown, ChevronRight } from "lucide-react";
import { LoadingSpinner, ErrorDisplay } from "@/components/helper-components";
import DashboardPagination from "@/components/padination-handler";
import LogViewer from "@/components/log-viewer";

export default function ScimDashboard() {
  const [users, setUsers] = useState<ScimUser[]>([]);
  const [groups, setGroups] = useState<ScimGroup[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(true);
  const [isGroupsLoading, setIsGroupsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [userPage, setUserPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [groupPage, setGroupPage] = useState(1);
  const [totalGroups, setTotalGroups] = useState(0);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const ITEMS_PER_PAGE = 10;

  // --- Caching Logic ---
  const getUserCacheKey = (page: number) => `scim_users_page_${page}`;
  const getGroupCacheKey = (page: number) => `scim_groups_page_${page}`;

  const clearCache = useCallback(() => {
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith("scim_users_") || key.startsWith("scim_groups_")) {
        sessionStorage.removeItem(key);
      }
    });
    toast.info("Data cache has been cleared.");
  }, []);

  const fetchUsers = useCallback(async (page = 1) => {
    const cacheKey = getUserCacheKey(page);
    const cachedData = sessionStorage.getItem(cacheKey);

    if (cachedData) {
      const usersData = JSON.parse(cachedData);
      setUsers(usersData.Resources || []);
      setTotalUsers(usersData.totalResults || 0);
      setUserPage(page);
      setIsUsersLoading(false);
      return;
    }

    setIsUsersLoading(true);
    setError(null);
    try {
      const startIndex = (page - 1) * ITEMS_PER_PAGE + 1;
      const usersRes = await fetch(
        `/api/scim/v2/Users?startIndex=${startIndex}&count=${ITEMS_PER_PAGE}`
      );
      if (!usersRes.ok)
        throw new Error(`Failed to fetch users: ${usersRes.statusText}`);
      const usersData = await usersRes.json();

      sessionStorage.setItem(cacheKey, JSON.stringify(usersData));

      setUsers(usersData.Resources || []);
      setTotalUsers(usersData.totalResults || 0);
      setUserPage(page);
    } catch (e: any) {
      setError(e.message);
      toast.error(`Failed to fetch users: ${e.message}`);
    } finally {
      setIsUsersLoading(false);
    }
  }, []);

  const fetchGroups = useCallback(async (page = 1) => {
    const cacheKey = getGroupCacheKey(page);
    const cachedData = sessionStorage.getItem(cacheKey);

    if (cachedData) {
      const groupsData = JSON.parse(cachedData);
      setGroups(groupsData.Resources || []);
      setTotalGroups(groupsData.totalResults || 0);
      setGroupPage(page);
      setIsGroupsLoading(false);
      return;
    }

    setIsGroupsLoading(true);
    setError(null);
    try {
      const startIndex = (page - 1) * ITEMS_PER_PAGE + 1;
      const groupsRes = await fetch(
        `/api/scim/v2/Groups?startIndex=${startIndex}&count=${ITEMS_PER_PAGE}`
      );
      if (!groupsRes.ok)
        throw new Error(`Failed to fetch groups: ${groupsRes.statusText}`);
      const groupsData = await groupsRes.json();

      sessionStorage.setItem(cacheKey, JSON.stringify(groupsData));

      setGroups(groupsData.Resources || []);
      setTotalGroups(groupsData.totalResults || 0);
      setGroupPage(page);
    } catch (e: any) {
      setError(e.message);
      toast.error(`Failed to fetch groups: ${e.message}`);
    } finally {
      setIsGroupsLoading(false);
    }
  }, []);

  const handleGenerateData = useCallback(async () => {
    // Prevent multiple clicks while generating
    if (isGenerating) return;

    setIsGenerating(true);
    toast.info("Generating new sample data...");
    try {
      const res = await fetch("/api/scim/v2/generate", { method: "POST" });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "An unknown error occurred.");
      }

      clearCache();

      toast.success(
        "New data generated successfully! Fetching updated lists..."
      );
      // Refetch data for both tabs to ensure UI is up to date
      await Promise.all([fetchUsers(1), fetchGroups(1)]);
    } catch (e: any) {
      toast.error(`Error generating data: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, clearCache, fetchUsers, fetchGroups]); // Add fetch functions as dependencies

  useEffect(() => {
    // Listen for custom events dispatched from the sidebar
    document.addEventListener("generateData", handleGenerateData);
    document.addEventListener("clearCache", clearCache);

    // Initial fetch for the first tab
    fetchUsers(1);

    // Cleanup listeners when the component unmounts to prevent memory leaks
    return () => {
      document.removeEventListener("generateData", handleGenerateData);
      document.removeEventListener("clearCache", clearCache);
    };
  }, [handleGenerateData, clearCache, fetchUsers]); // Add fetchUsers to the dependency array

  const handleTabChange = (value: string) => {
    if (value === "users") {
      fetchUsers(userPage); // Fetch the current page for users
    } else if (value === "groups") {
      fetchGroups(groupPage); // Fetch the current page for groups
    }
    // No action needed for 'logs' tab as it handles its own state
  };

  const toggleGroupExpansion = (groupId: string) => {
    setExpandedGroupId((prevId) => (prevId === groupId ? null : groupId));
  };

  const userTotalPages = Math.ceil(totalUsers / ITEMS_PER_PAGE);
  const groupTotalPages = Math.ceil(totalGroups / ITEMS_PER_PAGE);

  return (
    <>
      <Toaster richColors />
      <div className="max-w-8xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4"></div>

        {error && <ErrorDisplay message={error} />}

        <Tabs
          defaultValue="users"
          className="w-full"
          onValueChange={handleTabChange}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="groups">Groups</TabsTrigger>
          </TabsList>
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Users</CardTitle>
                <CardDescription>
                  A list of all users in the system.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isUsersLoading ? (
                  <LoadingSpinner />
                ) : (
                  <>
                    <div className="overflow-hidden rounded-lg border">
                      <Table>
                        <TableHeader className="bg-muted sticky top-0 z-10">
                          <TableRow>
                            <TableHead>Username</TableHead>
                            <TableHead>Full Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {users.length > 0 ? (
                            users.map((user) => (
                              <TableRow key={user.id}>
                                <TableCell className="font-medium">
                                  {user.userName}
                                </TableCell>
                                <TableCell>{user.name?.formatted}</TableCell>
                                <TableCell>
                                  {user.emails?.find((e) => e.primary)?.value}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    className="text-primary-foreground dark:text-foreground"
                                    variant={
                                      user.active ? "default" : "destructive"
                                    }
                                  >
                                    {user.active ? "Active" : "Inactive"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center">
                                No users found.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <DashboardPagination
                      currentPage={userPage}
                      totalPages={userTotalPages}
                      onPageChange={fetchUsers}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="groups">
            <Card>
              <CardHeader>
                <CardTitle>Groups</CardTitle>
                <CardDescription>
                  A list of all groups and their members.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isGroupsLoading ? (
                  <LoadingSpinner />
                ) : (
                  <div className="space-y-2">
                    {groups.length > 0 ? (
                      groups.map((group) => (
                        <Card key={group.id} className="overflow-hidden">
                          <CardHeader
                            className="flex flex-row items-center justify-between p-4 cursor-pointer"
                            onClick={() => toggleGroupExpansion(group.id)}
                          >
                            <div className="flex items-center gap-4">
                              {expandedGroupId === group.id ? (
                                <ChevronDown className="h-5 w-5" />
                              ) : (
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                              )}
                              <CardTitle className="text-lg">
                                {group.displayName}
                              </CardTitle>
                            </div>
                            <Badge variant="secondary">
                              {group.members?.length || 0} Members
                            </Badge>
                          </CardHeader>
                          {expandedGroupId === group.id && (
                            <CardContent className="p-4 pt-0">
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
                                        <TableCell className="text-gray-500">
                                          {member.value}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              ) : (
                                <p className="text-sm text-gray-500 px-4 py-2">
                                  No members in this group.
                                </p>
                              )}
                            </CardContent>
                          )}
                        </Card>
                      ))
                    ) : (
                      <p className="text-center text-gray-500 py-4">
                        No groups found.
                      </p>
                    )}
                    <DashboardPagination
                      currentPage={groupPage}
                      totalPages={groupTotalPages}
                      onPageChange={fetchGroups}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        <div className="mt-5">
          <LogViewer />
        </div>
      </div>
    </>
  );
}
