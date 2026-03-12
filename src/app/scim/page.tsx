"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, Building, KeyRound, ScrollText, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ErrorDisplay } from "@/components/helper-components";
import { Spinner } from "@/components/ui/spinner";

const QUICK_LINKS = [
  {
    title: "Users",
    href: "/scim/users",
    icon: Users,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    description: "View and manage provisioned users",
  },
  {
    title: "Groups",
    href: "/scim/groups",
    icon: Building,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/40",
    description: "Inspect groups and their members",
  },
  {
    title: "API Keys",
    href: "/scim/keys",
    icon: KeyRound,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    description: "Manage SCIM bearer tokens",
  },
  {
    title: "Logs",
    href: "/scim/logs",
    icon: ScrollText,
    color: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-50 dark:bg-teal-950/40",
    description: "Inspect incoming provisioning requests",
  },
];

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
  isLoading,
}: {
  label: string;
  value: number | null;
  icon: React.ElementType;
  color: string;
  bg: string;
  isLoading: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 flex items-center gap-4">
      <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg ${bg}`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {isLoading || value === null ? (
          <div className="mt-1 flex items-center gap-2">
            <Spinner className="h-4 w-4" />
            <span className="text-sm text-muted-foreground">Loading…</span>
          </div>
        ) : (
          <p className="mt-0.5 text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
        )}
      </div>
    </div>
  );
}

export default function ScimDashboard() {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [totalUsers,  setTotalUsers]  = useState<number | null>(null);
  const [totalGroups, setTotalGroups] = useState<number | null>(null);
  const [isLoading,   setIsLoading]   = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!userId) { setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);
    try {
      const [ur, gr] = await Promise.all([
        fetch(`/api/${userId}/scim/v2/Users?startIndex=1&count=1`),
        fetch(`/api/${userId}/scim/v2/Groups?startIndex=1&count=1`),
      ]);
      if (!ur.ok) throw new Error(`Failed to fetch users: ${ur.statusText}`);
      if (!gr.ok) throw new Error(`Failed to fetch groups: ${gr.statusText}`);
      const [ud, gd] = await Promise.all([ur.json(), gr.json()]);
      setTotalUsers(ud.totalResults ?? 0);
      setTotalGroups(gd.totalResults ?? 0);
    } catch (e: any) {
      setError(e.message || "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="container mx-auto py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Overview of your SCIM provisioning tenant.{" "}
          <span className="font-mono text-xs">{userId}</span>
        </p>
      </div>

      {error ? (
        <ErrorDisplay message={error} />
      ) : (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Tenant Stats
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatCard
              label="Total Users"
              value={totalUsers}
              icon={Users}
              color="text-blue-600 dark:text-blue-400"
              bg="bg-blue-50 dark:bg-blue-950/40"
              isLoading={isLoading}
            />
            <StatCard
              label="Total Groups"
              value={totalGroups}
              icon={Building}
              color="text-violet-600 dark:text-violet-400"
              bg="bg-violet-50 dark:bg-violet-950/40"
              isLoading={isLoading}
            />
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Quick Access
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_LINKS.map((link) => (
            <Link key={link.title} href={link.href} className="group">
              <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md ${link.bg}`}>
                    <link.icon className={`h-4 w-4 ${link.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium group-hover:text-primary transition-colors">
                      {link.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {link.description}
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0 ml-2" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
