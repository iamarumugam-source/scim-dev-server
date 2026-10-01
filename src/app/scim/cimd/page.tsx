"use client";

// ─── CIMD ─────────────────────────────────────────────────────────────────────
//
// Client ID Metadata Document tooling. Serves a spec-correct CIMD document at a
// per-tenant URL, so that URL can be pasted into Okta as the client_id and Okta
// dereferences it dynamically. Logs every fetch so the operator can confirm Okta
// actually retrieved it.

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  Fingerprint, Save, Loader2, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { JsonViewer } from "@/components/json-viewer";
import { Band, CopyValue, Muted } from "@/components/scim/detail-bands";
import { VizTokens, Section } from "@/components/scim/dashboard/viz";
import { cn } from "@/lib/utils";
import { usePageTracking } from "@/hooks/usePageTracking";

interface FetchEntry { id: string; fetchedAt: string; userAgent: string | null; ip: string | null }

export default function CimdPage() {
  usePageTracking();
  const { data: session } = useSession();
  const tenantId = session?.user?.id;

  const [clientIdUrl, setClientIdUrl] = useState("");
  const [fetches,     setFetches]     = useState<FetchEntry[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [docPreview,  setDocPreview]  = useState<unknown>(null);

  // form state
  const [name,      setName]      = useState("SCIM Dev Server — CIMD test");
  const [uris,      setUris]      = useState("");
  const [scopes,    setScopes]    = useState("openid profile email");
  const [method,    setMethod]    = useState("none");
  const [grants,    setGrants]    = useState("authorization_code");
  const [clientUri, setClientUri] = useState("");
  const [logoUri,   setLogoUri]   = useState("");
  const [policyUri, setPolicyUri] = useState("");
  const [tosUri,    setTosUri]    = useState("");
  const [jwksUri,   setJwksUri]   = useState("");

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [cfgRes, fetchRes] = await Promise.all([
        fetch(`/api/${tenantId}/cimd/config`),
        fetch(`/api/${tenantId}/cimd/fetches`),
      ]);
      if (cfgRes.ok) {
        const data = await cfgRes.json();
        setClientIdUrl(data.clientIdUrl);
        if (data.config) {
          setName(data.config.clientName);
          setUris((data.config.redirectUris ?? []).join("\n"));
          setScopes(data.config.scopes);
          setMethod(data.config.authMethod);
          setGrants((data.config.grantTypes ?? ["authorization_code"]).join(", "));
          setClientUri(data.config.clientUri ?? "");
          setLogoUri(data.config.logoUri ?? "");
          setPolicyUri(data.config.policyUri ?? "");
          setTosUri(data.config.tosUri ?? "");
          setJwksUri(data.config.jwksUri ?? "");
        }
      }
      if (fetchRes.ok) setFetches((await fetchRes.json()).fetches ?? []);
    } catch { /* degrade */ }
    finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  // Fetch the actual served document to show a live preview.
  const loadPreview = useCallback(async () => {
    if (!tenantId) return;
    try {
      const r = await fetch(`/api/${tenantId}/cimd/client`);
      if (r.ok) setDocPreview(await r.json());
    } catch { /* degrade */ }
  }, [tenantId]);

  useEffect(() => { if (!loading) loadPreview(); }, [loading, loadPreview]);

  const save = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/${tenantId}/cimd/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName:   name,
          redirectUris:  uris.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean),
          scopes,
          authMethod:   method,
          grantTypes:    grants.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean),
          clientUri:    clientUri || null,
          logoUri:      logoUri || null,
          policyUri:    policyUri || null,
          tosUri:       tosUri || null,
          jwksUri:      jwksUri || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Save failed");
      toast.success("Saved.");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSaving(false); }
  };

  return (
    <motion.div
      className="viz container mx-auto max-w-4xl space-y-7 py-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <VizTokens />

      <div>
        <h1 className="text-lg font-semibold tracking-tight">Client ID Metadata Document (CIMD)</h1>
        <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
          The <code className="font-mono">client_id</code> is a URL. Okta dereferences it to
          discover the client&apos;s metadata (redirect URIs, scopes, auth method) dynamically instead
          of you pre-registering it. Check whether your Okta org advertises{" "}
          <code className="font-mono">client_id_metadata_document_supported</code> in its AS metadata
          before trying this.
        </p>
      </div>

      {/* ─── Client ID URL ────────────────────────────────────────────────── */}
      <Section title="Your client_id URL">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Paste this into Okta as the client ID</CardTitle>
            <CardDescription>
              It must be <code className="font-mono">https</code> and Okta fetches it directly
              (no redirects). <code className="font-mono">NEXT_PUBLIC_BASE_URL</code> must be
              your real public origin — <code className="font-mono">localhost</code> won&apos;t
              work unless you have the dev loopback exception.
            </CardDescription>
            <CardAction><Fingerprint className="h-4 w-4 text-muted-foreground" /></CardAction>
          </CardHeader>
          <CardContent>
            {clientIdUrl ? (
              <CopyValue value={clientIdUrl} className="text-sm font-medium" />
            ) : (
              <Skeleton className="h-5 w-80" />
            )}
          </CardContent>
        </Card>
      </Section>

      {/* ─── Config ───────────────────────────────────────────────────────── */}
      <Section title="Document configuration" hint="stored per tenant">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Client name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Client URI</Label>
                <Input value={clientUri} onChange={(e) => setClientUri(e.target.value)}
                  placeholder="https://your-app.example.com" className="h-8 text-xs" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Redirect URIs <span className="font-normal">(one per line or comma-separated)</span>
                </Label>
                <textarea
                  value={uris}
                  onChange={(e) => setUris(e.target.value)}
                  placeholder={"http://localhost:3000/callback\nhttp://localhost:8080/callback\n(defaults to localhost if blank)"}
                  rows={2}
                  className="w-full rounded-md border bg-background px-3 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Scopes</Label>
                <Input value={scopes} onChange={(e) => setScopes(e.target.value)} className="h-8 font-mono text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Token endpoint auth method
                </Label>
                <Input value={method} onChange={(e) => setMethod(e.target.value)}
                  placeholder="none | private_key_jwt"
                  className="h-8 font-mono text-xs" />
                <Muted>Only secret-free methods are allowed by the spec.</Muted>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Grant types <span className="font-normal">(comma-separated)</span>
                </Label>
                <Input value={grants} onChange={(e) => setGrants(e.target.value)}
                  placeholder="authorization_code, refresh_token"
                  className="h-8 font-mono text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">JWKS URI</Label>
                <Input value={jwksUri} onChange={(e) => setJwksUri(e.target.value)}
                  placeholder="https://your-app.example.com/.well-known/jwks.json"
                  className="h-8 font-mono text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Logo URI</Label>
                <Input value={logoUri} onChange={(e) => setLogoUri(e.target.value)}
                  placeholder="https://your-app.example.com/logo.png"
                  className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Policy URI</Label>
                <Input value={policyUri} onChange={(e) => setPolicyUri(e.target.value)}
                  placeholder="https://your-app.example.com/privacy"
                  className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Terms of service URI</Label>
                <Input value={tosUri} onChange={(e) => setTosUri(e.target.value)}
                  placeholder="https://your-app.example.com/terms"
                  className="h-8 text-xs" />
              </div>
            </div>
            <Button size="sm" className="h-8 gap-1.5" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </Button>
          </CardContent>
        </Card>
      </Section>

      {/* ─── Live preview ─────────────────────────────────────────────────── */}
      <Section title="Document preview" hint="what Okta receives when it fetches the URL">
        {docPreview ? (
          <div className="rounded-lg border">
            <Band label="Served document" first>
              <JsonViewer data={docPreview} className="max-h-[320px]" />
            </Band>
          </div>
        ) : (
          <Skeleton className="h-40 w-full rounded-lg" />
        )}
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={loadPreview}>
          <RefreshCw className="h-3.5 w-3.5" /> Reload preview
        </Button>
      </Section>

      {/* ─── Fetch log ────────────────────────────────────────────────────── */}
      <Section title="Fetch log" hint="who dereferenced the client_id URL">
        {fetches.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No fetches recorded yet. Paste the URL above as a <code className="font-mono">client_id</code> in
            Okta, and entries appear here when Okta dereferences it.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            {fetches.map((f, i) => (
              <div key={f.id} className={cn("flex items-center gap-3 px-3 py-2 text-xs", i > 0 && "border-t")}>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {new Date(f.fetchedAt).toLocaleString()}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-muted-foreground" title={f.userAgent ?? undefined}>
                  {f.userAgent ?? "—"}
                </span>
                <span className="shrink-0 font-mono text-muted-foreground">{f.ip ?? "—"}</span>
              </div>
            ))}
          </div>
        )}
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh log
        </Button>
      </Section>
    </motion.div>
  );
}
