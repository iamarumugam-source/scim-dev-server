"use client";

// ─── UNLINKED PREVIEW ─────────────────────────────────────────────────────────
//
// Downstream login test. Reachable only by typing the URL — not in the sidebar or
// the breadcrumb map. Under /scim/*, so the auth middleware covers it.
//
// WHAT THIS IS
// A simulator for the sign-in decision a downstream application makes from
// SCIM-provisioned data. SCIM carries no credentials, so this deliberately does
// NOT test passwords or MFA — it tests provisioning: whether the user exists,
// whether the IdP has them active, what profile the app receives, and what
// authorisation data came across.
//
// That is the flow people actually need to verify, and the part that silently
// breaks: Okta deactivates or deprovisions a user and the downstream app keeps
// letting them in. The Deactivate & retry action exercises exactly that path.
//
// No usePageTracking() — a preview should not pollute page-view analytics.

import { useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import {
  LogIn, Loader2, CheckCircle2, XCircle, AlertTriangle, ShieldCheck, ShieldX,
  UserX, UserCheck, ExternalLink, RotateCcw, KeyRound, Users as UsersIcon,
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
  Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@/components/ui/empty";
import { JsonViewer } from "@/components/json-viewer";
import { Band, CopyValue, Muted } from "@/components/scim/detail-bands";
import { VizTokens, Section } from "@/components/scim/dashboard/viz";
import { UserAvatar } from "@/components/scim/user-avatar";
import { ScimUser } from "@/lib/scim/models/scimSchemas";
import { cn } from "@/lib/utils";

type Outcome = "pass" | "warn" | "fail";

interface Check {
  id:      string;
  label:   string;
  outcome: Outcome;
  detail:  string;
}

interface Result {
  verdict:  "allow" | "deny";
  reason:   string;
  checks:   Check[];
  user?:    ScimUser & Record<string, unknown>;
  /** More than one record matched the identifier. */
  ambiguous?: ScimUser[];
}

const ICONS: Record<Outcome, typeof CheckCircle2> = {
  pass: CheckCircle2,
  warn: AlertTriangle,
  fail: XCircle,
};

const TONE: Record<Outcome, string> = {
  pass: "text-[color:var(--status-good)]",
  warn: "text-[color:var(--status-warning)]",
  fail: "text-[color:var(--status-critical)]",
};

/** Extension attributes arrive as top-level `urn:…` keys on the resource. */
function extensionKeys(u: Record<string, unknown>): string[] {
  return Object.keys(u).filter((k) => k.startsWith("urn:") && k !== "schemas");
}

export default function LoginTestPage() {
  const { data: session } = useSession();
  const tenantId = session?.user?.id;

  const [identifier, setIdentifier] = useState("");
  const [busy,       setBusy]       = useState(false);
  const [toggling,   setToggling]   = useState(false);
  const [result,     setResult]     = useState<Result | null>(null);

  const evaluate = useCallback((u: ScimUser & Record<string, unknown>): Result => {
    const checks: Check[] = [];

    // 1 — provisioned. Reaching here means the lookup found exactly one record.
    checks.push({
      id: "provisioned", label: "Account provisioned", outcome: "pass",
      detail: `Found SCIM user ${u.id}`,
    });

    // 2 — the decisive one. Okta deactivation maps to active:false, and an app
    // that ignores this keeps letting deprovisioned staff in.
    const active = u.active === true;
    checks.push({
      id: "active", label: "Account active", outcome: active ? "pass" : "fail",
      detail: active
        ? "active = true"
        : "active = false — the IdP has deactivated or suspended this user",
    });

    // 3 — does the app have enough to build a session?
    const email = u.emails?.find((e) => e.primary)?.value ?? u.emails?.[0]?.value;
    const label = u.displayName || u.name?.formatted;
    const missing = [!email && "primary email", !label && "display name"].filter(Boolean);
    checks.push({
      id: "profile", label: "Profile usable", outcome: missing.length ? "warn" : "pass",
      detail: missing.length
        ? `Missing ${missing.join(" and ")} — the app can sign them in but has no ${!email ? "address to contact them at" : "name to show"}`
        : "userName, email and display name all present",
    });

    // 4 — authorisation data. Informational: whether it should gate sign-in is
    // the downstream app's policy, not something SCIM decides.
    const g = u.groups?.length ?? 0;
    const e = u.entitlements?.length ?? 0;
    const r = u.roles?.length ?? 0;
    checks.push({
      id: "authz", label: "Authorisation data", outcome: g + e + r > 0 ? "pass" : "warn",
      detail: g + e + r > 0
        ? `${g} group${g === 1 ? "" : "s"} · ${e} entitlement${e === 1 ? "" : "s"} · ${r} role${r === 1 ? "" : "s"}`
        : "No groups, entitlements or roles — an app that gates on these would deny",
    });

    const failed = checks.find((c) => c.outcome === "fail");
    return {
      verdict: failed ? "deny" : "allow",
      reason: failed
        ? failed.detail
        : "All provisioning checks passed — the app would establish a session",
      checks,
      user: u,
    };
  }, []);

  const attempt = useCallback(async (raw?: string) => {
    const id = (raw ?? identifier).trim();
    if (!tenantId) return;
    if (!id) { toast.error("Enter a username or email."); return; }

    setBusy(true);
    setResult(null);
    try {
      // Uses the admin `search` parameter so an email, display name or username
      // all resolve — a real app would look up one canonical field, but for
      // testing it is more useful to accept whatever you have to hand.
      const res = await fetch(
        `/api/${tenantId}/scim/v2/Users?search=${encodeURIComponent(id)}&count=5`,
      );
      if (!res.ok) throw new Error(res.statusText || `HTTP ${res.status}`);
      const data = await res.json();
      const found = (data.Resources ?? []) as (ScimUser & Record<string, unknown>)[];

      if (found.length === 0) {
        setResult({
          verdict: "deny",
          reason: "No SCIM user matches that identifier — never provisioned, or already deprovisioned",
          checks: [{
            id: "provisioned", label: "Account provisioned", outcome: "fail",
            detail: `No user found for “${id}”`,
          }],
        });
        return;
      }

      if (found.length > 1) {
        setResult({
          verdict: "deny",
          reason: `${found.length} users match that identifier — a real app would not know which session to create`,
          checks: [{
            id: "provisioned", label: "Account provisioned", outcome: "warn",
            detail: `${found.length} matches — pick one below`,
          }],
          ambiguous: found,
        });
        return;
      }

      // Re-read the single user by id: that route applies withExtensions, so the
      // resource here is byte-for-byte what a service provider receives.
      const one = await fetch(`/api/${tenantId}/scim/v2/Users/${found[0].id}`);
      const full = one.ok ? await one.json() : found[0];
      setResult(evaluate(full));
    } catch (err) {
      toast.error(`Lookup failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [identifier, tenantId, evaluate]);

  // Flips `active` then re-runs the test, which is the whole point: it proves the
  // app denies a user the IdP has deactivated.
  const toggleActive = async () => {
    const u = result?.user;
    if (!u || !tenantId) return;
    setToggling(true);
    try {
      const next = !(u.active === true);
      const res = await fetch(`/api/${tenantId}/scim/v2/Users/${u.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schemas:    ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
          Operations: [{ op: "replace", path: "active", value: next }],
        }),
      });
      if (!res.ok) throw new Error(res.statusText);
      toast.success(next ? "User reactivated — re-testing." : "User deactivated — re-testing.");
      await attempt(u.userName);
    } catch (err) {
      toast.error(`Could not change status: ${(err as Error).message}`);
    } finally {
      setToggling(false);
    }
  };

  const u       = result?.user;
  const email   = u?.emails?.find((e) => e.primary)?.value ?? u?.emails?.[0]?.value;
  const extKeys = u ? extensionKeys(u) : [];

  // What a downstream app would actually put in its session from this record.
  const sessionPayload = u
    ? {
        sub:          u.id,
        userName:     u.userName,
        email:        email ?? null,
        displayName:  u.displayName ?? u.name?.formatted ?? null,
        active:       u.active,
        groups:       (u.groups ?? []).map((g) => g.display ?? g.value),
        entitlements: (u.entitlements ?? []).map((e) => e.display ?? e.value),
        roles:        (u.roles ?? []).map((r) => r.display ?? r.value),
        ...(extKeys.length ? { extensions: extKeys } : {}),
      }
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
          Simulates the sign-in decision a downstream application makes from
          SCIM-provisioned data.
        </AlertDescription>
      </Alert>

      <div>
        <h1 className="text-lg font-semibold tracking-tight">SCIM provisioning simulator</h1>
        <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
          SCIM carries no credentials, so this tests <strong>provisioning, not
          passwords</strong>: whether the user exists, whether the IdP has them active,
          what profile the app receives, and what authorisation data came across. That is
          the part that silently breaks — a user is deactivated in Okta and the
          application keeps admitting them. It needs no Okta app and runs offline. To run the{" "}
          <strong>real</strong> Okta sign-in and compare the arriving claims, use the{" "}
          <a href="/scim/preview/downstream-login" className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-2 hover:underline">
            OIDC login test <ExternalLink className="h-3 w-3" />
          </a>.
        </p>
      </div>

      {/* ─── Sign-in form ─────────────────────────────────────────────────── */}
      <Section title="Sign-in attempt">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Identify the user</CardTitle>
            <CardDescription>
              Username, email or display name — resolved through the same server-side
              search the Users list uses.
            </CardDescription>
            <CardAction><KeyRound className="h-4 w-4 text-muted-foreground" /></CardAction>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => { e.preventDefault(); attempt(); }}
            >
              <div className="min-w-[240px] flex-1 space-y-1">
                <Label htmlFor="ident" className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Username or email
                </Label>
                <Input
                  id="ident"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="jane.doe@example.com"
                  className="h-9 font-mono text-xs"
                  autoComplete="off"
                />
              </div>
              <Button type="submit" size="sm" className="h-9 gap-1.5" disabled={busy}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
                Attempt sign-in
              </Button>
            </form>
            {/* No password field on purpose — see the note above. */}
            <p className="mt-2 text-[11px] text-muted-foreground">
              No password field: SCIM never receives one. Authentication stays with the
              IdP; this checks what the IdP has provisioned.
            </p>
          </CardContent>
        </Card>
      </Section>

      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={result.verdict + (result.user?.id ?? "none")}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-7"
          >
            {/* ─── Verdict ──────────────────────────────────────────────── */}
            <Section title="Result">
              <div
                className={cn(
                  "flex flex-wrap items-start gap-3 rounded-lg border px-4 py-3",
                  result.verdict === "allow"
                    ? "border-[color:var(--status-good)]/40 bg-[color:var(--status-good)]/5"
                    : "border-[color:var(--status-critical)]/40 bg-[color:var(--status-critical)]/5",
                )}
              >
                {result.verdict === "allow"
                  ? <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-[color:var(--status-good)]" />
                  : <ShieldX className="mt-0.5 h-5 w-5 flex-shrink-0 text-[color:var(--status-critical)]" />}
                <div className="min-w-0 flex-1">
                  <p className={cn(
                    "text-sm font-semibold",
                    result.verdict === "allow"
                      ? "text-[color:var(--status-good)]"
                      : "text-[color:var(--status-critical)]",
                  )}>
                    {result.verdict === "allow" ? "ALLOW — sign-in would succeed" : "DENY — sign-in would be refused"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{result.reason}</p>
                </div>
                {u && (
                  <div className="flex items-center gap-2">
                    <UserAvatar user={u} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-medium">{u.userName}</p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "mt-0.5 h-4 gap-1 px-1.5 py-0 text-[10px]",
                          u.active
                            ? "border-[color:var(--status-good)] text-[color:var(--status-good)]"
                            : "text-muted-foreground",
                        )}
                      >
                        {u.active ? <UserCheck className="h-2.5 w-2.5" /> : <UserX className="h-2.5 w-2.5" />}
                        {u.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>

              {/* ─── Checks ─────────────────────────────────────────────── */}
              <div className="rounded-lg border">
                {result.checks.map((c, i) => {
                  const Icon = ICONS[c.outcome];
                  return (
                    <div
                      key={c.id}
                      className={cn(
                        "flex items-start gap-3 px-4 py-2.5",
                        i > 0 && "border-t",
                      )}
                    >
                      <Icon className={cn("mt-0.5 h-4 w-4 flex-shrink-0", TONE[c.outcome])} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium">
                          {i + 1}. {c.label}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                          {c.detail}
                        </p>
                      </div>
                      <span className={cn("flex-shrink-0 text-[10px] font-semibold uppercase tracking-wider", TONE[c.outcome])}>
                        {c.outcome}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Ambiguous matches — let them pick which record to test. */}
              {result.ambiguous && (
                <div className="rounded-lg border">
                  {result.ambiguous.map((m, i) => (
                    <button
                      key={m.id}
                      onClick={() => { setIdentifier(m.userName); attempt(m.userName); }}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-muted/50",
                        i > 0 && "border-t",
                      )}
                    >
                      <UserAvatar user={m} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-xs font-medium">{m.userName}</span>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {m.displayName ?? m.name?.formatted ?? m.id}
                        </span>
                      </span>
                      <LogIn className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}

              {/* The point of the page: prove the deny path works. */}
              {u && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant={u.active ? "destructive" : "default"}
                    size="sm" className="h-8 gap-1.5 text-xs"
                    onClick={toggleActive} disabled={toggling}
                  >
                    {toggling
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : u.active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                    {u.active ? "Deactivate & retry" : "Reactivate & retry"}
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => attempt(u.userName)}>
                    <RotateCcw className="h-3.5 w-3.5" /> Re-test
                  </Button>
                  <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                    <Link href="/scim/users">Open in Users <ExternalLink className="h-3 w-3" /></Link>
                  </Button>
                  <Muted>
                    Deactivating writes <code className="font-mono">active: false</code> via SCIM
                    PATCH — the same call Okta makes when it suspends someone.
                  </Muted>
                </div>
              )}
            </Section>

            {/* ─── What the app receives ────────────────────────────────── */}
            {u && sessionPayload && (
              <Section title="What the application receives">
                <div className="rounded-lg border">
                  <Band label="Identity" first>
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <CopyValue value={u.id} />
                    </div>
                  </Band>

                  <Band label="Extensions">
                    {extKeys.length === 0 ? (
                      <Muted>No schema extensions applied to this response.</Muted>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {extKeys.map((k) => (
                          <Badge key={k} variant="secondary" className="font-mono text-[10px]">{k}</Badge>
                        ))}
                      </div>
                    )}
                  </Band>

                  <Band label="Session">
                    <JsonViewer data={sessionPayload} className="max-h-[260px]" />
                  </Band>

                  <Band label="Raw SCIM">
                    <JsonViewer data={u} className="max-h-[320px]" />
                  </Band>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  The raw resource is fetched from{" "}
                  <code className="font-mono">GET /Users/{"{id}"}</code>, which applies schema
                  extensions — so this is what a service provider actually receives, not a
                  reconstruction.
                </p>
              </Section>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!result && (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon"><UsersIcon className="h-4 w-4" /></EmptyMedia>
            <EmptyTitle className="text-sm">No attempt yet</EmptyTitle>
            <EmptyDescription className="text-xs">
              Enter a provisioned user above. Try a real one, then deactivate it and retry
              to confirm the deny path behaves.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </motion.div>
  );
}
