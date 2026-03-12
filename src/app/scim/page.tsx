"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, Building, KeyRound, Network, ShieldCheck } from "lucide-react";
import Link from "next/link";

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

const TOOLS = [
  {
    title: "SCIM Tool",
    href: "/scim/users",
    icon: ShieldCheck,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    description:
      "Manage SCIM 2.0 provisioning for your Okta tenant. Create and inspect users, groups, API keys, and monitor incoming provisioning requests in real time.",
    features: ["Users & Groups", "API Keys", "Request Logs"],
  },
  {
    title: "HAR Analyser",
    href: "/har-analyser",
    icon: Network,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/40",
    description:
      "Upload a HAR capture from Chrome DevTools and inspect every request. Automatically highlights OIDC flow steps, detects Okta headers, and generates ready-to-use Splunk queries.",
    features: ["OIDC Flow Detection", "Splunk Query Builder", "Waterfall View"],
  },
  {
    title: "JWE Decoder",
    href: "/jwe",
    icon: KeyRound,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    description:
      "Decode and inspect JSON Web Encryption tokens. Paste a JWE to view its header, decrypt its payload, and examine the embedded claims — all processed in your browser.",
    features: ["Header Inspection", "Payload Decryption", "Claims Viewer"],
  },
];

export default function ScimDashboard() {
  const { data: session } = useSession();
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [totalGroups, setTotalGroups] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userId = session?.user?.id;

  const fetchData = useCallback(async () => {
    if (!userId) { setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);
    try {
      const [usersRes, groupsRes] = await Promise.all([
        fetch(`/api/${userId}/scim/v2/Users?startIndex=1&count=1`),
        fetch(`/api/${userId}/scim/v2/Groups?startIndex=1&count=1`),
      ]);
      if (!usersRes.ok) throw new Error(`Failed to fetch users: ${usersRes.statusText}`);
      if (!groupsRes.ok) throw new Error(`Failed to fetch groups: ${groupsRes.statusText}`);
      const [ud, gd] = await Promise.all([usersRes.json(), groupsRes.json()]);
      setTotalUsers(ud.totalResults || 0);
      setTotalGroups(gd.totalResults || 0);
    } catch (e: any) {
      setError(e.message || "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="container mx-auto py-10 space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Okta Admin Tools</h1>
        <p className="text-muted-foreground mt-1">
          A collection of developer tools for Okta SCIM provisioning, network analysis, and token inspection.
        </p>
      </div>

      {/* Tenant stats */}
      {error ? (
        <ErrorDisplay message={error} />
      ) : (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Tenant Overview
          </h2>
          <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
            <Card className="@container/card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-secondary-foreground/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs dark:*:data-[slot=card]:bg-card">
              <CardHeader>
                <CardDescription>Total Users</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  {isLoading || totalUsers === null ? (
                    <div className="h-10 w-24 bg-muted rounded animate-pulse flex items-center justify-center">
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
                <div className="font-medium">Provisioned users for this tenant</div>
                <div className="text-muted-foreground text-xs truncate w-full">{userId}</div>
              </CardFooter>
            </Card>

            <Card className="@container/card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-secondary-foreground/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs dark:*:data-[slot=card]:bg-card">
              <CardHeader>
                <CardDescription>Total Groups</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  {isLoading || totalGroups === null ? (
                    <div className="h-10 w-24 bg-muted rounded animate-pulse flex items-center justify-center">
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
                <div className="font-medium">Groups configured in this tenant</div>
                <div className="text-muted-foreground text-xs truncate w-full">{userId}</div>
              </CardFooter>
            </Card>
          </div>
        </section>
      )}

      {/* Tools overview */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Available Tools
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {TOOLS.map((tool) => (
            <Link key={tool.title} href={tool.href} className="group block">
              <div className="h-full rounded-lg border border-border bg-card p-5 hover:border-primary/40 hover:shadow-sm transition-all space-y-4">
                <div className="flex items-start gap-3">
                  <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${tool.bg}`}>
                    <tool.icon className={`h-5 w-5 ${tool.color}`} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm group-hover:text-primary transition-colors">
                      {tool.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {tool.description}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tool.features.map((f) => (
                    <span
                      key={f}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
