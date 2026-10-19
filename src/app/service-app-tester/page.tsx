"use client";

// ─── Service App Permissions tester ───────────────────────────────────────────
//
// Creates a throwaway Okta client-credentials service app from an API key, grants
// the chosen OAuth scopes and an admin role limited to chosen groups/apps, then
// lets you probe the Okta API with the app's own token — including against
// groups it was NOT granted — to see what the app can and cannot manage.
// Nothing is saved server-side; state lives in this browser's localStorage.

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Play, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { JsonViewer } from "@/components/json-viewer";
import { usePageTracking } from "@/hooks/usePageTracking";

const STORAGE_KEY = "service-app-tester";

const SCOPES = [
  "okta.groups.read", "okta.groups.manage", "okta.users.read", "okta.users.manage",
  "okta.apps.read", "okta.apps.manage", "okta.roles.read", "okta.roles.manage",
];
const PERMISSIONS = [
  "okta.groups.read", "okta.groups.manage", "okta.groups.members.manage",
  "okta.users.read", "okta.users.userprofile.manage", "okta.users.lifecycle.manage",
  "okta.apps.read", "okta.apps.manage", "okta.apps.assignment.manage",
];
const STANDARD_ROLES = [
  "GROUP_MEMBERSHIP_ADMIN", "USER_ADMIN", "HELP_DESK_ADMIN", "APP_ADMIN", "READ_ONLY_ADMIN",
];

interface Group { id: string; name: string; type?: string }
interface OktaApp { id: string; label: string; status?: string }
interface AppInfo {
  appId: string; clientId: string; kid: string; privateKeyPem: string; scopes: string[];
  customRoleId?: string; resourceSetId?: string; inScopeGroupIds: string[]; inScopeAppIds: string[];
}
interface Step { step: string; ok: boolean; status?: number; detail?: unknown }
interface Stored { orgUrl: string; apiKey: string; app: AppInfo | null }
interface CallResult {
  at: string; method: string; path: string; stage: string; status: number; ms?: number;
  grantedScope?: unknown; body: unknown;
}

type RoleMode = "none" | "custom" | "standard";

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function Pick({ id, label, sub, checked, onChange }: {
  id: string; label: string; sub?: string; checked: boolean; onChange: () => void;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-muted">
      <Checkbox id={id} checked={checked} onCheckedChange={onChange} />
      <span className="truncate">{label}</span>
      {sub && <span className="font-mono text-[10px] text-muted-foreground">{sub}</span>}
    </label>
  );
}

export default function ServiceAppTesterPage() {
  usePageTracking();

  const [orgUrl, setOrgUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [app, setApp] = useState<AppInfo | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const [groups, setGroups] = useState<Group[]>([]);
  const [apps, setApps] = useState<OktaApp[]>([]);
  const [filter, setFilter] = useState("");

  const [label, setLabel] = useState("");
  const [scopes, setScopes] = useState<string[]>(["okta.groups.read", "okta.groups.manage"]);
  const [roleMode, setRoleMode] = useState<RoleMode>("custom");
  const [permissions, setPermissions] = useState<string[]>(["okta.groups.read", "okta.groups.manage"]);
  const [standardRole, setStandardRole] = useState("GROUP_MEMBERSHIP_ADMIN");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [appIds, setAppIds] = useState<string[]>([]);

  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("");
  const [reqBody, setReqBody] = useState("");
  const [results, setResults] = useState<CallResult[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [busy, setBusy] = useState<"load" | "create" | "call" | "delete" | null>(null);

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

  const post = async (route: string, body: unknown) => {
    const res = await fetch(`/api/service-app/${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ? `${data.error}${data.detail ? ` — ${JSON.stringify(data.detail)}` : ""}` : `HTTP ${res.status}`);
    return data;
  };

  const loadResources = async () => {
    setBusy("load");
    try {
      const data = await post("resources", { orgUrl, apiKey });
      setGroups(data.groups);
      setApps(data.apps);
      toast.success(`Loaded ${data.groups.length} groups and ${data.apps.length} apps.`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  const createApp = async () => {
    setBusy("create");
    try {
      const data = await post("create-app", {
        orgUrl, apiKey, label, scopes, roleMode, permissions, standardRole, groupIds, appIds,
      });
      setSteps(data.steps ?? []);
      setApp({
        appId: data.appId, clientId: data.clientId, kid: data.kid, privateKeyPem: data.privateKeyPem,
        scopes: data.scopes, customRoleId: data.customRoleId, resourceSetId: data.resourceSetId,
        inScopeGroupIds: data.inScopeGroupIds, inScopeAppIds: data.inScopeAppIds,
      });
      const failed = (data.steps as Step[]).filter((s) => !s.ok).length;
      if (failed) toast.warning(`App created, but ${failed} setup step(s) failed — see Setup log.`);
      else toast.success("Service app created.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  const call = async (m = method, p = path, b = reqBody) => {
    if (!app) return;
    setBusy("call");
    try {
      const data = await post("call", {
        orgUrl, method: m, path: p, body: b, scopes: app.scopes,
        clientId: app.clientId, kid: app.kid, privateKeyPem: app.privateKeyPem,
      });
      setResults((r) => [{
        at: new Date().toISOString(), method: m, path: p, stage: data.stage,
        status: data.status, ms: data.ms, grantedScope: data.grantedScope, body: data.body,
      }, ...r]);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  const deleteApp = async () => {
    if (!app) return;
    setBusy("delete");
    try {
      await post("delete-app", {
        orgUrl, apiKey, appId: app.appId, customRoleId: app.customRoleId, resourceSetId: app.resourceSetId,
      });
      setApp(null);
      setSteps([]);
      toast.success("Service app, role and resource set deleted.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  const q = filter.trim().toLowerCase();
  const shownGroups = useMemo(() => groups.filter((g) => g.name.toLowerCase().includes(q)), [groups, q]);
  const shownApps = useMemo(() => apps.filter((a) => a.label.toLowerCase().includes(q)), [apps, q]);

  const inScope = groups.filter((g) => app?.inScopeGroupIds.includes(g.id));
  const outOfScope = groups.filter((g) => app && !app.inScopeGroupIds.includes(g.id));

  const ready = orgUrl.trim() && apiKey.trim();
  const canCreate = ready && scopes.length > 0 && (
    roleMode === "none" ||
    (roleMode === "standard" && !!standardRole) ||
    (roleMode === "custom" && permissions.length > 0 && groupIds.length + appIds.length > 0)
  );

  return (
    <div className="container mx-auto max-w-4xl space-y-6 py-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Service App Permissions Tester</h1>
        <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Creates a temporary Okta client-credentials service app with the scopes and an admin role
          limited to the groups/apps you pick, then calls the Okta API as that app so you can check
          what it can and cannot manage. Details are kept in this browser only.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">1. Okta org</CardTitle>
          <CardDescription>The API key needs to manage apps, roles and resource sets.</CardDescription>
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
          <Button variant="outline" onClick={loadResources} disabled={!ready || !!busy}>
            {busy === "load" ? <Loader2 className="animate-spin" /> : <RefreshCw />} Load groups &amp; apps
          </Button>
        </CardContent>
      </Card>

      {!app ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">2. Configure the service app</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="label">App label (optional)</Label>
              <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>OAuth scopes (granted on the org authorization server)</Label>
              <div className="grid gap-x-4 sm:grid-cols-2">
                {SCOPES.map((s) => (
                  <Pick key={s} id={`sc-${s}`} label={s} checked={scopes.includes(s)} onChange={() => setScopes(toggle(scopes, s))} />
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Admin role</Label>
              <Select value={roleMode} onValueChange={(v) => setRoleMode(v as RoleMode)}>
                <SelectTrigger className="max-w-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom role + resource set</SelectItem>
                  <SelectItem value="standard">Standard role (optionally group-targeted)</SelectItem>
                  <SelectItem value="none">No admin role</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {roleMode === "custom" && (
              <div className="space-y-1.5">
                <Label>Custom role permissions</Label>
                <div className="grid gap-x-4 sm:grid-cols-2">
                  {PERMISSIONS.map((p) => (
                    <Pick key={p} id={`pm-${p}`} label={p} checked={permissions.includes(p)} onChange={() => setPermissions(toggle(permissions, p))} />
                  ))}
                </div>
              </div>
            )}

            {roleMode === "standard" && (
              <div className="space-y-1.5">
                <Label>Standard role type</Label>
                <Select value={standardRole} onValueChange={setStandardRole}>
                  <SelectTrigger className="max-w-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STANDARD_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Groups selected below become role targets. With none selected the role applies org-wide.
                  Standard-role targets are groups only.
                </p>
              </div>
            )}

            {roleMode !== "none" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label>
                    {roleMode === "custom" ? "Resource set contents" : "Target groups"}
                    {" "}({groupIds.length} groups{roleMode === "custom" ? `, ${appIds.length} apps` : ""})
                  </Label>
                  <Input className="h-7 max-w-48 text-xs" placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
                </div>
                {groups.length === 0 && apps.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Click “Load groups &amp; apps” above to list what you can select.</p>
                ) : (
                  <div className={`grid gap-4 ${roleMode === "custom" ? "sm:grid-cols-2" : ""}`}>
                    <div className="max-h-56 overflow-y-auto rounded-md border p-2">
                      <div className="mb-1 text-[11px] font-medium text-muted-foreground">Groups</div>
                      {shownGroups.map((g) => (
                        <Pick key={g.id} id={`g-${g.id}`} label={g.name} sub={g.type} checked={groupIds.includes(g.id)} onChange={() => setGroupIds(toggle(groupIds, g.id))} />
                      ))}
                    </div>
                    {roleMode === "custom" && (
                      <div className="max-h-56 overflow-y-auto rounded-md border p-2">
                        <div className="mb-1 text-[11px] font-medium text-muted-foreground">Apps</div>
                        {shownApps.map((a) => (
                          <Pick key={a.id} id={`a-${a.id}`} label={a.label} sub={a.status} checked={appIds.includes(a.id)} onChange={() => setAppIds(toggle(appIds, a.id))} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <Button onClick={createApp} disabled={!canCreate || !!busy}>
              {busy === "create" ? <Loader2 className="animate-spin" /> : <Plus />} Create service app
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">2. Service app</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3 text-xs">
              <div className="space-y-0.5">
                <div>Client ID: <code className="font-mono">{app.clientId}</code></div>
                <div>App ID: <code className="font-mono">{app.appId}</code></div>
                <div>Scopes: <code className="font-mono">{app.scopes.join(" ") || "—"}</code></div>
                <div>
                  In scope: {app.inScopeGroupIds.length} group(s), {app.inScopeAppIds.length} app(s)
                  {app.resourceSetId ? " (custom role)" : ""}
                </div>
              </div>
              <Button variant="destructive" size="sm" onClick={deleteApp} disabled={!!busy}>
                {busy === "delete" ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete app, role &amp; resource set
              </Button>
            </div>
            {steps.length > 0 && (
              <details className="rounded-md border p-2 text-xs">
                <summary className="cursor-pointer font-medium">
                  Setup log ({steps.filter((s) => s.ok).length}/{steps.length} steps succeeded)
                </summary>
                <div className="mt-2 space-y-1 font-mono">
                  {steps.map((s, i) => (
                    <div key={i}>
                      <span className={s.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                        {s.ok ? "OK" : s.status}
                      </span>{" "}{s.step}
                      {!s.ok && <JsonViewer data={s.detail} />}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {app && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">3. Probe as the app</CardTitle>
            <CardDescription>
              Each call fetches a fresh client-credentials token and sends the request with it.
              Paths must start with <code className="font-mono">/api/v1/</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input className="font-mono text-xs" placeholder="/api/v1/groups" value={path} onChange={(e) => setPath(e.target.value)} />
            </div>
            {method !== "GET" && method !== "DELETE" && (
              <Textarea className="font-mono text-xs" rows={4} placeholder='{"profile":{"name":"renamed"}}' value={reqBody} onChange={(e) => setReqBody(e.target.value)} />
            )}
            <Button onClick={() => call()} disabled={!path.trim() || !!busy}>
              {busy === "call" ? <Loader2 className="animate-spin" /> : <Play />} Send request
            </Button>

            {groups.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {([["Granted groups", inScope], ["Not granted groups", outOfScope]] as const).map(([title, list]) => (
                  <div key={title} className="max-h-48 overflow-y-auto rounded-md border p-2">
                    <div className="mb-1 text-[11px] font-medium text-muted-foreground">{title} — quick GET</div>
                    {list.map((g) => (
                      <button
                        key={g.id}
                        className="block w-full truncate rounded px-1 py-0.5 text-left text-xs hover:bg-muted"
                        disabled={!!busy}
                        onClick={() => { setMethod("GET"); setPath(`/api/v1/groups/${g.id}`); call("GET", `/api/v1/groups/${g.id}`, ""); }}
                      >
                        {g.name}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Logs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {results.map((r, i) => (
              <details key={i} className="rounded-md border p-2 text-xs">
                <summary className="flex cursor-pointer flex-wrap items-center gap-3 font-mono">
                  <span className={r.status >= 200 && r.status < 300 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                    {r.status || "ERR"}
                  </span>
                  <span>{r.method} {r.path}</span>
                  {r.stage === "token" && <span className="text-amber-600">token request failed</span>}
                  {r.ms !== undefined && <span>{r.ms} ms</span>}
                  <span className="text-muted-foreground">{new Date(r.at).toLocaleTimeString()}</span>
                </summary>
                <div className="mt-2 space-y-2">
                  {r.grantedScope !== undefined && <div>Token scope: <code className="font-mono">{String(r.grantedScope)}</code></div>}
                  <JsonViewer data={r.body} />
                </div>
              </details>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
