"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  UsersRound,
  Boxes,
  KeyRound,
  BadgeCheck,
  Crown,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  Activity,
  Globe,
  RefreshCw,
  SlidersHorizontal,
  Gauge,
  Timer,
  TicketCheck,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
  type Variants,
} from "motion/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MetricRow } from "@/components/scim/dashboard/metric-row";
import { LoginActivityGrid } from "@/components/scim/dashboard/login-activity-grid";
import { ActivityChart } from "@/components/scim/dashboard/activity-chart";
import { MethodChart } from "@/components/scim/dashboard/method-chart";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DailyVolume {
  date: string;
  label: string;
  count: number;
}
interface TopEndpoint {
  path: string;
  count: number;
}
interface LoginActivity {
  timestamps: string[];
  total:      number;
}

interface RecentError {
  url: string;
  method: string;
  status: number;
  time: string;
}

interface Stats {
  calls: {
    total: number;
    last7days: number;
    success: number;
    clientErrors: number;
    serverErrors: number;
    redirects: number;
    errorRate: number;
    byMethod: Record<string, number>;
    dailyVolume: DailyVolume[];
    topEndpoints: TopEndpoint[];
    recentErrors: RecentError[];
  };
  users: { total: number; active: number; inactive: number };
  groups: { total: number };
  entitlements: { total: number };
  roles: { total: number };
  apiKeys: { total: number };
  pageViews: { total: number; byPage: Record<string, number> };
  rateLimit: { enabled: boolean; windowCalls: number; limit: number; rateLimitedCalls: number };
}

// ─── Animation variants ───────────────────────────────────────────────────────

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
  },
};

const staggerGrid: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const staggerList: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const slideInRow: Variants = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { duration: 0.22, ease: "easeOut" } },
};

// ─── Count-up number ──────────────────────────────────────────────────────────

function CountUp({ value }: { value: number }) {
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 60, damping: 14 });
  const display = useTransform(spring, (v) => Math.round(v).toLocaleString());
  const hasFired = useRef(false);

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

  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loginActivity, setLoginActivity] = useState<LoginActivity | null>(null);

  const fetchStats = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }
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

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (!userId) return;

    // Page-view analytics (fire-and-forget)
    fetch(`/api/${userId}/analytics`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ path: "/scim" }),
    }).catch(() => {});

    // Login activity: record the event first (once per browser session), then
    // fetch so the grid always includes the just-recorded login.
    const SESSION_KEY = "login_tracked";
    const fetchActivity = () =>
      fetch(`/api/${userId}/login-activity`)
        .then((r) => r.json())
        .then(setLoginActivity)
        .catch(() => {});

    if (!sessionStorage.getItem(SESSION_KEY)) {
      sessionStorage.setItem(SESSION_KEY, "1");
      fetch(`/api/${userId}/login-activity`, { method: "POST" })
        .finally(fetchActivity);
    } else {
      fetchActivity();
    }
  }, [userId]);

  const calls = stats?.calls;
  const totalCalls = calls?.total ?? 0;
  const successRate =
    totalCalls > 0
      ? Math.round(
          ((calls?.success ?? 0) /
            Math.min(totalCalls, (calls as any)?.recentSample ?? totalCalls)) *
            100,
        )
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
          {/* <SectionLabel>Overview</SectionLabel> */}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStats}
            disabled={isLoading}
            className="ml-auto gap-1.5"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isLoading && "animate-spin")}
            />
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
            {
              label: "Provisioned Users",
              href: "/scim/users",
              icon: UsersRound,
              value: stats?.users.total ?? null,
            },
            {
              label: "Groups",
              href: "/scim/groups",
              icon: Boxes,
              value: stats?.groups.total ?? null,
            },
            {
              label: "Entitlements",
              href: "/scim/entitlements",
              icon: BadgeCheck,
              value: stats?.entitlements.total ?? null,
            },
            {
              label: "Roles",
              href: "/scim/roles",
              icon: Crown,
              value: stats?.roles.total ?? null,
            },
            {
              label: "API Keys",
              href: "/scim/keys",
              icon: KeyRound,
              value: stats?.apiKeys.total ?? null,
            },
            {
              label: "Total API Calls",
              href: "/scim/logs",
              icon: Activity,
              value: stats?.calls.total ?? null,
            },
          ].map(({ label, href, icon: Icon, value }) => (
            <motion.div key={label} variants={fadeUp}>
              <Link href={href} className="group block h-full">
                <Card className="hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer h-full">
                  <CardHeader>
                    <CardDescription className="group-hover:text-primary transition-colors">
                      {label}
                    </CardDescription>
                    <CardTitle className="text-2xl font-bold tabular-nums">
                      <AnimatePresence mode="wait" initial={false}>
                        {isLoading || value === null ? (
                          <motion.div
                            key="skeleton"
                            initial={{ opacity: 1 }}
                            exit={{
                              opacity: 0,
                              transition: { duration: 0.15 },
                            }}
                          >
                            <Skeleton className="h-7 w-16" />
                          </motion.div>
                        ) : (
                          <motion.span
                            key="value"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{
                              opacity: 1,
                              y: 0,
                              transition: { duration: 0.3 },
                            }}
                          >
                            <CountUp value={value} />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </CardTitle>
                    <CardAction>
                      <Icon className="h-4 w-4 text-foreground/60" />
                    </CardAction>
                  </CardHeader>
                </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── API Health ─────────────────────────────────────────────────────── */}
      <motion.section
        variants={fadeUp}
        initial="hidden"
        animate="show"
        transition={{ delay: 0.3 }}
      >
        {/* <SectionLabel>API Health</SectionLabel> */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          {/* Success Rate */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Success Rate
              </CardTitle>
              <CardAction>
                <CheckCircle2 className="h-4 w-4 text-foreground/60" />
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
              <AnimatePresence mode="wait" initial={false}>
                {isLoading ? (
                  <motion.div
                    key="sk-rate"
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  >
                    <Skeleton className="h-7 w-16" />
                  </motion.div>
                ) : (
                  <motion.p
                    key="rate"
                    className={cn(
                      "text-2xl font-bold tabular-nums",
                      successRate >= 90
                        ? "text-foreground"
                        : successRate >= 70
                          ? "text-foreground/70"
                          : "text-destructive",
                    )}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                      transition: { duration: 0.3 },
                    }}
                  >
                    {successRate}%
                  </motion.p>
                )}
              </AnimatePresence>
              <AnimatePresence mode="wait" initial={false}>
                {isLoading ? (
                  <motion.div
                    key="sk"
                    className="space-y-2.5"
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  >
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
                    <MetricRow
                      label="Success (2xx)"
                      value={calls?.success ?? 0}
                      max={totalCalls}
                      color="bg-primary"
                    />
                    <MetricRow
                      label="Client errors (4xx)"
                      value={calls?.clientErrors ?? 0}
                      max={totalCalls}
                      color="bg-muted-foreground"
                    />
                    <MetricRow
                      label="Server errors (5xx)"
                      value={calls?.serverErrors ?? 0}
                      max={totalCalls}
                      color="bg-destructive"
                    />
                    <MetricRow
                      label="Redirects (3xx)"
                      value={calls?.redirects ?? 0}
                      max={totalCalls}
                      color="bg-primary/40"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence initial={false}>
                {!isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      transition: { duration: 0.3, delay: 0.15 },
                    }}
                  >
                    <Badge
                      variant="outline"
                      className={cn(
                        "w-full justify-center text-xs font-medium tabular-nums py-1.5",
                        (calls?.errorRate ?? 0) < 5
                          ? "bg-muted text-foreground/70 border-border"
                          : (calls?.errorRate ?? 0) < 20
                            ? "bg-muted text-foreground/80 border-border"
                            : "bg-destructive/10 text-destructive border-destructive/30",
                      )}
                    >
                      {calls?.errorRate ?? 0}% error rate
                    </Badge>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* By HTTP Method */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                By HTTP Method
              </CardTitle>
              <CardAction>
                <SlidersHorizontal className="h-4 w-4 text-foreground/60" />
              </CardAction>
            </CardHeader>
            <CardContent>
              <MethodChart
                byMethod={calls?.byMethod ?? {}}
                totalCalls={totalCalls}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>

          {/* Rate Limit */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Rate Limit</CardTitle>
              <CardAction>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                    <Link href="/scim/keys">Manage</Link>
                  </Button>
                  <Timer className="h-4 w-4 text-foreground/60" />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
              <AnimatePresence mode="wait" initial={false}>
                {isLoading ? (
                  <motion.div
                    key="sk-rl"
                    className="space-y-2.5"
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  >
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-2 w-full" />
                    <Skeleton className="h-4 w-24" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="rl"
                    className="space-y-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: { duration: 0.3 } }}
                  >
                    {(() => {
                      const rl      = stats?.rateLimit;
                      const enabled = rl?.enabled         ?? true;
                      const used    = rl?.windowCalls     ?? 0;
                      const limit   = rl?.limit           ?? 60;
                      const blocked = rl?.rateLimitedCalls ?? 0;

                      if (!enabled) {
                        return (
                          <>
                            <Badge
                              variant="outline"
                              className="bg-muted text-muted-foreground border-border dark:bg-white/[0.06] dark:border-white/15"
                            >
                              Disabled
                            </Badge>
                            <p className="text-xs text-muted-foreground">
                              Rate limiting is off. All requests pass through without restriction.
                            </p>
                          </>
                        );
                      }

                      const pct       = Math.min((used / limit) * 100, 100);
                      const nearLimit = used >= limit * 0.7;
                      const atLimit   = used >= limit;
                      return (
                        <>
                          <Badge
                            variant="outline"
                            className="bg-primary/10 text-primary border-primary/30 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700/50"
                          >
                            {limit} req / min
                          </Badge>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Last 60 s</span>
                              <span className="font-medium tabular-nums">
                                {used} / {limit}
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <motion.div
                                className={cn(
                                  "h-full rounded-full",
                                  atLimit   ? "bg-destructive"
                                  : nearLimit ? "bg-amber-500"
                                  : "bg-primary",
                                )}
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.6, ease: "easeOut" }}
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">429 responses</span>
                            <span className={cn(
                              "font-medium tabular-nums",
                              blocked > 0 ? "text-destructive" : "text-foreground/70",
                            )}>
                              {blocked}
                            </span>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "w-full justify-center text-xs font-medium py-1.5",
                              atLimit || blocked > 0
                                ? "bg-destructive/10 text-destructive border-destructive/30 dark:bg-destructive/20"
                                : nearLimit
                                  ? "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400 dark:border-amber-500/40"
                                  : "bg-muted text-foreground/70 border-border dark:bg-white/[0.06] dark:text-foreground/80 dark:border-white/15",
                            )}
                          >
                            {atLimit || blocked > 0 ? "Rate limited"
                              : nearLimit ? "Near limit"
                              : "Healthy"}
                          </Badge>
                        </>
                      );
                    })()}
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* User Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">User Status</CardTitle>
              <CardAction>
                <Gauge className="h-4 w-4 text-foreground/60" />
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-3">
              <AnimatePresence mode="wait" initial={false}>
                {isLoading ? (
                  <motion.div
                    key="sk"
                    className="space-y-2.5"
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  >
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
                    <MetricRow
                      label="Active"
                      value={stats?.users.active ?? 0}
                      max={stats?.users.total ?? 1}
                      color="bg-primary"
                    />
                    <MetricRow
                      label="Inactive"
                      value={stats?.users.inactive ?? 0}
                      max={stats?.users.total ?? 1}
                      color="bg-muted-foreground"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
              <Separator />
              {[
                {
                  label: "Calls last 7 days",
                  value: calls?.last7days ?? 0,
                  icon: TrendingUp,
                },
                {
                  label: "Page views",
                  value: stats?.pageViews.total ?? 0,
                  icon: Globe,
                },
              ].map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Icon className="h-3 w-3" />
                    {label}
                  </span>
                  <AnimatePresence mode="wait" initial={false}>
                    {isLoading ? (
                      <motion.div
                        key="sk"
                        exit={{ opacity: 0, transition: { duration: 0.15 } }}
                      >
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
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        transition={{ delay: 0.4 }}
      >
        <ActivityChart
          data={
            calls?.dailyVolume ??
            Array.from({ length: 7 }, (_, i) => {
              const d = new Date();
              d.setDate(d.getDate() - (6 - i));
              return {
                date: d.toISOString().split("T")[0],
                label: d.toLocaleDateString("en", { weekday: "short" }),
                count: 0,
              };
            })
          }
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
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top Endpoints</CardTitle>
            <CardAction>
              <TrendingUp className="h-4 w-4 text-foreground/60" />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            <AnimatePresence mode="wait" initial={false}>
              {isLoading ? (
                <motion.div
                  key="sk"
                  className="space-y-2"
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                >
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
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
                    const pct = Math.max(
                      (count / (calls?.topEndpoints[0]?.count ?? 1)) * 100,
                      4,
                    );
                    return (
                      <motion.div
                        key={path}
                        variants={slideInRow}
                        className="flex items-center gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[11px] font-mono text-foreground/80 truncate">
                              {path}
                            </span>
                            <span className="text-[11px] tabular-nums text-muted-foreground ml-2 flex-shrink-0">
                              {count}
                            </span>
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
                <motion.p
                  key="empty"
                  className="text-xs text-muted-foreground"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  No activity recorded yet.
                </motion.p>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent Errors</CardTitle>
            <CardAction>
              <XCircle className="h-4 w-4 text-foreground/60" />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            <AnimatePresence mode="wait" initial={false}>
              {isLoading ? (
                <motion.div
                  key="sk"
                  className="space-y-2"
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                >
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
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
                    try {
                      name = new URL(err.url).pathname;
                    } catch {}
                    return (
                      <motion.div
                        key={i}
                        variants={slideInRow}
                        className="py-1.5 flex items-start gap-2"
                      >
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-bold flex-shrink-0 mt-0.5",
                            err.status >= 500
                              ? "bg-destructive/10 text-destructive border-destructive/30"
                              : "bg-muted text-foreground/70 border-border",
                          )}
                        >
                          {err.status}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-mono text-foreground/80 truncate">
                            {name}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {err.method} ·{" "}
                            {err.time
                              ? new Date(err.time).toLocaleString()
                              : "—"}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              ) : (
                <motion.div
                  key="ok"
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <CheckCircle2 className="h-4 w-4 text-primary" />
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
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Page Views
                </CardTitle>
                <CardAction>
                  <Globe className="h-4 w-4 text-foreground/60" />
                </CardAction>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
                  {Object.entries(stats!.pageViews.byPage)
                    .sort(([, a], [, b]) => b - a)
                    .map(([path, count]) => (
                      <div
                        key={path}
                        className="flex items-center justify-between text-xs py-0.5"
                      >
                        <span className="font-mono text-muted-foreground truncate">
                          {path}
                        </span>
                        <span className="font-medium tabular-nums ml-2 flex-shrink-0">
                          {count}
                        </span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ── Login Activity ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {loginActivity && (
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.35 } }}
            exit={{ opacity: 0 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Login Activity</CardTitle>
                <CardDescription>Sign-in history over the past year</CardDescription>
                <CardAction>
                  <TicketCheck className="h-4 w-4 text-foreground/60" />
                </CardAction>
              </CardHeader>
              <CardContent>
                <LoginActivityGrid
                  timestamps={loginActivity.timestamps}
                  total={loginActivity.total}
                />
              </CardContent>
            </Card>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
