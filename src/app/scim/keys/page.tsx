"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "motion/react";
import ApiKeyManager from "@/components/ApiKeyManager";
import { usePageTracking } from "@/hooks/usePageTracking";
import { Unlock, Zap, KeyRound, Server, ListOrdered, Gauge } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "";

async function deriveClientSecret(tenantId: string): Promise<string> {
  const data   = new TextEncoder().encode(tenantId + ":scim-oauth-secret");
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

export default function ApiPage() {
  usePageTracking();
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "";

  const [clientSecret, setClientSecret] = useState<string>("");

  // ── Rate-limit settings ──────────────────────────────────────────────────
  const [rlEnabled,      setRlEnabled]      = useState<boolean | null>(null);
  const [rlMax,          setRlMax]          = useState<number>(60);
  const [rlInputValue,   setRlInputValue]   = useState<string>("60");
  const [rlSaving, setRlSaving] = useState(false);
  const [rlLoaded, setRlLoaded] = useState(false);

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

  return (
    <motion.div
      className="container mx-auto py-6 space-y-6"
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 18, mass: 0.8 }}
    >

      {/* ── SCIM Endpoint ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">SCIM Endpoint</CardTitle>
          <CardDescription>
            Use this as the SCIM base URL in your identity provider, regardless of which authentication method you choose.
          </CardDescription>
          <CardAction>
            <Server className="h-4 w-4 text-foreground/60" />
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">URL</p>
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 min-h-[36px]">
            {!userId
              ? <Skeleton className="h-4 flex-1" />
              : <><code className="flex-1 text-xs font-mono text-foreground truncate min-w-0">{scimEndpoint}</code><CopyButton value={scimEndpoint} /></>
            }
          </div>
        </CardContent>
      </Card>

      {/* ── OAuth 2.0 ────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

          {/* Authorization Endpoint */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Authorization Endpoint</CardTitle>
              <CardDescription>
                Set this as your app&apos;s <strong className="text-foreground">Authorization endpoint</strong> in the SCIM provisioning settings.
              </CardDescription>
              <CardAction>
                <Zap className="h-4 w-4 text-foreground/60" />
              </CardAction>
            </CardHeader>
            <CardContent>
              <EndpointField method="GET" value={authorizeUrl} />
            </CardContent>
          </Card>

          {/* Token Endpoint */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Token Endpoint</CardTitle>
              <CardDescription>
                Set this as your app&apos;s <strong className="text-foreground">Token endpoint</strong>.
              </CardDescription>
              <CardAction>
                <KeyRound className="h-4 w-4 text-foreground/60" />
              </CardAction>
            </CardHeader>
            <CardContent>
              <EndpointField method="POST" value={tokenUrl} />
            </CardContent>
          </Card>
        </div>

        {/* Client credentials */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Client Credentials</CardTitle>
            <CardDescription>
              Use these credentials with the <code className="text-[11px] font-mono bg-muted px-1 rounded">client_credentials</code> grant type to obtain a Bearer token directly from the token endpoint — no Okta redirect required. They also work with the Authorization Code flow when configuring your Okta SCIM app.
            </CardDescription>
            <CardAction>
              <Unlock className="h-4 w-4 text-foreground/60" />
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { label: "Client ID",     value: userId },
                { label: "Client Secret", value: clientSecret },
              ].map(({ label, value }) => (
                <div key={label} className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                  <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 min-h-[36px]">
                    {!value
                      ? <Skeleton className="h-4 flex-1" />
                      : <><code className="flex-1 text-xs font-mono text-foreground truncate min-w-0">{value}</code><CopyButton value={value} /></>
                    }
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Setup steps */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-sm font-medium">How to configure in Okta</CardTitle>
            <CardDescription>
              Follow these steps to connect your Okta SCIM app using OAuth 2.0.
            </CardDescription>
            <CardAction>
              <ListOrdered className="h-4 w-4 text-foreground/60" />
            </CardAction>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {[
                "In Okta Admin Console, go to Applications → your SCIM app → Provisioning → API Integration.",
                "Enable OAuth 2.0 authentication. Choose Authorization Code flow for Okta-managed auth, or POST to the Token Endpoint with grant_type=client_credentials for direct token exchange.",
                "Paste the Authorization Endpoint and Token Endpoint URLs above.",
                "Copy the Client ID and Client Secret from the credentials card above.",
                "Set the SCIM Base URL to the SCIM endpoint shown at the top of this page.",
                "Click Test API Credentials — Okta will run the full OAuth flow automatically.",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary mt-0.5 dark:bg-blue-900/50 dark:text-blue-300">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>

      {/* ── Rate Limiting ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Rate Limiting</CardTitle>
          <CardDescription>
            Control how many SCIM API requests your tenant can make per minute. When disabled, all requests pass through without restriction.
          </CardDescription>
          <CardAction>
            <Gauge className="h-4 w-4 text-foreground/60" />
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Enable / disable toggle */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="rl-toggle" className="text-sm font-medium">
                Enable rate limiting
              </Label>
              <p className="text-xs text-muted-foreground">
                When on, requests exceeding the limit receive a 429 response.
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
                    className="text-[10px] min-w-[52px] justify-center"
                  >
                    {rlEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                </>
              )}
            </div>
          </div>

          <Separator />

          {/* Requests per minute */}
          <div className="space-y-2">
            <Label htmlFor="rl-max" className="text-sm font-medium">
              Requests per minute
            </Label>
            <p className="text-xs text-muted-foreground">
              Maximum number of SCIM API calls allowed in a 60-second window.
            </p>
            <div className="flex items-center gap-2">
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
                  {rlLoaded && (
                    <span className="text-xs text-muted-foreground">
                      Current: <span className="font-medium text-foreground">{rlMax} req/min</span>
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Divider ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or use static bearer tokens</span>
        <Separator className="flex-1" />
      </div>

      {/* ── API Keys ──────────────────────────────────────────────────────── */}
      <ApiKeyManager />

    </motion.div>
  );
}
