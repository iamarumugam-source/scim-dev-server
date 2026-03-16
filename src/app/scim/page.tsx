"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  UsersRound, Boxes, KeyRound, BadgeCheck, Crown,
  CheckCircle2, XCircle, AlertCircle, TrendingUp, Activity,
  Globe, RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "motion/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  pageViews:    { total: number; byPage: Record<string, number> };
}

// ─── Animation variants ───────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } },
};

const staggerGrid = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.07 } },
};

const staggerList = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.05 } },
};

const slideInRow = {
  hidden: { opacity: 0, x: -8 },
  show:   { opacity: 1, x: 0, transition: { duration: 0.22, ease: "easeOut" } },
};

// ─── Count-up number ──────────────────────────────────────────────────────────

function CountUp({ value }: { value: number }) {
  const motionVal = useMotionValue(0);
  const spring    = useSpring(motionVal, { stiffness: 60, damping: 14 });
  const display   = useTransform(spring, (v) => Math.round(v).toLocaleString());
  const hasFired  = useRef(false);

  useEffect(() => {
    if (!hasFired.current) {
      hasFired.current = true;
      motionVal.set(value);
    }
  }, [motionVal, value]);

  return <motion.span>{display}</motion.span>;
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

  const calls       = stats?.calls;
  const totalCalls  = calls?.total ?? 0;
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

        {/* Cards animate once on mount — skeletons are visible during the stagger */}
        <motion.div
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
          variants={staggerGrid}
          initial="hidden"
          animate="show"
        >
          {[
            { label: "Provisioned Users", href: "/scim/users",        icon: UsersRound, color: "text-blue-600 dark:text-blue-400",       value: stats?.users.total        ?? null },
            { label: "Groups",            href: "/scim/groups",       icon: Boxes,      color: "text-violet-600 dark:text-violet-400",   value: stats?.groups.total       ?? null },
            { label: "Entitlements",      href: "/scim/entitlements", icon: BadgeCheck, color: "text-emerald-600 dark:text-emerald-400", value: stats?.entitlements.total ?? null },
            { label: "Roles",             href: "/scim/roles",        icon: Crown,      color: "text-rose-600 dark:text-rose-400",       value: stats?.roles.total        ?? null },
            { label: "API Keys",          href: "/scim/keys",         icon: KeyRound,   color: "text-amber-600 dark:text-amber-400",     value: stats?.apiKeys.total      ?? null },
            { label: "Total API Calls",   href: "/scim/logs",         icon: Activity,   color: "text-teal-600 dark:text-teal-400",       value: stats?.calls.total        ?? null },
          ].map(({ label, href, icon: Icon, color, value }) => (
            <motion.div key={label} variants={fadeUp}>
              <Link href={href} className="group block h-full">
                <Card className="hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer h-full">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium group-hover:text-primary transition-colors">
                      {label}
                    </CardTitle>
                    <Icon className={cn("h-4 w-4 flex-shrink-0", color)} />
                  </CardHeader>
                  <CardContent>
                    {/* AnimatePresence crossfades skeleton → value without a flash */}
                    <AnimatePresence mode="wait" initial={false}>
                      {isLoading || value === null ? (
                        <motion.div
                          key="skeleton"
                          initial={{ opacity: 1 }}
                          exit={{ opacity: 0, transition: { duration: 0.15 } }}
                        >
                          <Skeleton className="h-7 w-16" />
                        </motion.div>
                      ) : (
                        <motion.p
                          key="value"
                          className="text-2xl font-bold tabular-nums"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0, transition: { duration: 0.3 } }}
                        >
                          <CountUp value={value} />
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── API Health ─────────────────────────────────────────────────────── */}
      <motion.section variants={fadeUp} initial="hidden" animate="show" transition={{ delay: 0.3 }}>
        <SectionLabel>API Health</SectionLabel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Success Rate</p>
                <AnimatePresence mode="wait" initial={false}>
                  {!isLoading && (
                    <motion.span
                      key="rate"
                      className={cn(
                        "text-xl font-bold tabular-nums",
                        successRate >= 90 ? "text-green-600 dark:text-green-400"
                        : successRate >= 70 ? "text-amber-600 dark:text-amber-400"
                        : "text-red-600 dark:text-red-400",
                      )}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1, transition: { duration: 0.3 } }}
                    >
                      {successRate}%
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <AnimatePresence mode="wait" initial={false}>
                {isLoading ? (
                  <motion.div key="sk" className="space-y-2.5" exit={{ opacity: 0, transition: { duration: 0.15 } }}>
                    <Skeleton className="h-2 w-full" />
                    <Skeleton className="h-2 w-full" />
                    <Skeleton className="h-2 w-full" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="rows"
                    className="space-y-2.5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: { duration: 0.3 } }}
                  >
                    <MetricRow label="Success (2xx)"       value={calls?.success      ?? 0} max={totalCalls} color="bg-green-500" />
                    <MetricRow label="Client errors (4xx)" value={calls?.clientErrors ?? 0} max={totalCalls} color="bg-amber-500" />
                    <MetricRow label="Server errors (5xx)" value={calls?.serverErrors ?? 0} max={totalCalls} color="bg-red-500" />
                    <MetricRow label="Redirects (3xx)"     value={calls?.redirects    ?? 0} max={totalCalls} color="bg-blue-400" />
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence initial={false}>
                {!isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.3, delay: 0.15 } }}
                  >
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
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">By HTTP Method</p>
              <MethodChart byMethod={calls?.byMethod ?? {}} totalCalls={totalCalls} isLoading={isLoading} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">User Status</p>
              <AnimatePresence mode="wait" initial={false}>
                {isLoading ? (
                  <motion.div key="sk" className="space-y-2.5" exit={{ opacity: 0, transition: { duration: 0.15 } }}>
                    <Skeleton className="h-2 w-full" />
                    <Skeleton className="h-2 w-full" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="rows"
                    className="space-y-2.5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: { duration: 0.3 } }}
                  >
                    <MetricRow label="Active"   value={stats?.users.active   ?? 0} max={stats?.users.total ?? 1} color="bg-green-500" />
                    <MetricRow label="Inactive" value={stats?.users.inactive ?? 0} max={stats?.users.total ?? 1} color="bg-muted-foreground" />
                  </motion.div>
                )}
              </AnimatePresence>
              <Separator />
              {[
                { label: "Calls last 7 days", value: calls?.last7days ?? 0,           icon: TrendingUp },
                { label: "Page views",         value: stats?.pageViews.total     ?? 0, icon: Globe },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Icon className="h-3 w-3" />{label}
                  </span>
                  <AnimatePresence mode="wait" initial={false}>
                    {isLoading ? (
                      <motion.div key="sk" exit={{ opacity: 0, transition: { duration: 0.15 } }}>
                        <Skeleton className="h-3 w-8" />
                      </motion.div>
                    ) : (
                      <motion.span
                        key="val"
                        className="font-medium tabular-nums"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, transition: { duration: 0.25 } }}
                      >
                        {value.toLocaleString()}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </motion.section>

      {/* ── 7-day chart ────────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ delay: 0.4 }}>
        <ActivityChart
          data={calls?.dailyVolume ?? Array.from({ length: 7 }, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - (6 - i));
            return { date: d.toISOString().split("T")[0], label: d.toLocaleDateString("en", { weekday: "short" }), count: 0 };
          })}
          isLoading={isLoading}
        />
      </motion.div>

      {/* ── Top endpoints + Recent errors ─────────────────────────────────── */}
      <motion.div
        className="grid grid-cols-1 gap-4 lg:grid-cols-2"
        variants={fadeUp}
        initial="hidden"
        animate="show"
        transition={{ delay: 0.5 }}
      >
        <Card>
          <CardContent className="p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Top Endpoints</p>
            <AnimatePresence mode="wait" initial={false}>
              {isLoading ? (
                <motion.div key="sk" className="space-y-2" exit={{ opacity: 0, transition: { duration: 0.15 } }}>
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                </motion.div>
              ) : (calls?.topEndpoints ?? []).length > 0 ? (
                <motion.div
                  key="list"
                  className="space-y-1.5"
                  variants={staggerList}
                  initial="hidden"
                  animate="show"
                >
                  {(calls?.topEndpoints ?? []).map(({ path, count }) => {
                    const pct = Math.max((count / ((calls?.topEndpoints[0]?.count) ?? 1)) * 100, 4);
                    return (
                      <motion.div key={path} variants={slideInRow} className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[11px] font-mono text-foreground/80 truncate">{path}</span>
                            <span className="text-[11px] tabular-nums text-muted-foreground ml-2 flex-shrink-0">{count}</span>
                          </div>
                          <div className="h-1 rounded-full bg-muted overflow-hidden">
                            <motion.div
                              className="h-full rounded-full bg-primary/60"
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.6, ease: "easeOut" }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              ) : (
                <motion.p key="empty" className="text-xs text-muted-foreground"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  No activity recorded yet.
                </motion.p>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5 text-red-500" />
              Recent Errors
            </p>
            <AnimatePresence mode="wait" initial={false}>
              {isLoading ? (
                <motion.div key="sk" className="space-y-2" exit={{ opacity: 0, transition: { duration: 0.15 } }}>
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                </motion.div>
              ) : (calls?.recentErrors ?? []).length > 0 ? (
                <motion.div
                  key="list"
                  className="divide-y divide-border/60"
                  variants={staggerList}
                  initial="hidden"
                  animate="show"
                >
                  {(calls?.recentErrors ?? []).map((err, i) => {
                    let name = err.url;
                    try { name = new URL(err.url).pathname; } catch {}
                    return (
                      <motion.div key={i} variants={slideInRow} className="py-1.5 flex items-start gap-2">
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
                      </motion.div>
                    );
                  })}
                </motion.div>
              ) : (
                <motion.div key="ok" className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <CheckCircle2 className="h-4 w-4" />
                  No recent errors — all good!
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Page views ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {!isLoading && (stats?.pageViews.total ?? 0) > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.35 } }}
            exit={{ opacity: 0 }}
          >
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
          </motion.section>
        )}
      </AnimatePresence>

    </div>
  );
}
