"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users, KeyRound, BadgeCheck, Crown,
  CheckCircle2, XCircle, AlertCircle, TrendingUp, Activity,
  Globe, RefreshCw, Layers,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MetricRow } from "@/components/scim/dashboard/metric-row";
import { ActivityChart } from "@/components/scim/dashboard/activity-chart";
import { MethodChart } from "@/components/scim/dashboard/method-chart";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DailyVolume { date: string; label: string; count: number }
interface TopEndpoint { path: string; count: number }
interface RecentError { url: string; method: string; status: number; time: string }

interface Stats {
  calls: {
    total: number; last7days: number;
    success: number; clientErrors: number; serverErrors: number; redirects: number;
    errorRate: number;
    byMethod: Record<string, number>;
    dailyVolume: DailyVolume[];
    topEndpoints: TopEndpoint[];
    recentErrors: RecentError[];
  };
  users:        { total: number; active: number; inactive: number };
  groups:       { total: number };
  entitlements: { total: number };
  roles:        { total: number };
  apiKeys:      { total: number };
  pageViews:    { total: number; last7days: number; byPage: Record<string, number> };
}


// ─── Section heading ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
      {children}
    </h2>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function ScimDashboard() {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [stats,     setStats]     = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!userId) { setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/${userId}/scim/v2/stats`);
      if (!res.ok) throw new Error(`Stats fetch failed: ${res.statusText}`);
      setStats(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/${userId}/analytics`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/scim" }),
    }).catch(() => {});
  }, [userId]);

  const calls      = stats?.calls;
  const totalCalls = calls?.total ?? 0;
  const successRate = totalCalls > 0
    ? Math.round(((calls?.success ?? 0) / Math.min(totalCalls, (calls as any)?.recentSample ?? totalCalls)) * 100)
    : 0;

  return (
    <div className="container mx-auto py-6 space-y-6">

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ── Overview ──────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <SectionLabel>Overview</SectionLabel>
            <code className="text-[11px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-border/60 -mt-3">
              {userId}
            </code>
          </div>
          <Button variant="outline" size="sm" onClick={fetchStats} disabled={isLoading} className="gap-1.5">
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Provisioned Users", href: "/scim/users",        icon: Users,      color: "text-blue-600 dark:text-blue-400",       bg: "bg-blue-50 dark:bg-blue-950/40",       value: stats?.users.total        ?? null },
            { label: "Groups",            href: "/scim/groups",       icon: Layers,     color: "text-violet-600 dark:text-violet-400",   bg: "bg-violet-50 dark:bg-violet-950/40",   value: stats?.groups.total       ?? null },
            { label: "Entitlements",      href: "/scim/entitlements", icon: BadgeCheck, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40", value: stats?.entitlements.total ?? null },
            { label: "Roles",             href: "/scim/roles",        icon: Crown,      color: "text-rose-600 dark:text-rose-400",       bg: "bg-rose-50 dark:bg-rose-950/40",       value: stats?.roles.total        ?? null },
            { label: "API Keys",          href: "/scim/keys",         icon: KeyRound,   color: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-50 dark:bg-amber-950/40",     value: stats?.apiKeys.total      ?? null },
            { label: "Total API Calls",   href: "/scim/logs",         icon: Activity,   color: "text-teal-600 dark:text-teal-400",       bg: "bg-teal-50 dark:bg-teal-950/40",       value: stats?.calls.total        ?? null },
          ].map(({ label, href, icon: Icon, color, bg, value }) => (
            <Link key={label} href={href} className="group">
              <Card className="flex items-center gap-3 p-4 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer h-full">
                <div className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg", bg)}>
                  <Icon className={cn("h-4 w-4", color)} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground group-hover:text-primary transition-colors">{label}</p>
                  {isLoading || value === null
                    ? <Skeleton className="mt-1 h-6 w-12" />
                    : <p className="text-xl font-bold tabular-nums mt-0.5">{value.toLocaleString()}</p>
                  }
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* ── API Health ─────────────────────────────────────────────────────── */}
      <section>
        <SectionLabel>API Health</SectionLabel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

          {/* Success rate */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Success Rate</p>
                {!isLoading && (
                  <span className={cn(
                    "text-xl font-bold tabular-nums",
                    successRate >= 90 ? "text-green-600 dark:text-green-400"
                    : successRate >= 70 ? "text-amber-600 dark:text-amber-400"
                    : "text-red-600 dark:text-red-400",
                  )}>
                    {successRate}%
                  </span>
                )}
              </div>
              {isLoading ? (
                <div className="space-y-2.5">
                  <Skeleton className="h-2 w-full" />
                  <Skeleton className="h-2 w-full" />
                  <Skeleton className="h-2 w-full" />
                </div>
              ) : (
                <div className="space-y-2.5">
                  <MetricRow label="Success (2xx)"       value={calls?.success      ?? 0} max={totalCalls} color="bg-green-500" />
                  <MetricRow label="Client errors (4xx)" value={calls?.clientErrors ?? 0} max={totalCalls} color="bg-amber-500" />
                  <MetricRow label="Server errors (5xx)" value={calls?.serverErrors ?? 0} max={totalCalls} color="bg-red-500" />
                  <MetricRow label="Redirects (3xx)"     value={calls?.redirects    ?? 0} max={totalCalls} color="bg-blue-400" />
                </div>
              )}
              {!isLoading && (
                <Badge
                  variant="outline"
                  className={cn(
                    "w-full justify-center text-xs font-medium tabular-nums py-1.5",
                    (calls?.errorRate ?? 0) < 5
                      ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 border-green-200 dark:border-green-800"
                      : (calls?.errorRate ?? 0) < 20
                        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                        : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border-red-200 dark:border-red-800",
                  )}
                >
                  {calls?.errorRate ?? 0}% error rate
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* Method breakdown */}
          <Card>
            <CardContent className="p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">By HTTP Method</p>
              <MethodChart
                byMethod={calls?.byMethod ?? {}}
                totalCalls={totalCalls}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>

          {/* User stats */}
          <Card>
            <CardContent className="p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">User Status</p>
              {isLoading ? (
                <div className="space-y-2.5">
                  <Skeleton className="h-2 w-full" />
                  <Skeleton className="h-2 w-full" />
                </div>
              ) : (
                <div className="space-y-2.5">
                  <MetricRow label="Active"   value={stats?.users.active   ?? 0} max={stats?.users.total ?? 1} color="bg-green-500" />
                  <MetricRow label="Inactive" value={stats?.users.inactive ?? 0} max={stats?.users.total ?? 1} color="bg-muted-foreground" />
                </div>
              )}
              <Separator />
              {[
                { label: "Calls last 7 days", value: calls?.last7days ?? 0,              icon: TrendingUp },
                { label: "Page views (7d)",   value: stats?.pageViews.last7days ?? 0,    icon: Globe },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Icon className="h-3 w-3" />{label}
                  </span>
                  {isLoading
                    ? <Skeleton className="h-3 w-8" />
                    : <span className="font-medium tabular-nums">{value.toLocaleString()}</span>
                  }
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── 7-day chart ────────────────────────────────────────────────────── */}
      <ActivityChart
        data={calls?.dailyVolume ?? Array.from({ length: 7 }, (_, i) => {
          const d = new Date(); d.setDate(d.getDate() - (6 - i));
          return { date: d.toISOString().split("T")[0], label: d.toLocaleDateString("en", { weekday: "short" }), count: 0 };
        })}
        isLoading={isLoading}
      />

      {/* ── Top endpoints + Recent errors ─────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Top Endpoints</p>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : (calls?.topEndpoints ?? []).length > 0 ? (
              <div className="space-y-1.5">
                {(calls?.topEndpoints ?? []).map(({ path, count }) => {
                  const pct = Math.max((count / ((calls?.topEndpoints[0]?.count) ?? 1)) * 100, 4);
                  return (
                    <div key={path} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[11px] font-mono text-foreground/80 truncate">{path}</span>
                          <span className="text-[11px] tabular-nums text-muted-foreground ml-2 flex-shrink-0">{count}</span>
                        </div>
                        <div className="h-1 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5 text-red-500" />
              Recent Errors
            </p>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : (calls?.recentErrors ?? []).length > 0 ? (
              <div className="divide-y divide-border/60">
                {(calls?.recentErrors ?? []).map((err, i) => {
                  let name = err.url;
                  try { name = new URL(err.url).pathname; } catch {}
                  return (
                    <div key={i} className="py-1.5 flex items-start gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-bold flex-shrink-0 mt-0.5",
                          err.status >= 500
                            ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-800"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
                        )}
                      >
                        {err.status}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-mono text-foreground/80 truncate">{name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {err.method} · {err.time ? new Date(err.time).toLocaleString() : "—"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                No recent errors — all good!
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Page views ──────────────────────────────────────────────────────── */}
      {!isLoading && (stats?.pageViews.total ?? 0) > 0 && (
        <section>
          <SectionLabel>Page Views</SectionLabel>
          <Card>
            <CardContent className="p-5">
              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
                {Object.entries(stats!.pageViews.byPage)
                  .sort(([, a], [, b]) => b - a)
                  .map(([path, count]) => (
                    <div key={path} className="flex items-center justify-between text-xs py-0.5">
                      <span className="font-mono text-muted-foreground truncate">{path}</span>
                      <span className="font-medium tabular-nums ml-2 flex-shrink-0">{count}</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

    </div>
  );
}
