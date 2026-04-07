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
      users,
      totalGroups,
      totalKeys,
      analytics,
      totalEntitlements,
      totalRoles,
      settings,
    } = await statsService.getStatsData(userId);

    // ── Call stats ──────────────────────────────────────────────────────────

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    let success = 0, clientErrors = 0, serverErrors = 0, redirects = 0;
    let last7daysCalls = 0;

    const byMethod: Record<string, number> = {};
    const endpointCounts: Record<string, number> = {};

    for (const log of logs) {
      const status   = (log.response as any)?.status?.status ?? 0;
      const ts       = log.created_at ? new Date(log.created_at).getTime() : 0;
      const method   = (log.log_data as any)?.method ?? "UNKNOWN";
      const rawUrl   = (log.log_data as any)?.url ?? "";

      if (status >= 500)       serverErrors++;
      else if (status >= 400)  clientErrors++;
      else if (status >= 300)  redirects++;
      else if (status >= 200)  success++;

      if (ts >= sevenDaysAgo) last7daysCalls++;

      byMethod[method] = (byMethod[method] ?? 0) + 1;

      try {
        const path = new URL(rawUrl).pathname;
        endpointCounts[path] = (endpointCounts[path] ?? 0) + 1;
      } catch {}
    }

    const errorRate = logs.length > 0
      ? Math.round(((clientErrors + serverErrors) / logs.length) * 1000) / 10
      : 0;

    // Daily call volume — last 7 days
    const dailyVolume = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      const nextD = new Date(d);
      nextD.setDate(nextD.getDate() + 1);
      const count = logs.filter((l) => {
        const t = l.created_at ? new Date(l.created_at).getTime() : 0;
        return t >= d.getTime() && t < nextD.getTime();
      }).length;
      return {
        date:  d.toISOString().split("T")[0],
        label: d.toLocaleDateString("en", { weekday: "short" }),
        count,
      };
    });

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

    const activeUsers   = users.filter((u) => (u as any).active === true).length;
    const inactiveUsers = users.length - activeUsers;

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
        total:    users.length,
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
