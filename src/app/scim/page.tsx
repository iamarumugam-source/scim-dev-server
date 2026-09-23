"use client";

// ─── Dashboard ────────────────────────────────────────────────────────────────
//
// Sections: Overview, Traffic, Resources, Diagnostics, Usage.
//
// Design notes worth keeping in mind when editing:
//   • Panels state whether their numbers are EXACT (database counts) or SAMPLED
//     (derived from the most recent 1000 log entries). Keep that labelling — the
//     two are freely mixed in this response and silently conflating them is how
//     the old user-count bug went unnoticed.
//   • dailyVolume comes from exact per-day counts, NOT the log sample. Deriving a
//     time series from a recency-capped sample draws a false cliff to zero for
//     older days. See the note in statsService.
//   • Series colours live in @/components/scim/dashboard/viz and are validated
//     for contrast and colour-vision deficiency in both light and dark. Do not
//     swap in --chart-1..5: those are five steps of a single blue hue, so
//     adjacent categorical series become indistinguishable.
//
// The previous dashboard is archived, unlinked, at /scim/legacy/dashboard.

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  RefreshCw, AlertCircle, CheckCircle2, Activity, Users, KeyRound,
  Gauge, SlidersHorizontal, Globe, TicketCheck, ScrollText, ShieldCheck,
  Boxes, BadgeCheck, Crown, Inbox, Rocket, ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { LoginActivityGrid } from "@/components/scim/dashboard/login-activity-grid";
import { cn } from "@/lib/utils";
import {
  VizTokens, Section, StatTile, ProportionBar, RateMeter,
  VolumeChart, MethodChart, EndpointChart, EmptyChart,
} from "@/components/scim/dashboard/viz";

interface Stats {
  calls: {
    total: number; last7days: number; prev7days: number; weekOverWeek: number | null;
    success: number; clientErrors: number;
    serverErrors: number; redirects: number; errorRate: number;
    byMethod: Record<string, number>;
    dailyVolume: { date: string; label: string; count: number }[];
    topEndpoints: { path: string; count: number }[];
    recentErrors: { url: string; method: string; status: number; time: string }[];
  };
  users: { total: number; active: number; inactive: number };
  groups: { total: number };
  entitlements: { total: number };
  roles: { total: number };
  apiKeys: { total: number };
  pageViews: { total: number; byPage: Record<string, number> };
  rateLimit: { enabled: boolean; windowCalls: number; limit: number; rateLimitedCalls: number };
}

interface LoginActivity { timestamps: string[]; total: number }

const SAMPLED = "sampled · last 1000 log entries";
const EXACT   = "exact counts";

export default function DashboardPage() {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [stats,      setStats]      = useState<Stats | null>(null);
  const [login,      setLogin]      = useState<LoginActivity | null>(null);
  const [isLoading,  setIsLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [updatedAt,   setUpdatedAt]   = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!userId) return;
    if (silent) setRefreshing(true); else setIsLoading(true);
    setError(null);
    try {
      const [statsRes, loginRes] = await Promise.all([
        fetch(`/api/${userId}/scim/v2/stats`),
        fetch(`/api/${userId}/login-activity`),
      ]);
      if (!statsRes.ok) throw new Error(statsRes.statusText || `HTTP ${statsRes.status}`);
      setStats(await statsRes.json());
      // Login activity is supplementary — a failure here must not blank the page.
      if (loginRes.ok) setLogin(await loginRes.json());
      setUpdatedAt(new Date());
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      if (silent) toast.error(`Could not refresh: ${msg}`);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Side effects the dashboard owns. Both are writes, so they run exactly once
  // per mount — deliberately NOT inside load(), which also runs on every manual
  // refresh and on every auto-refresh tick.
  useEffect(() => {
    if (!userId) return;

    // Page-view analytics (fire-and-forget).
    fetch(`/api/${userId}/analytics`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ path: "/scim" }),
    }).catch(() => {});

    // Record the sign-in once per browser session, then re-read so the grid
    // includes the login that was just recorded.
    const SESSION_KEY = "login_tracked";
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
    fetch(`/api/${userId}/login-activity`, { method: "POST" })
      .then(() => fetch(`/api/${userId}/login-activity`))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setLogin(d))
      .catch(() => {});
  }, [userId]);

  // Opt-in polling. /stats is explicitly exempt from the tenant rate limit, so
  // this cannot throttle the tenant — but each call fans out to ~24 queries, so
  // the interval stays conservative rather than aggressive.
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => load(true), 20_000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  const c = stats?.calls;
  const errorTone = !c ? "default" : c.errorRate >= 10 ? "critical" : c.errorRate >= 2 ? "warning" : "good";
  const successRate = c && c.total > 0
    ? (c.success / Math.max(c.success + c.redirects + c.clientErrors + c.serverErrors, 1)) * 100
    : 0;
  const statusTotal = c ? c.success + c.redirects + c.clientErrors + c.serverErrors : 0;

  const pageViewRows = stats
    ? Object.entries(stats.pageViews.byPage).sort((a, b) => b[1] - a[1])
    : [];

  // A brand-new tenant has nothing to plot. Showing a grid of zeros is the most
  // common first impression and the least useful one, so swap in a path forward.
  // Page views are excluded from the test — merely opening the dashboard creates
  // one, so a genuinely empty tenant would never satisfy an all-zero check.
  const isFirstRun = Boolean(stats) && !!stats &&
    stats.calls.total === 0 &&
    stats.users.total === 0 &&
    stats.groups.total === 0 &&
    stats.entitlements.total === 0 &&
    stats.roles.total === 0;

  return (
    <motion.div
      className="viz container mx-auto space-y-7 py-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <VizTokens />

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
          <p className="text-xs text-muted-foreground">Provisioning activity for this tenant.</p>
        </div>
        <div className="flex items-center gap-3">
          {updatedAt && (
            <span className="hidden text-[11px] tabular-nums text-muted-foreground sm:inline">
              Updated {updatedAt.toLocaleTimeString()}
            </span>
          )}
          <div className="flex items-center gap-2">
            <Switch
              id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh}
              aria-label="Auto-refresh every 20 seconds"
            />
            <Label htmlFor="auto-refresh" className="text-[11px] text-muted-foreground">
              Auto 20s
            </Label>
          </div>
          <Button variant="outline" size="sm" className="h-8 gap-1.5"
                  onClick={() => load(true)} disabled={refreshing || isLoading}>
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {error && !stats && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not load dashboard</AlertTitle>
          <AlertDescription>
            {error}
            <Button variant="outline" size="sm" className="mt-2 h-7 w-fit text-xs" onClick={() => load()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <DashboardSkeleton />
      ) : !stats ? null : isFirstRun ? (
        <FirstRun hasKeys={stats.apiKeys.total > 0} />
      ) : (
        <>
          {/* ─── Overview ──────────────────────────────────────────────── */}
          <Section title="Overview" hint={EXACT}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label="Total API calls" value={stats.calls.total} icon={<Activity className="h-4 w-4" />}
                sub={<>{stats.calls.last7days.toLocaleString()} in the last 7 days</>}
                spark={stats.calls.dailyVolume}
                delta={stats.calls.weekOverWeek}
                href="/scim/logs"
              />
              <StatTile
                label="Users" value={stats.users.total} icon={<Users className="h-4 w-4" />}
                sub={<>{stats.users.active.toLocaleString()} active · {stats.users.inactive.toLocaleString()} inactive</>}
                href="/scim/users"
              />
              <StatTile
                label="Success rate" value={`${successRate.toFixed(1)}%`}
                tone={successRate >= 98 ? "good" : successRate >= 90 ? "warning" : "critical"}
                icon={<CheckCircle2 className="h-4 w-4" />}
                sub={<>2xx of {statusTotal.toLocaleString()} sampled responses</>}
              />
              <StatTile
                label="Error rate" value={`${stats.calls.errorRate.toFixed(1)}%`}
                tone={errorTone} icon={<ShieldCheck className="h-4 w-4" />}
                sub="4xx + 5xx of sampled responses"
                href="/scim/logs"
              />
            </div>
          </Section>

          {/* ─── Traffic ───────────────────────────────────────────────── */}
          <Section title="Traffic">
            <div className="grid gap-3 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Daily call volume</CardTitle>
                  <CardDescription className="text-[11px]">{SAMPLED}</CardDescription>
                  <CardAction><ScrollText className="h-4 w-4 text-muted-foreground" /></CardAction>
                </CardHeader>
                <CardContent>
                  <VolumeChart data={stats.calls.dailyVolume} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Rate limit</CardTitle>
                  <CardDescription className="text-[11px]">live · per tenant</CardDescription>
                  <CardAction><Gauge className="h-4 w-4 text-muted-foreground" /></CardAction>
                </CardHeader>
                <CardContent>
                  <RateMeter
                    used={stats.rateLimit.windowCalls}
                    limit={stats.rateLimit.limit}
                    enabled={stats.rateLimit.enabled}
                    throttled={stats.rateLimit.rateLimitedCalls}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Response classes</CardTitle>
                  <CardDescription className="text-[11px]">{SAMPLED}</CardDescription>
                  <CardAction><CheckCircle2 className="h-4 w-4 text-muted-foreground" /></CardAction>
                </CardHeader>
                <CardContent>
                  {/* Status palette — reserved roles, each named in the legend so
                      meaning never rests on colour alone. */}
                  <ProportionBar
                    total={statusTotal}
                    segments={[
                      { label: "2xx success",  value: stats.calls.success,      color: "var(--status-good)" },
                      { label: "3xx redirect", value: stats.calls.redirects,    color: "var(--status-warning)" },
                      { label: "4xx client",   value: stats.calls.clientErrors, color: "var(--status-serious)" },
                      { label: "5xx server",   value: stats.calls.serverErrors, color: "var(--status-critical)" },
                    ]}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">By HTTP method</CardTitle>
                  <CardDescription className="text-[11px]">{SAMPLED}</CardDescription>
                  <CardAction><SlidersHorizontal className="h-4 w-4 text-muted-foreground" /></CardAction>
                </CardHeader>
                <CardContent>
                  <MethodChart
                    data={Object.entries(stats.calls.byMethod)
                      .sort((a, b) => b[1] - a[1])
                      .map(([label, value]) => ({ label, value }))}
                  />
                </CardContent>
              </Card>
            </div>
          </Section>

          {/* ─── Resources ─────────────────────────────────────────────── */}
          <Section title="Resources" hint={EXACT}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Groups"       value={stats.groups.total}       icon={<Boxes className="h-4 w-4" />} href="/scim/groups" />
              <StatTile label="Entitlements" value={stats.entitlements.total} icon={<BadgeCheck className="h-4 w-4" />} href="/scim/entitlements" />
              <StatTile label="Roles"        value={stats.roles.total}        icon={<Crown className="h-4 w-4" />} href="/scim/roles" />
              <StatTile
                label="API keys" value={stats.apiKeys.total} icon={<KeyRound className="h-4 w-4" />}
                tone={stats.apiKeys.total === 0 ? "warning" : "default"}
                sub={stats.apiKeys.total === 0 ? "None — Okta cannot connect yet" : "Active credentials"}
                href="/scim/keys"
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">User status</CardTitle>
                <CardDescription className="text-[11px]">{EXACT}</CardDescription>
                <CardAction><Users className="h-4 w-4 text-muted-foreground" /></CardAction>
              </CardHeader>
              <CardContent>
                {stats.users.total === 0 ? (
                  <EmptyChart
                    title="No users yet" media={<Users className="h-4 w-4" />}
                    hint="Provision a user from Okta, or seed the tenant with mock data."
                  />
                ) : (
                  <ProportionBar
                    total={stats.users.total}
                    segments={[
                      { label: "Active",   value: stats.users.active,   color: "var(--status-good)" },
                      { label: "Inactive", value: stats.users.inactive, color: "var(--inactive)" },
                    ]}
                  />
                )}
              </CardContent>
            </Card>
          </Section>

          {/* ─── Diagnostics ───────────────────────────────────────────── */}
          <Section title="Diagnostics" hint={SAMPLED}>
            <div className="grid gap-3 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Top endpoints</CardTitle>
                  <CardDescription className="text-[11px]">Tenant prefix collapsed to “…”</CardDescription>
                  <CardAction><Activity className="h-4 w-4 text-muted-foreground" /></CardAction>
                </CardHeader>
                <CardContent>
                  <EndpointChart
                    data={stats.calls.topEndpoints.slice(0, 8).map((e) => ({
                      // The tenant id is identical on every row and eats the width.
                      label: e.path.replace(/^\/api\/[^/]+/, "…"),
                      value: e.count,
                    }))}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Recent errors</CardTitle>
                  <CardDescription className="text-[11px]">Newest first</CardDescription>
                  <CardAction>
                    {/* The logs API takes only limit/offset — no filter param —
                        so this links to the log list rather than deep-linking to
                        the specific entry. That needs server-side filtering. */}
                    <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-[11px]">
                      <Link href="/scim/logs">Open Logs <ArrowUpRight className="h-3 w-3" /></Link>
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  {stats.calls.recentErrors.length === 0 ? (
                    <Empty className="border-0 py-8">
                      <EmptyHeader>
                        <EmptyMedia variant="icon"><CheckCircle2 className="h-4 w-4 text-[color:var(--status-good)]" /></EmptyMedia>
                        <EmptyTitle className="text-sm">No recent errors</EmptyTitle>
                        <EmptyDescription className="text-xs">
                          Nothing in the recent sample returned 4xx or 5xx.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  ) : (
                    <ul className="space-y-1.5">
                      {stats.calls.recentErrors.map((e, i) => (
                        <li key={`${e.time}-${i}`} className="flex items-center gap-2 text-[11px]">
                          <Badge
                            variant="outline" className="h-5 shrink-0 font-mono text-[10px]"
                            style={{
                              borderColor: e.status >= 500 ? "var(--status-critical)" : "var(--status-serious)",
                              color:       e.status >= 500 ? "var(--status-critical)" : "var(--status-serious)",
                            }}
                          >
                            {e.status}
                          </Badge>
                          <span className="shrink-0 font-mono text-muted-foreground">{e.method}</span>
                          <span className="truncate font-mono" title={e.url}>
                            {e.url.replace(/^https?:\/\/[^/]+/, "").replace(/^\/api\/[^/]+/, "…")}
                          </span>
                          <span className="ml-auto shrink-0 text-muted-foreground">
                            {new Date(e.time).toLocaleTimeString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </Section>

          {/* ─── Usage ─────────────────────────────────────────────────── */}
          <Section title="Usage" hint="dashboard, not SCIM traffic">
            <div className="grid gap-3 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Page views</CardTitle>
                  <CardDescription className="text-[11px]">
                    {stats.pageViews.total.toLocaleString()} total across {pageViewRows.length} page
                    {pageViewRows.length === 1 ? "" : "s"}
                  </CardDescription>
                  <CardAction><Globe className="h-4 w-4 text-muted-foreground" /></CardAction>
                </CardHeader>
                <CardContent>
                  {pageViewRows.length === 0 ? (
                    <EmptyChart
                      title="No page views recorded" media={<Inbox className="h-4 w-4" />}
                      hint="Views accumulate as you navigate the dashboard."
                    />
                  ) : (
                    <ul className="divide-y">
                      {pageViewRows.map(([path, count]) => (
                        <li key={path} className="flex items-center justify-between gap-3 py-1.5 text-[11px]">
                          <span className="truncate font-mono text-muted-foreground" title={path}>{path}</span>
                          <span className="shrink-0 font-medium tabular-nums">{count.toLocaleString()}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Login activity</CardTitle>
                  <CardDescription className="text-[11px]">Sign-in history over the past year</CardDescription>
                  <CardAction><TicketCheck className="h-4 w-4 text-muted-foreground" /></CardAction>
                </CardHeader>
                <CardContent>
                  {!login ? (
                    <EmptyChart
                      title="No sign-in history" media={<TicketCheck className="h-4 w-4" />}
                      hint="Recorded on the shipped dashboard; this preview only reads it."
                    />
                  ) : (
                    <LoginActivityGrid timestamps={login.timestamps} total={login.total} />
                  )}
                </CardContent>
              </Card>
            </div>
          </Section>

          <Separator />

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Resource counts and total calls are <strong>exact database counts</strong>. Panels
            marked “{SAMPLED}” derive from the most recent 1000 log entries, so on a busy tenant
            they describe recent traffic rather than all time. Login activity is read-only in this
            preview — opening it does not record a sign-in.
          </p>
        </>
      )}
    </motion.div>
  );
}

// ─── First-run state ──────────────────────────────────────────────────────────
// Three concrete steps rather than a wall of zeros. The API-key step is marked
// done when one already exists, so the list reflects real progress.

function FirstRun({ hasKeys }: { hasKeys: boolean }) {
  const steps = [
    {
      title: "Create an API key",
      body:  "Okta authenticates with a bearer token. The key is shown once and stored only as a hash.",
      href:  "/scim/keys",
      cta:   "Go to API keys",
      done:  hasKeys,
    },
    {
      title: "Seed some mock data",
      body:  "Generate realistic users, groups, entitlements and roles so there is something to look at.",
      href:  "/scim/users",
      cta:   "Go to Users",
      done:  false,
    },
    {
      title: "Point Okta at this tenant",
      body:  "Use your SCIM base URL with the key as an HTTP-header credential, then Test API Credentials.",
      href:  "/scim/keys",
      cta:   "Copy base URL",
      done:  false,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Nothing here yet</CardTitle>
        <CardDescription className="text-[11px]">
          This tenant has no users, groups or recorded calls. Three steps to get going.
        </CardDescription>
        <CardAction><Rocket className="h-4 w-4 text-muted-foreground" /></CardAction>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2.5">
          {steps.map((s, i) => (
            <li key={s.title} className="flex items-start gap-3 rounded-lg border p-3">
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                  s.done
                    ? "bg-[color:var(--status-good)] text-white"
                    : "border bg-muted text-muted-foreground",
                )}
              >
                {s.done ? "✓" : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-xs font-medium", s.done && "text-muted-foreground line-through")}>
                  {s.title}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{s.body}</p>
              </div>
              <Button asChild variant={s.done ? "ghost" : "outline"} size="sm" className="h-7 shrink-0 text-xs">
                <Link href={s.href}>{s.done ? "Review" : s.cta}</Link>
              </Button>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-7">
      {[4, 3, 4].map((n, s) => (
        <div key={s} className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <div className={cn("grid gap-3", n === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "lg:grid-cols-3")}>
            {Array.from({ length: n }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-0">
                  <Skeleton className="h-2.5 w-20" />
                  <Skeleton className="mt-2 h-7 w-24" />
                </CardHeader>
                <CardContent className="pt-2"><Skeleton className="h-2.5 w-32" /></CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
