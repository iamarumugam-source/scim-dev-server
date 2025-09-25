"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, Building } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorDisplay } from "@/components/helper-components";
import { useSession } from "next-auth/react";

export default function ScimDashboard() {
  const { data: session } = useSession();
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [totalGroups, setTotalGroups] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userId = session?.user?.id!;
  const fetchData = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const usersPromise = fetch(
        `/api/${userId}/scim/v2/Users?startIndex=1&count=1`
      );
      const groupsPromise = fetch(
        `/api/${userId}/scim/v2/Groups?startIndex=1&count=1`
      );

      const [usersRes, groupsRes] = await Promise.all([
        usersPromise,
        groupsPromise,
      ]);

      if (!usersRes.ok) {
        throw new Error(`Failed to fetch users: ${usersRes.statusText}`);
      }
      if (!groupsRes.ok) {
        throw new Error(`Failed to fetch groups: ${groupsRes.statusText}`);
      }

      const usersData = await usersRes.json();
      const groupsData = await groupsRes.json();

      setTotalUsers(usersData.totalResults || 0);
      setTotalGroups(groupsData.totalResults || 0);
    } catch (e: any) {
      setError(e.message || "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [userId, fetchData]);

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Tenant Dashboard</h1>
        <p className="text-muted-foreground">
          An overview of your provisioned users and groups.
        </p>
      </div>

      {error ? (
        <ErrorDisplay message={error} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading || totalUsers === null ? (
                <div className="h-10 w-24 bg-muted rounded animate-pulse"></div>
              ) : (
                <div className="text-2xl font-bold">{totalUsers}</div>
              )}
              <p className="text-xs text-muted-foreground">
                Total users provisioned in this tenant.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Groups
              </CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading || totalGroups === null ? (
                <div className="h-10 w-24 bg-muted rounded animate-pulse"></div>
              ) : (
                <div className="text-2xl font-bold">{totalGroups}</div>
              )}
              <p className="text-xs text-muted-foreground">
                Total groups configured in this tenant.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
