"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, Building } from "lucide-react";

import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ErrorDisplay } from "@/components/helper-components";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";

export default function ScimDashboard() {
  const { data: session } = useSession();
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [totalGroups, setTotalGroups] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userId = session?.user?.id;
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
    <div className="container mx-auto py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Tenant Dashboard</h1>
        <p className="text-muted-foreground">
          An overview of your provisioned users and groups.
        </p>
      </div>

      {error ? (
        <ErrorDisplay message={error} />
      ) : (
        <div className="*:data-[slot=card]:from-secondary-foreground/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
          <Card className="@container/card">
            <CardHeader>
              <CardDescription>Total Users</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {isLoading || totalUsers === null ? (
                  <div className="h-10 w-24 bg-muted rounded animate-pulse">
                    <Spinner />
                  </div>
                ) : (
                  <div className="text-2xl font-bold">{totalUsers}</div>
                )}
              </CardTitle>
              <CardAction>
                <Badge variant="outline">
                  <Users className="h-4 w-4 text-muted-foreground" />
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium">
                Total users provisioned for the following tenant:
              </div>
              <div className="text-muted-foreground">{userId}</div>
            </CardFooter>
          </Card>

          <Card className="@container/card">
            <CardHeader>
              <CardDescription>Total Groups</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {isLoading || totalGroups === null ? (
                  <div className="h-10 w-24 bg-muted rounded animate-pulse">
                    <Spinner />
                  </div>
                ) : (
                  <div className="text-2xl font-bold">{totalGroups}</div>
                )}
              </CardTitle>
              <CardAction>
                <Badge variant="outline">
                  <Building className="h-4 w-4 text-muted-foreground" />
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium">
                Total groups configured in this tenant:
              </div>
              <div className="text-muted-foreground">{userId}</div>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
