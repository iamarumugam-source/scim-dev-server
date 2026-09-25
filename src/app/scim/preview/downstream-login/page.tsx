"use client";

// ─── UNLINKED PREVIEW ─────────────────────────────────────────────────────────
//
// Real OIDC login test: authenticates a SCIM-provisioned user THROUGH Okta and
// compares the claims that arrive at login against the provisioned record.
//
// Sibling to `login-test`, not a merge:
//   • login-test      — SIMULATOR. Reasons over the SCIM record only. No Okta, no
//                       redirect, works offline.
//   • downstream-login — REAL ROUND TRIP. Needs a configured downstream Okta app
//                       and leaves the browser entirely.
//
// Under /scim/*, so the auth middleware covers it. No usePageTracking().

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  LogIn, Loader2, XCircle, AlertTriangle, ShieldCheck, ShieldX,
  KeyRound, Save, FlaskConical, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { JsonViewer } from "@/components/json-viewer";
import { Band, CopyValue, Muted } from "@/components/scim/detail-bands";
import { VizTokens, Section } from "@/components/scim/dashboard/viz";
import { compareOidcToScim, type Comparison, type RowStatus } from "@/lib/downstream-oidc/compare";
import type { ScimUser } from "@/lib/scim/models/scimSchemas";
import { cn } from "@/lib/utils";

interface ConfigResponse {
  config: { issuer: string; clientId: string; scopes: string; hasSecret: boolean } | null;
  redirectUri: string;
  initiateLoginUri: string;
}

interface Attempt {
  id: string;
  createdAt: string;
  outcome: "success" | "error";
  error?: string | null;
  initiatedBy: "sp" | "idp";
  idTokenClaims?: Record<string, unknown> | null;
  userinfo?: Record<string, unknown> | null;
  matchedScimUserId?: string | null;
}

const STATUS_STYLE: Record<RowStatus, string> = {
  match:       "text-[color:var(--status-good)]",
  differs:     "text-[color:var(--status-critical)]",
  "oidc-only": "text-[color:var(--status-warning)]",
  "scim-only": "text-muted-foreground",
};

function Page() {
  const { data: session } = useSession();
  const tenantId = session?.user?.id;
  const search   = useSearchParams();
  const attemptId = search.get("attempt");
  const urlError  = search.get("error");

  const [cfg,        setCfg]        = useState<ConfigResponse | null>(null);
  const [issuer,     setIssuer]     = useState("");
  const [clientId,   setClientId]   = useState("");
  const [scopes,     setScopes]     = useState("openid profile email");
  const [secret,     setSecret]     = useState("");
  const [saving,     setSaving]     = useState(false);
  const [attempt,    setAttempt]    = useState<Attempt | null>(null);
  const [scimUser,   setScimUser]   = useState<ScimUser | null>(null);
  const [loadingAtt, setLoadingAtt] = useState(false);

  // ── Load config ────────────────────────────────────────────────────────────
  const loadConfig = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await fetch(`/api/${tenantId}/downstream/config`);
      if (!res.ok) return;
      const data = (await res.json()) as ConfigResponse;
      setCfg(data);
      if (data.config) {
        setIssuer(data.config.issuer);
        setClientId(data.config.clientId);
        setScopes(data.config.scopes);
      }
    } catch { /* leave the form empty */ }
  }, [tenantId]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  // ── Load an attempt when redirected back ─────────────────────────────────────
  const loadAttempt = useCallback(async (id: string) => {
    if (!tenantId) return;
    setLoadingAtt(true);
    try {
      const res = await fetch(`/api/${tenantId}/downstream/attempts?id=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error((await res.json()).detail || res.statusText);
      const data = await res.json();
      setAttempt(data.attempt);
      setScimUser(data.scimUser ?? null);
    } catch (e) {
      toast.error(`Could not load result: ${(e as Error).message}`);
    } finally {
      setLoadingAtt(false);
    }
  }, [tenantId]);

  useEffect(() => { if (attemptId) loadAttempt(attemptId); }, [attemptId, loadAttempt]);

  const save = async () => {
    if (!tenantId) return;
    if (!issuer.trim() || !clientId.trim()) { toast.error("Issuer and client ID are required."); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/${tenantId}/downstream/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // secret omitted (undefined) when blank, so an existing one is preserved.
        body: JSON.stringify({ issuer, clientId, scopes, ...(secret ? { clientSecret: secret } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Save failed");
      setSecret("");
      if (data.discovery?.ok) toast.success("Saved — issuer endpoints resolved.");
      else toast.warning(`Saved, but discovery failed: ${data.discovery?.error ?? "unknown"}`);
      loadConfig();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const configured = Boolean(cfg?.config?.issuer && cfg?.config?.clientId);
  const comparison: Comparison | null =
    attempt?.outcome === "success" && attempt.idTokenClaims
      ? compareOidcToScim(attempt.idTokenClaims, scimUser)
      : null;

  return (
    <motion.div
      className="viz container mx-auto max-w-4xl space-y-7 py-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <VizTokens />

      <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
        <LogIn className="text-amber-600 dark:text-amber-400" />
        <AlertTitle className="text-amber-900 dark:text-amber-200">
          Design preview — not linked from navigation
        </AlertTitle>
        <AlertDescription className="text-amber-800/80 dark:text-amber-300/70">
          Authenticates a provisioned user through Okta and compares the claims against SCIM.
        </AlertDescription>
      </Alert>

      <div>
        <h1 className="text-lg font-semibold tracking-tight">Real OIDC login test</h1>
        <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Runs the actual sign-in from Okta into this app, so you can see the claims that arrive at
          login and compare them to what SCIM provisioned. For a check that needs no Okta app, the{" "}
          <Link href="/scim/preview/login-test" className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-2 hover:underline">
            SCIM simulator <FlaskConical className="h-3 w-3" />
          </Link>{" "}
          reasons over the provisioned record alone.
        </p>
      </div>

      {urlError && !attemptId && (
        <Alert variant="destructive">
          <XCircle />
          <AlertTitle>Login failed</AlertTitle>
          <AlertDescription>{urlError}</AlertDescription>
        </Alert>
      )}

      {/* ─── Configuration ────────────────────────────────────────────────── */}
      <Section title="Downstream Okta app" hint="stored per tenant">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">OIDC client</CardTitle>
            <CardDescription>
              Register a second Okta app pointing at this server. Create it as a{" "}
              <strong>SPA</strong> (Client authentication = None) and leave the secret blank — then
              this server stores no credential and relies on PKCE alone.
            </CardDescription>
            <CardAction><KeyRound className="h-4 w-4 text-muted-foreground" /></CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Issuer</Label>
                <Input value={issuer} onChange={(e) => setIssuer(e.target.value)}
                  placeholder="https://your-org.okta.com" className="h-8 font-mono text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Client ID</Label>
                <Input value={clientId} onChange={(e) => setClientId(e.target.value)}
                  placeholder="0oa…" className="h-8 font-mono text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Scopes</Label>
                <Input value={scopes} onChange={(e) => setScopes(e.target.value)}
                  className="h-8 font-mono text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Client secret {cfg?.config?.hasSecret && <span className="text-[color:var(--status-good)]">· stored</span>}
                </Label>
                <Input value={secret} onChange={(e) => setSecret(e.target.value)} type="password"
                  placeholder={cfg?.config?.hasSecret ? "•••••• (leave blank to keep)" : "blank for a SPA/PKCE app"}
                  className="h-8 font-mono text-xs" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" className="h-8 gap-1.5" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save config
              </Button>
              <Muted>The secret is write-only — it is never returned, only whether one is stored.</Muted>
            </div>

            {cfg && (
              <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Paste these into the Okta app
                </p>
                <div className="flex flex-col gap-1.5">
                  <span className="flex items-baseline gap-2">
                    <span className="w-32 flex-shrink-0 text-[11px] text-muted-foreground">Sign-in redirect URI</span>
                    <CopyValue value={cfg.redirectUri} />
                  </span>
                  <span className="flex items-baseline gap-2">
                    <span className="w-32 flex-shrink-0 text-[11px] text-muted-foreground">Initiate login URI</span>
                    <CopyValue value={cfg.initiateLoginUri} />
                  </span>
                </div>
                <Muted>
                  Set &quot;Login initiated by&quot; to <strong>Either Okta or App</strong> to enable the
                  dashboard tile (IdP-initiated).
                </Muted>
              </div>
            )}
          </CardContent>
        </Card>
      </Section>

      {/* ─── Run ──────────────────────────────────────────────────────────── */}
      <Section title="Run the test">
        {!configured ? (
          <Alert>
            <AlertTriangle />
            <AlertTitle>Not configured yet</AlertTitle>
            <AlertDescription>Save an issuer and client ID above first.</AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {/* A plain link, not fetch: this must be a top-level navigation so the
                browser follows the 302 to Okta and carries cookies back. */}
            <Button asChild size="sm" className="h-9 gap-1.5">
              <a href={`/api/${tenantId}/downstream/login`}>
                <LogIn className="h-3.5 w-3.5" /> Test login (SP-initiated)
              </a>
            </Button>
            <Muted>
              Or click the app tile in the Okta dashboard for the IdP-initiated path — both land back here.
            </Muted>
          </div>
        )}
      </Section>

      {/* ─── Result ───────────────────────────────────────────────────────── */}
      {attemptId && (
        <Section title="Result">
          {loadingAtt ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-40 w-full rounded-lg" />
            </div>
          ) : !attempt ? (
            <Muted>Result not found — it may have expired.</Muted>
          ) : attempt.outcome === "error" ? (
            <Alert variant="destructive">
              <ShieldX />
              <AlertTitle>Login failed</AlertTitle>
              <AlertDescription>{attempt.error}</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-6">
              {/* Findings */}
              {comparison && (
                <div className="space-y-2">
                  {comparison.findings.map((f, i) => {
                    const Icon = f.outcome === "fail" ? ShieldX : f.outcome === "warn" ? AlertTriangle : ShieldCheck;
                    const tone = f.outcome === "fail" ? "var(--status-critical)"
                      : f.outcome === "warn" ? "var(--status-warning)" : "var(--status-good)";
                    return (
                      <div key={i} className="flex items-start gap-3 rounded-lg border px-4 py-3"
                        style={{ borderColor: `color-mix(in srgb, ${tone} 40%, transparent)`, background: `color-mix(in srgb, ${tone} 5%, transparent)` }}>
                        <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: tone }} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold" style={{ color: tone }}>{f.title}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{f.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <Badge variant="secondary" className="text-[10px]">
                      {attempt.initiatedBy === "idp" ? "IdP-initiated" : "SP-initiated"}
                    </Badge>
                    {comparison.matchedBy && <span>Matched by <code className="font-mono">{comparison.matchedBy}</code></span>}
                    <span className="tabular-nums">{new Date(attempt.createdAt).toLocaleString()}</span>
                    <Button asChild variant="ghost" size="sm" className="ml-auto h-7 gap-1.5 text-[11px]">
                      <a href={`/api/${tenantId}/downstream/login`}><RotateCcw className="h-3 w-3" /> Run again</a>
                    </Button>
                  </div>
                </div>
              )}

              {/* Comparison table */}
              {comparison && (
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted dark:bg-white/[0.04]">
                      <TableRow>
                        <TableHead className="text-xs font-semibold uppercase tracking-wide">OIDC claim</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wide">Token value</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wide">SCIM</TableHead>
                        <TableHead className="w-24 text-xs font-semibold uppercase tracking-wide">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comparison.rows.map((r) => (
                        <TableRow key={r.claim}>
                          <TableCell className="font-mono text-xs font-medium">{r.claim}</TableCell>
                          <TableCell className="font-mono text-xs">{r.oidcValue ?? <span className="text-muted-foreground/40">—</span>}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {r.scimValue ?? "—"}
                            <span className="ml-1 text-[10px] opacity-60">{r.scimPath}</span>
                          </TableCell>
                          <TableCell>
                            <span className={cn("text-[10px] font-semibold uppercase tracking-wider", STATUS_STYLE[r.status])}>
                              {r.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Raw claims + userinfo */}
              <div className="rounded-lg border">
                <Band label="ID token claims" first>
                  <JsonViewer data={attempt.idTokenClaims ?? {}} className="max-h-[300px]" />
                </Band>
                <Band label="Userinfo">
                  {attempt.userinfo
                    ? <JsonViewer data={attempt.userinfo} className="max-h-[240px]" />
                    : <Muted>Not fetched, or the endpoint returned nothing.</Muted>}
                </Band>
              </div>
            </div>
          )}
        </Section>
      )}
    </motion.div>
  );
}

export default function DownstreamLoginPage() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<div className="container mx-auto py-6"><Skeleton className="h-64 w-full rounded-lg" /></div>}>
      <Page />
    </Suspense>
  );
}
