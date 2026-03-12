import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/scim/db";
import { protectWithApiKey } from "@/lib/scim/apiHelper";

interface RouteParams {
  params: { userId: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { userId } = await params;

  const unauthorized = await protectWithApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const [
      logsRecent,
      logsTotalResult,
      usersResult,
      groupsResult,
      keysResult,
      analyticsResult,
    ] = await Promise.all([
      // Recent 1 000 logs for computing detailed stats
      supabase
        .from("scim_logs")
        .select("log_data, response, created_at")
        .eq("tenantId", userId)
        .order("created_at", { ascending: false })
        .limit(1000),

      // All-time total call count (cheap head query)
      supabase
        .from("scim_logs")
        .select("id", { count: "exact", head: true })
        .eq("tenantId", userId),

      // Users — total + active/inactive split
      supabase
        .from("scim_users")
        .select("active")
        .eq("tenantId", userId),

      // Groups — total count
      supabase
        .from("scim_groups")
        .select("id", { count: "exact", head: true })
        .eq("tenantId", userId),

      // API keys — total count
      supabase
        .from("api_keys")
        .select("id", { count: "exact", head: true })
        .eq("tenantId", userId),

      // Page views from analytics table
      // Returns empty if the table doesn't exist yet — handled gracefully below
      supabase
        .from("scim_analytics")
        .select("path, created_at")
        .eq("tenantId", userId)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    const logs       = logsRecent.data      ?? [];
    const totalCalls = logsTotalResult.count ?? 0;
    const users      = usersResult.data      ?? [];
    const totalGroups = groupsResult.count   ?? 0;
    const totalKeys  = keysResult.count      ?? 0;
    const analytics  = analyticsResult.data  ?? [];

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

    // ── Page views ──────────────────────────────────────────────────────────

    const viewsByPage: Record<string, number> = {};
    let last7daysViews = 0;

    for (const ev of analytics) {
      const path = (ev as any).path ?? "/";
      viewsByPage[path] = (viewsByPage[path] ?? 0) + 1;
      const ts = (ev as any).created_at
        ? new Date((ev as any).created_at).getTime()
        : 0;
      if (ts >= sevenDaysAgo) last7daysViews++;
    }

    return NextResponse.json({
      calls: {
        total:       totalCalls,
        recentSample: logs.length,
        last7days:   last7daysCalls,
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
      groups:  { total: totalGroups },
      apiKeys: { total: totalKeys },
      pageViews: {
        total:    analytics.length,
        last7days: last7daysViews,
        byPage:   viewsByPage,
      },
    });
  } catch (error: any) {
    console.error("Stats API error:", error);
    return NextResponse.json({ detail: "Internal Server Error" }, { status: 500 });
  }
}
