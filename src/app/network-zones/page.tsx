"use client";

// ─── Network Zones tester ─────────────────────────────────────────────────────
//
// Creates a throwaway Okta service app (private_key_jwt) from an API key, then
// fires N client_credentials token requests from the backend so Okta's network
// zone / policy behaviour can be observed. Nothing is saved server-side; the
// org URL, app details and key material live in this browser's localStorage.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Play, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { JsonViewer } from "@/components/json-viewer";
import { usePageTracking } from "@/hooks/usePageTracking";

const STORAGE_KEY = "network-zones-tester";

interface AppInfo { appId: string; clientId: string; kid: string; privateKeyPem: string }
interface Stored { orgUrl: string; apiKey: string; app: AppInfo | null }
interface RunResult { index: number; status: number; ok: boolean; ms: number; body: unknown; at: string }

export default function NetworkZonesPage() {
  usePageTracking();

  const [orgUrl, setOrgUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [app, setApp] = useState<AppInfo | null>(null);
  const [serverType, setServerType] = useState<"org" | "custom">("org");
  const [serverId, setServerId] = useState("default");
  const [scope, setScope] = useState("");
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState<"create" | "run" | "delete" | null>(null);
  const [endpoint, setEndpoint] = useState("");
  const [results, setResults] = useState<RunResult[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s: Stored = JSON.parse(raw);
        setOrgUrl(s.orgUrl ?? "");
        setApiKey(s.apiKey ?? "");
        setApp(s.app ?? null);
      }
    } catch { /* ignore corrupt storage */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ orgUrl, apiKey, app } satisfies Stored));
  }, [hydrated, orgUrl, apiKey, app]);

  const post = async (path: string, body: unknown) => {
    const res = await fetch(`/api/network-zones/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ? `${data.error}${data.detail ? ` — ${JSON.stringify(data.detail)}` : ""}` : `HTTP ${res.status}`);
    return data;
  };

  const createApp = async () => {
    setBusy("create");
    try {
      const data = await post("create-app", { orgUrl, apiKey });
      setApp({ appId: data.appId, clientId: data.clientId, kid: data.kid, privateKeyPem: data.privateKeyPem });
      if (!data.orgGrant?.ok) toast.warning("App created, but the org-server scope grant failed (fine for custom servers).");
      else toast.success("Service app created.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  const run = async () => {
    if (!app) return;
    setBusy("run");
    setResults([]);
    try {
      const data = await post("run", {
        orgUrl, serverType, serverId, scope, count,
        clientId: app.clientId, kid: app.kid, privateKeyPem: app.privateKeyPem,
      });
      setEndpoint(data.endpoint);
      setResults(data.results);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  const deleteApp = async () => {
    if (!app) return;
    setBusy("delete");
    try {
      await post("delete-app", { orgUrl, apiKey, appId: app.appId });
      setApp(null);
      toast.success("Service app deleted.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  const ready = orgUrl.trim() && apiKey.trim();

  return (
    <div className="container mx-auto max-w-4xl space-y-6 py-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Network Zones Tester</h1>
        <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Creates a temporary Okta service app from an API key, then requests tokens from the
          backend so you can see how network zones affect the token endpoint. Details are kept in
          this browser only.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">1. Okta org &amp; service app</CardTitle>
          <CardDescription>The API key needs permission to manage applications.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="org">Okta org URL</Label>
              <Input id="org" placeholder="https://your-org.okta.com" value={orgUrl} onChange={(e) => setOrgUrl(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="key">API key (SSWS)</Label>
              <Input id="key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            </div>
          </div>
          {app ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-xs">
              <div className="space-y-0.5">
                <div>Client ID: <code className="font-mono">{app.clientId}</code></div>
                <div>App ID: <code className="font-mono">{app.appId}</code></div>
              </div>
              <Button variant="destructive" size="sm" onClick={deleteApp} disabled={!!busy}>
                {busy === "delete" ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete service app
              </Button>
            </div>
          ) : (
            <Button onClick={createApp} disabled={!ready || !!busy}>
              {busy === "create" ? <Loader2 className="animate-spin" /> : <Plus />} Create service app
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">2. Request tokens</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Endpoint</Label>
              <Select value={serverType} onValueChange={(v) => setServerType(v as "org" | "custom")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="org">Org authorization server</SelectItem>
                  <SelectItem value="custom">Custom authorization server</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {serverType === "custom" && (
              <div className="space-y-1.5">
                <Label htmlFor="sid">Server ID</Label>
                <Input id="sid" value={serverId} onChange={(e) => setServerId(e.target.value)} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="scope">Scope{serverType === "org" ? " (default okta.users.read)" : ""}</Label>
              <Input id="scope" value={scope} onChange={(e) => setScope(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="count">Requests (1–50)</Label>
              <Input id="count" type="number" min={1} max={50} value={count}
                onChange={(e) => setCount(Math.min(50, Math.max(1, Number(e.target.value) || 1)))} />
            </div>
          </div>
          <Button onClick={run} disabled={!app || !!busy}>
            {busy === "run" ? <Loader2 className="animate-spin" /> : <Play />} Run requests
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Logs</CardTitle>
            <CardDescription>
              <code className="font-mono">{endpoint}</code> — {results.filter((r) => r.ok).length}/{results.length} succeeded
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {results.map((r) => (
              <details key={r.index} className="rounded-md border p-2 text-xs">
                <summary className="flex cursor-pointer items-center gap-3 font-mono">
                  <span>#{r.index}</span>
                  <span className={r.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                    {r.status || "ERR"}
                  </span>
                  <span>{r.ms} ms</span>
                  <span className="text-muted-foreground">{new Date(r.at).toLocaleTimeString()}</span>
                </summary>
                <div className="mt-2"><JsonViewer data={r.body} /></div>
              </details>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
