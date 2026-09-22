"use client";

// ─── API ──────────────────────────────────────────────────────────────────────
//
// Built from the dashboard's own primitives — Section, StatTile and RateMeter
// from @/components/scim/dashboard/viz — rather than merely resembling them, so
// the two pages cannot drift apart. VizTokens supplies the validated status
// colours the tones and the meter read from.
//
// Sections: Connection · Endpoints · Credentials · Limits · Setup
//
// It fetches /stats for the same reason the dashboard does: the top tiles state
// what is actually true of this tenant right now (keys present, rate-limit
// headroom, traffic seen) instead of only showing configuration you have to
// verify elsewhere. Stats are supplementary here — a failure degrades the tiles,
// it must never hide the endpoints and credentials, which are the page's job.

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion } from "motion/react";
import ApiKeyManager from "@/components/ApiKeyManager";
import { usePageTracking } from "@/hooks/usePageTracking";
import {
  Unlock, Zap, KeyRound, Server, ListOrdered, Gauge, ShieldCheck, Activity,
  RefreshCw, AlertCircle, CheckCircle2, ExternalLink,
} from "lucide-react";
import {
  Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { EndpointField } from "@/components/scim/keys/endpoint-field";
import { CopyButton } from "@/components/scim/keys/copy-button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { VizTokens, Section, StatTile, RateMeter } from "@/components/scim/dashboard/viz";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "";

async function deriveClientSecret(tenantId: string): Promise<string> {
  const data   = new TextEncoder().encode(tenantId + ":scim-oauth-secret");
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

interface ApiStats {
  calls:     { total: number; last7days: number };
  apiKeys:   { total: number };
  rateLimit: { enabled: boolean; windowCalls: number; limit: number; rateLimitedCalls: number };
}

// A labelled, copyable value — used for the SCIM base URL and the client
// credentials, which are the three things people come here to copy.
function CopyField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="flex min-h-[36px] items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
        {!value
          ? <Skeleton className="h-4 flex-1" />
          : <>
              <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{value}</code>
              <CopyButton value={value} />
            </>}
      </div>
    </div>
  );
}

export default function ApiPage() {
  usePageTracking();
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "";

  const [clientSecret, setClientSecret] = useState<string>("");
  const [stats,        setStats]        = useState<ApiStats | null>(null);
  const [statsError,   setStatsError]   = useState<string | null>(null);
  const [refreshing,   setRefreshing]   = useState(false);

  // ── Rate-limit settings ──────────────────────────────────────────────────
  const [rlEnabled,    setRlEnabled]    = useState<boolean | null>(null);
  const [rlMax,        setRlMax]        = useState<number>(60);
  const [rlInputValue, setRlInputValue] = useState<string>("60");
  const [rlSaving,     setRlSaving]     = useState(false);
  const [rlLoaded,     setRlLoaded]     = useState(false);

  const loadStats = useCallback(async (silent = false) => {
    if (!userId) return;
    if (silent) setRefreshing(true);
    try {
      const res = await fetch(`/api/${userId}/scim/v2/stats`);
      if (!res.ok) throw new Error(res.statusText || `HTTP ${res.status}`);
      setStats(await res.json());
      setStatsError(null);
    } catch (e) {
      setStatsError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    deriveClientSecret(userId).then(setClientSecret);

    fetch(`/api/${userId}/settings`)
      .then((r) => r.json())
      .then((data) => {
        setRlEnabled(Boolean(data.rateLimitEnabled));
        setRlMax(Number(data.rateLimitMax) || 60);
        setRlInputValue(String(data.rateLimitMax ?? 60));
        setRlLoaded(true);
      })
      .catch(() => setRlLoaded(true));
  }, [userId]);

  useEffect(() => { loadStats(); }, [loadStats]);

  async function saveRlSettings(enabled: boolean, max: number) {
    setRlSaving(true);
    try {
      const res = await fetch(`/api/${userId}/settings`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ rateLimitEnabled: enabled, rateLimitMax: max }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      setRlEnabled(data.rateLimitEnabled);
      setRlMax(data.rateLimitMax);
      setRlInputValue(String(data.rateLimitMax));
      toast.success(
        data.rateLimitEnabled
          ? `Rate limit enabled — ${data.rateLimitMax} req/min`
          : "Rate limit disabled",
      );
      // The meter tile reads limit/enabled from /stats, so re-read it or the tile
      // would keep showing the pre-save values.
      loadStats(true);
    } catch {
      toast.error("Failed to save rate limit settings");
    } finally {
      setRlSaving(false);
    }
  }

  function handleRlToggle(checked: boolean) {
    setRlEnabled(checked);
    saveRlSettings(checked, rlMax);
  }

  function handleRlSave() {
    const parsed = parseInt(rlInputValue, 10);
    if (isNaN(parsed) || parsed < 1) {
      toast.error("Enter a valid number (≥ 1)");
      return;
    }
    setRlMax(parsed);
    saveRlSettings(rlEnabled ?? true, parsed);
  }

  const scimEndpoint = `${BASE_URL}/api/${userId}/scim/v2`;
  const authorizeUrl = `${BASE_URL}/api/oauth2/authorize`;
  const tokenUrl     = `${BASE_URL}/api/oauth2/token`;

  const keyCount = stats?.apiKeys.total ?? 0;
  const hasKeys  = keyCount > 0;

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
          <h1 className="text-lg font-semibold tracking-tight">API</h1>
          <p className="text-xs text-muted-foreground">
            Endpoints and credentials for pointing an identity provider at this tenant.
          </p>
        </div>
        <Button
          variant="outline" size="sm" className="h-8 gap-1.5"
          onClick={() => loadStats(true)} disabled={refreshing}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Stats are supplementary — warn, but never block the page. */}
      {statsError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Live status unavailable</AlertTitle>
          <AlertDescription>
            {statsError} — the endpoints and credentials below are still correct.
          </AlertDescription>
        </Alert>
      )}

      {/* ─── Connection ────────────────────────────────────────────────────── */}
      <Section title="Connection" hint="this tenant, right now">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="API keys"
            value={stats ? keyCount : "—"}
            icon={<KeyRound className="h-4 w-4" />}
            accent="violet"
            tone={stats && !hasKeys ? "warning" : "default"}
            sub={stats
              ? (hasKeys ? "Bearer credentials active" : "None — Okta cannot connect yet")
              : "Loading…"}
          />
          <StatTile
            label="Auth methods"
            value={4}
            icon={<ShieldCheck className="h-4 w-4" />}
            accent="emerald"
            sub="Session · API key · local JWT · Okta JWT"
          />
          <StatTile
            label="Requests seen"
            value={stats ? stats.calls.total : "—"}
            icon={<Activity className="h-4 w-4" />}
            accent="blue"
            sub={stats ? `${stats.calls.last7days.toLocaleString()} in the last 7 days` : "Loading…"}
            href="/scim/logs"
          />
          <StatTile
            label="Rate limit"
            value={stats ? (stats.rateLimit.enabled ? `${stats.rateLimit.limit}/min` : "Off") : "—"}
            icon={<Gauge className="h-4 w-4" />}
            accent="amber"
            tone={stats && !stats.rateLimit.enabled ? "warning" : "default"}
            sub={stats
              ? (stats.rateLimit.enabled
                  ? `${stats.rateLimit.windowCalls} used in the last 60s`
                  : "All requests pass through")
              : "Loading…"}
          />
        </div>

        {stats && !hasKeys && (
          <Alert>
            <AlertCircle />
            <AlertTitle>No API key yet</AlertTitle>
            <AlertDescription>
              Okta authenticates with a bearer token. Create one under Credentials
              below before running <strong>Test API Credentials</strong>.
            </AlertDescription>
          </Alert>
        )}
      </Section>

      {/* ─── Endpoints ─────────────────────────────────────────────────────── */}
      <Section title="Endpoints" hint="same for every auth method">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">SCIM base URL</CardTitle>
            <CardDescription>
              Use this as the SCIM base URL in your identity provider, regardless of
              which authentication method you choose.
            </CardDescription>
            <CardAction>
              <span className="flex size-7 items-center justify-center rounded-md bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
                <Server className="h-4 w-4" />
              </span>
            </CardAction>
          </CardHeader>
          <CardContent>
            <CopyField label="URL" value={userId ? scimEndpoint : undefined} />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Authorization endpoint</CardTitle>
              <CardDescription>
                Set this as your app&apos;s{" "}
                <strong className="text-foreground">Authorization endpoint</strong> in
                the SCIM provisioning settings.
              </CardDescription>
              <CardAction>
              <span className="flex size-7 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                <Zap className="h-4 w-4" />
              </span>
            </CardAction>
            </CardHeader>
            <CardContent>
              <EndpointField method="GET" value={authorizeUrl} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Token endpoint</CardTitle>
              <CardDescription>
                Set this as your app&apos;s{" "}
                <strong className="text-foreground">Token endpoint</strong>. Issues a
                Bearer token valid for one hour.
              </CardDescription>
              <CardAction>
              <span className="flex size-7 items-center justify-center rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                <KeyRound className="h-4 w-4" />
              </span>
            </CardAction>
            </CardHeader>
            <CardContent>
              <EndpointField method="POST" value={tokenUrl} />
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* ─── Credentials ───────────────────────────────────────────────────── */}
      <Section title="Credentials">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Client credentials</CardTitle>
            <CardDescription>
              Use these with the{" "}
              <code className="rounded bg-muted px-1 font-mono text-[11px]">client_credentials</code>{" "}
              grant to obtain a Bearer token directly from the token endpoint — no Okta
              redirect required. They also work with the Authorization Code flow.
            </CardDescription>
            <CardAction>
              <span className="flex size-7 items-center justify-center rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                <Unlock className="h-4 w-4" />
              </span>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <CopyField label="Client ID"     value={userId || undefined} />
              <CopyField label="Client Secret" value={clientSecret || undefined} />
            </div>
          </CardContent>
        </Card>

        <ApiKeyManager />
      </Section>

      {/* ─── Limits ────────────────────────────────────────────────────────── */}
      <Section title="Limits" hint="per tenant">
        <div className="grid gap-3 lg:grid-cols-3">
          {/* The same meter the dashboard uses, so headroom reads identically in
              both places. */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Current usage</CardTitle>
              <CardDescription className="text-[11px]">live · 60s window</CardDescription>
              <CardAction>
              <span className="flex size-7 items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                <Gauge className="h-4 w-4" />
              </span>
            </CardAction>
            </CardHeader>
            <CardContent>
              {stats ? (
                <RateMeter
                  used={stats.rateLimit.windowCalls}
                  limit={stats.rateLimit.limit}
                  enabled={stats.rateLimit.enabled}
                  throttled={stats.rateLimit.rateLimitedCalls}
                />
              ) : (
                <div className="space-y-2.5">
                  <Skeleton className="h-8 w-28" />
                  <Skeleton className="h-2.5 w-full rounded-full" />
                  <Skeleton className="h-3 w-40" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Rate limit settings</CardTitle>
              <CardDescription>
                How many SCIM API requests this tenant may make per minute. When
                disabled, all requests pass through unrestricted.
              </CardDescription>
              <CardAction>
              <span className="flex size-7 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                <ShieldCheck className="h-4 w-4" />
              </span>
            </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="rl-toggle" className="text-sm font-medium">
                    Enable rate limiting
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Requests over the limit receive a <code className="font-mono">429</code>,
                    and are still written to Logs.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!rlLoaded ? (
                    <Skeleton className="h-5 w-9 rounded-full" />
                  ) : (
                    <>
                      <Switch
                        id="rl-toggle"
                        checked={rlEnabled ?? true}
                        onCheckedChange={handleRlToggle}
                        disabled={rlSaving}
                      />
                      <Badge
                        variant={rlEnabled ? "default" : "secondary"}
                        className="min-w-[52px] justify-center text-[10px]"
                      >
                        {rlEnabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="rl-max" className="text-sm font-medium">
                  Requests per minute
                </Label>
                <p className="text-xs text-muted-foreground">
                  Maximum SCIM API calls allowed in a 60-second window. Dashboard stats
                  calls are exempt, so monitoring never consumes the quota.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {!rlLoaded ? (
                    <Skeleton className="h-9 w-32" />
                  ) : (
                    <>
                      <Input
                        id="rl-max"
                        type="number"
                        min={1}
                        max={10000}
                        value={rlInputValue}
                        onChange={(e) => setRlInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleRlSave()}
                        disabled={rlSaving || !(rlEnabled ?? true)}
                        className="w-32 text-sm"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRlSave}
                        disabled={rlSaving || !(rlEnabled ?? true) || rlInputValue === String(rlMax)}
                      >
                        {rlSaving ? "Saving…" : "Save"}
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Current: <span className="font-medium text-foreground">{rlMax} req/min</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* ─── Setup ─────────────────────────────────────────────────────────── */}
      <Section title="Setup" hint="Okta provisioning">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-sm font-medium">How to configure in Okta</CardTitle>
            <CardDescription>
              Connect your Okta SCIM app using OAuth 2.0.
            </CardDescription>
            <CardAction>
              <span className="flex size-7 items-center justify-center rounded-md bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
                <ListOrdered className="h-4 w-4" />
              </span>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {[
                "In the Okta Admin Console, go to Applications → your SCIM app → Provisioning → API Integration.",
                "Enable OAuth 2.0 authentication. Choose Authorization Code flow for Okta-managed auth, or POST to the Token Endpoint with grant_type=client_credentials for direct token exchange.",
                "Paste the Authorization Endpoint and Token Endpoint URLs from above.",
                "Copy the Client ID and Client Secret from the credentials card.",
                "Set the SCIM Base URL to the SCIM base URL shown above.",
                "Click Test API Credentials — Okta runs the full OAuth flow automatically.",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <CheckCircle2 className="h-3 w-3" />
          Once a user is assigned in Okta, watch{" "}
          <Link href="/scim/logs" className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-2 hover:underline">
            Logs <ExternalLink className="h-3 w-3" />
          </Link>{" "}
          to see the exact requests arrive.
        </p>
      </Section>
    </motion.div>
  );
}
