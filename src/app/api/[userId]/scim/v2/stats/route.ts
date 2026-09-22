import { NextRequest, NextResponse } from "next/server";
import { protectWithApiKey } from "@/lib/scim/apiHelper";
import { StatsService } from "@/lib/scim/services/statsService";

interface RouteParams {
  params: { userId: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { userId } = await params;

  const unauthorized = await protectWithApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const statsService = new StatsService();
    const {
      logs,
      totalCalls,
      totalUsers,
      activeUsers,
      dailyCounts,
      totalGroups,
      totalKeys,
      analytics,
      totalEntitlements,
      totalRoles,
      settings,
    } = await statsService.getStatsData(userId);

    // ── Call stats ──────────────────────────────────────────────────────────

    // Exact per-day counts straight from the DB. `dailyCounts` covers 14 days
    // oldest→newest: the trailing 7 are charted, the leading 7 give the
    // week-over-week comparison. Both are exact, unlike anything derived from
    // the 1000-row `logs` sample below.
    const thisWeek = dailyCounts.slice(-7);
    const prevWeek = dailyCounts.slice(0, dailyCounts.length - 7);
    const sum = (xs: { count: number }[]) => xs.reduce((a, x) => a + x.count, 0);

    const last7daysCalls = sum(thisWeek);
    const prev7daysCalls = sum(prevWeek);
    // null when there is no prior traffic to compare against — rendering "+100%"
    // off a zero baseline would be noise, not information.
    const weekOverWeek = prev7daysCalls > 0
      ? ((last7daysCalls - prev7daysCalls) / prev7daysCalls) * 100
      : null;

    const dailyVolume = thisWeek.map((d) => ({
      date:  d.date,
      label: new Date(`${d.date}T00:00:00`).toLocaleDateString("en", { weekday: "short" }),
      count: d.count,
    }));

    let success = 0, clientErrors = 0, serverErrors = 0, redirects = 0;

    const byMethod: Record<string, number> = {};
    const endpointCounts: Record<string, number> = {};

    for (const log of logs) {
      const status   = (log.response as any)?.status?.status ?? 0;
      const method   = (log.log_data as any)?.method ?? "UNKNOWN";
      const rawUrl   = (log.log_data as any)?.url ?? "";

      if (status >= 500)       serverErrors++;
      else if (status >= 400)  clientErrors++;
      else if (status >= 300)  redirects++;
      else if (status >= 200)  success++;

      byMethod[method] = (byMethod[method] ?? 0) + 1;

      try {
        const path = new URL(rawUrl).pathname;
        endpointCounts[path] = (endpointCounts[path] ?? 0) + 1;
      } catch {}
    }

    const errorRate = logs.length > 0
      ? Math.round(((clientErrors + serverErrors) / logs.length) * 1000) / 10
      : 0;

    // dailyVolume is built above from exact DB counts. It used to be derived by
    // filtering the 1000-row `logs` sample, which silently drew a cliff to zero
    // for any day older than the sample window — on a busy tenant that meant
    // most of the week reading as no traffic.

    // Top 5 endpoints by call count
    const topEndpoints = Object.entries(endpointCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([path, count]) => ({ path, count }));

    // Last 5 failed calls
    const recentErrors = logs
      .filter((l) => ((l.response as any)?.status?.status ?? 0) >= 400)
      .slice(0, 5)
      .map((l) => ({
        url:    (l.log_data as any)?.url    ?? "",
        method: (l.log_data as any)?.method ?? "",
        status: (l.response as any)?.status?.status ?? 0,
        time:   l.created_at,
      }));

    // ── User stats ──────────────────────────────────────────────────────────

    const inactiveUsers = totalUsers - activeUsers;

    // ── Rate limit window stats ─────────────────────────────────────────────

    const RATE_LIMIT_ON = settings?.rate_limit_enabled ?? true;
    const RATE_LIMIT    = settings?.rate_limit_max     ?? 60;
    const oneMinuteAgo  = Date.now() - 60_000;
    const windowCalls   = logs.filter((l) => {
      const t = l.created_at ? new Date(l.created_at).getTime() : 0;
      return t >= oneMinuteAgo;
    }).length;

    const rateLimitedCalls = logs.filter((l) => {
      const status = (l.response as any)?.status?.status ?? 0;
      return status === 429;
    }).length;

    // ── Page views ──────────────────────────────────────────────────────────

    const viewsByPage: Record<string, number> = {};
    let totalPageViews = 0;

    for (const row of analytics) {
      const path  = (row as any).path  ?? "/";
      const count = (row as any).count ?? 0;
      viewsByPage[path] = count;
      totalPageViews   += count;
    }

    return NextResponse.json({
      rateLimit: {
        enabled:         RATE_LIMIT_ON,
        windowCalls,
        limit:           RATE_LIMIT,
        rateLimitedCalls,
      },
      calls: {
        total:        totalCalls,
        recentSample: logs.length,
        last7days:    last7daysCalls,
        prev7days:    prev7daysCalls,
        weekOverWeek,
        success,
        clientErrors,
        serverErrors,
        redirects,
        errorRate,
        byMethod,
        dailyVolume,
        topEndpoints,
        recentErrors,
      },
      users: {
        total:    totalUsers,
        active:   activeUsers,
        inactive: inactiveUsers,
      },
      groups:       { total: totalGroups },
      entitlements: { total: totalEntitlements },
      roles:        { total: totalRoles },
      apiKeys:      { total: totalKeys },
      pageViews: {
        total:  totalPageViews,
        byPage: viewsByPage,
      },
    });
  } catch (error: any) {
    console.error("Stats API error:", error);
    return NextResponse.json({ detail: "Internal Server Error" }, { status: 500 });
  }
}
