"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users, Building, KeyRound, ScrollText, ArrowRight,
  CheckCircle2, XCircle, AlertCircle, TrendingUp, Activity,
  Globe, RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DailyVolume   { date: string; label: string; count: number }
interface TopEndpoint   { path: string; count: number }
interface RecentError   { url: string; method: string; status: number; time: string }

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
  users:    { total: number; active: number; inactive: number };
  groups:   { total: number };
  apiKeys:  { total: number };
  pageViews:{ total: number; last7days: number; byPage: Record<string, number> };
}

// ─── Quick links ──────────────────────────────────────────────────────────────

const QUICK_LINKS = [
  { title: "Users",    href: "/scim/users",  icon: Users,      color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-50 dark:bg-blue-950/40",   description: "View and manage provisioned users" },
  { title: "Groups",   href: "/scim/groups", icon: Building,   color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/40", description: "Inspect groups and their members" },
  { title: "API Keys", href: "/scim/keys",   icon: KeyRound,   color: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-50 dark:bg-amber-950/40",   description: "Manage SCIM bearer tokens" },
  { title: "Logs",     href: "/scim/logs",   icon: ScrollText, color: "text-teal-600 dark:text-teal-400",    bg: "bg-teal-50 dark:bg-teal-950/40",     description: "Inspect incoming provisioning requests" },
];

// ─── Method colours ───────────────────────────────────────────────────────────

const METHOD_COLOR: Record<string, string> = {
  GET:    "bg-blue-500",
  POST:   "bg-green-500",
  PUT:    "bg-amber-500",
  PATCH:  "bg-amber-500",
  DELETE: "bg-red-500",
};

// ─── Small helpers ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
      {children}
    </h2>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-5", className)}>
      {children}
    </div>
  );
}

function MetricRow({
  label, value, max, color, suffix = "",
}: {
  label: string; value: number; max: number; color: string; suffix?: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value.toLocaleString()}{suffix}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn("animate-pulse rounded bg-muted", className)} style={style} />;
}

// ─── Activity chart ───────────────────────────────────────────────────────────

function ActivityChart({ data, isLoading }: { data: DailyVolume[]; isLoading: boolean }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        API Calls — Last 7 Days
      </p>
      {isLoading ? (
        <div className="flex items-end gap-2 h-24">
          {[40, 65, 30, 80, 55, 70, 45].map((h, i) => (
            <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
          ))}
        </div>
      ) : (
        <div className="flex items-end gap-2 h-24">
          {data.map((d) => {
            const h = max > 0 ? Math.max((d.count / max) * 100, d.count > 0 ? 4 : 0) : 0;
            return (
              <div key={d.date} className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                <span className="text-[10px] tabular-nums text-muted-foreground">{d.count || ""}</span>
                <div className="w-full rounded-sm bg-primary/80 transition-all" style={{ height: `${h}%`, minHeight: d.count > 0 ? "4px" : "0" }} />
                <span className="text-[10px] text-muted-foreground truncate w-full text-center">{d.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
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

  // Record page view
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/${userId}/analytics`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ path: "/scim" }),
    }).catch(() => {});
  }, [userId]);

  const calls = stats?.calls;
  const totalCalls = calls?.total ?? 0;
  const successRate = totalCalls > 0
    ? Math.round(((calls?.success ?? 0) / Math.min(totalCalls, (calls as any)?.recentSample ?? totalCalls)) * 100)
    : 0;

  return (
    <div className="container mx-auto py-10 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            SCIM provisioning overview for{" "}
            <span className="font-mono text-xs">{userId}</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={isLoading} className="gap-1.5">
          <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Top metric cards ─────────────────────────────────────────────── */}
      <section>
        <SectionLabel>Overview</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Provisioned Users",  icon: Users,      color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-50 dark:bg-blue-950/40",   value: stats?.users.total   ?? null },
            { label: "Groups",             icon: Building,   color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/40", value: stats?.groups.total  ?? null },
            { label: "API Keys",           icon: KeyRound,   color: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-50 dark:bg-amber-950/40",   value: stats?.apiKeys.total ?? null },
            { label: "Total API Calls",    icon: Activity,   color: "text-teal-600 dark:text-teal-400",    bg: "bg-teal-50 dark:bg-teal-950/40",     value: stats?.calls.total   ?? null },
          ].map(({ label, icon: Icon, color, bg, value }) => (
            <Card key={label} className="flex items-center gap-3 p-4">
              <div className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg", bg)}>
                <Icon className={cn("h-4 w-4", color)} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                {isLoading || value === null
                  ? <Skeleton className="mt-1 h-6 w-12" />
                  : <p className="text-xl font-bold tabular-nums mt-0.5">{value.toLocaleString()}</p>
                }
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ── API Health + Activity ─────────────────────────────────────────── */}
      <section>
        <SectionLabel>API Health</SectionLabel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Success rate */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Success Rate</p>
              {!isLoading && (
                <span className={cn(
                  "text-xl font-bold tabular-nums",
                  successRate >= 90 ? "text-green-600 dark:text-green-400"
                  : successRate >= 70 ? "text-amber-600 dark:text-amber-400"
                  : "text-red-600 dark:text-red-400"
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
                <MetricRow label="Success (2xx)"      value={calls?.success      ?? 0} max={totalCalls} color="bg-green-500" />
                <MetricRow label="Client errors (4xx)" value={calls?.clientErrors ?? 0} max={totalCalls} color="bg-amber-500" />
                <MetricRow label="Server errors (5xx)" value={calls?.serverErrors ?? 0} max={totalCalls} color="bg-red-500" />
                <MetricRow label="Redirects (3xx)"     value={calls?.redirects    ?? 0} max={totalCalls} color="bg-blue-400" />
              </div>
            )}
            {!isLoading && (
              <div className={cn(
                "rounded-md px-3 py-2 text-xs font-medium",
                (calls?.errorRate ?? 0) < 5
                  ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                  : (calls?.errorRate ?? 0) < 20
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                    : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
              )}>
                {calls?.errorRate ?? 0}% error rate
                {(calls?.errorRate ?? 0) < 5 ? " — healthy" : (calls?.errorRate ?? 0) < 20 ? " — needs attention" : " — critical"}
              </div>
            )}
          </Card>

          {/* Method breakdown */}
          <Card className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">By HTTP Method</p>
            {isLoading ? (
              <div className="space-y-2.5">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
              </div>
            ) : calls?.byMethod && Object.keys(calls.byMethod).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(calls.byMethod)
                  .sort(([, a], [, b]) => b - a)
                  .map(([method, count]) => {
                    const pct = totalCalls > 0 ? (count / totalCalls) * 100 : 0;
                    return (
                      <div key={method} className="flex items-center gap-2">
                        <span className={cn("w-14 text-[10px] font-bold text-white px-1.5 py-0.5 rounded text-center flex-shrink-0", METHOD_COLOR[method] ?? "bg-gray-500")}>
                          {method}
                        </span>
                        <div className="flex-1 h-4 rounded bg-muted overflow-hidden">
                          <div
                            className={cn("h-full rounded opacity-70", METHOD_COLOR[method] ?? "bg-gray-500")}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">{count}</span>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No calls recorded yet.</p>
            )}
          </Card>

          {/* User stats */}
          <Card className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">User Status</p>
            {isLoading ? (
              <div className="space-y-2.5">
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-2 w-full" />
              </div>
            ) : (
              <div className="space-y-2.5">
                <MetricRow
                  label="Active"
                  value={stats?.users.active ?? 0}
                  max={stats?.users.total ?? 1}
                  color="bg-green-500"
                />
                <MetricRow
                  label="Inactive"
                  value={stats?.users.inactive ?? 0}
                  max={stats?.users.total ?? 1}
                  color="bg-muted-foreground"
                />
              </div>
            )}
            <div className="pt-1 border-t border-border/60 space-y-1.5">
              {[
                { label: "Calls last 7 days", value: calls?.last7days ?? 0, icon: TrendingUp },
                { label: "Page views (7d)",   value: stats?.pageViews.last7days ?? 0, icon: Globe },
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
            </div>
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

      {/* ── Bottom row: top endpoints + recent errors ───────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top endpoints */}
        <Card className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Top Endpoints
          </p>
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
        </Card>

        {/* Recent errors */}
        <Card className="space-y-3">
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
                    <span className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded text-white flex-shrink-0 mt-0.5",
                      err.status >= 500 ? "bg-red-600" : "bg-amber-500 text-black",
                    )}>
                      {err.status}
                    </span>
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
        </Card>
      </div>

      {/* ── Page views ──────────────────────────────────────────────────────── */}
      {!isLoading && stats?.pageViews.total! > 0 && (
        <section>
          <SectionLabel>Page Views</SectionLabel>
          <Card>
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
          </Card>
        </section>
      )}

      {/* ── Quick access ─────────────────────────────────────────────────── */}
      <section>
        <SectionLabel>Quick Access</SectionLabel>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_LINKS.map((link) => (
            <Link key={link.title} href={link.href} className="group">
              <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn("flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md", link.bg)}>
                    <link.icon className={cn("h-4 w-4", link.color)} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium group-hover:text-primary transition-colors">{link.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{link.description}</p>
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
