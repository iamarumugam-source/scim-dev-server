"use client";

import { useState, useCallback } from "react";
import { ScimUser, ScimEntitlement, ScimRole } from "@/lib/scim/models/scimSchemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Mail, Pencil, Save, X, Loader2, CheckCircle2, XCircle, BadgeCheck, Crown, Plus } from "lucide-react";
import { toast } from "sonner";

interface Props {
  user: ScimUser;
  userId: string;
  onUpdate: () => void;
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
        {children}
      </p>
      <Separator />
    </div>
  );
}

// ─── Read-only field ──────────────────────────────────────────────────────────

function ReadField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xs font-mono text-foreground truncate" title={value ?? undefined}>
        {value || <span className="text-muted-foreground/40">—</span>}
      </p>
    </div>
  );
}

// ─── Editable field ───────────────────────────────────────────────────────────

function EditField({
  label,
  value,
  onChange,
  placeholder,
  readOnly,
}: {
  label: string;
  value?: string | null;
  onChange?: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-0.5">
      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {readOnly ? (
        <p className="text-xs font-mono text-muted-foreground truncate py-1" title={value ?? undefined}>
          {value || "—"}
        </p>
      ) : (
        <Input
          className="h-7 text-xs font-mono"
          value={value || ""}
          placeholder={placeholder}
          onChange={(e) => onChange?.(e.target.value)}
        />
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function UserEditor({ user, userId, onUpdate }: Props) {
  const [mode,              setMode]              = useState<"view" | "edit">("view");
  const [saving,            setSaving]            = useState(false);
  const [draft,             setDraft]             = useState<ScimUser>(user);
  const [allEntitlements,   setAllEntitlements]   = useState<ScimEntitlement[]>([]);
  const [allRoles,          setAllRoles]          = useState<ScimRole[]>([]);
  const [loadingCatalog,    setLoadingCatalog]    = useState(false);
  const [entitlementSearch, setEntitlementSearch] = useState("");
  const [roleSearch,        setRoleSearch]        = useState("");

  const set = (key: keyof ScimUser, value: any) =>
    setDraft((p) => ({ ...p, [key]: value }));

  const setName = (key: keyof NonNullable<ScimUser["name"]>, value: string) =>
    setDraft((p) => ({ ...p, name: { ...p.name, [key]: value } }));

  const setPrimaryEmail = (value: string) =>
    setDraft((p) => ({
      ...p,
      emails: (p.emails || []).map((e) => (e.primary ? { ...e, value } : e)),
    }));

  const loadCatalog = useCallback(async () => {
    if (allEntitlements.length > 0 || allRoles.length > 0) return;
    setLoadingCatalog(true);
    try {
      const [entRes, roleRes] = await Promise.all([
        fetch(`/api/${userId}/scim/v2/Entitlements?startIndex=1&count=200`),
        fetch(`/api/${userId}/scim/v2/Roles?startIndex=1&count=200`),
      ]);
      if (entRes.ok)  setAllEntitlements((await entRes.json()).Resources  ?? []);
      if (roleRes.ok) setAllRoles((await roleRes.json()).Resources ?? []);
    } finally {
      setLoadingCatalog(false);
    }
  }, [userId, allEntitlements.length, allRoles.length]);

  const startEdit = () => { setDraft({ ...user }); setMode("edit"); loadCatalog(); };
  const cancel    = () => { setMode("view"); setEntitlementSearch(""); setRoleSearch(""); };

  const addEntitlement = (e: ScimEntitlement) => {
    if ((draft.entitlements ?? []).some((x) => x.value === e.id)) return;
    set("entitlements", [...(draft.entitlements ?? []), { value: e.id, display: e.displayName, type: e.type }]);
    setEntitlementSearch("");
  };

  const removeEntitlement = (id: string) =>
    set("entitlements", (draft.entitlements ?? []).filter((x) => x.value !== id));

  const addRole = (r: ScimRole) => {
    if ((draft.roles ?? []).some((x) => x.value === r.id)) return;
    set("roles", [...(draft.roles ?? []), { value: r.id, display: r.displayName }]);
    setRoleSearch("");
  };

  const removeRole = (id: string) =>
    set("roles", (draft.roles ?? []).filter((x) => x.value !== id));

  const assignedEntIds  = new Set((draft.entitlements ?? []).map((e) => e.value));
  const assignedRoleIds = new Set((draft.roles        ?? []).map((r) => r.value));

  const filteredEntitlements = entitlementSearch.trim().length > 0
    ? allEntitlements.filter((e) =>
        !assignedEntIds.has(e.id) &&
        (e.displayName.toLowerCase().includes(entitlementSearch.toLowerCase()) ||
         e.type.toLowerCase().includes(entitlementSearch.toLowerCase()))
      ).slice(0, 6)
    : [];

  const filteredRoles = roleSearch.trim().length > 0
    ? allRoles.filter((r) =>
        !assignedRoleIds.has(r.id) &&
        r.displayName.toLowerCase().includes(roleSearch.toLowerCase())
      ).slice(0, 6)
    : [];

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/${userId}/scim/v2/Users/${user.id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(draft),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed to update user.");
      toast.success("User updated successfully.");
      onUpdate();
      setMode("view");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {mode === "edit"
            ? "Editing user — unsaved changes will be lost on cancel."
            : "Click Edit to modify this user."}
        </span>
        {mode === "view" ? (
          <Button size="sm" variant="outline" onClick={startEdit} className="h-7 text-xs gap-1.5">
            <Pencil className="h-3 w-3" /> Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={cancel} disabled={saving} className="h-7 text-xs gap-1.5">
              <X className="h-3 w-3" /> Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={saving} className="h-7 text-xs gap-1.5">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">

        {/* ── Identity ──────────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <SectionLabel>Identity</SectionLabel>
          {mode === "view" ? (
            <dl className="grid grid-cols-1 gap-2">
              <ReadField label="ID"           value={user.id} />
              <ReadField label="Username"     value={user.userName} />
              <ReadField label="Display Name" value={user.displayName} />
              <ReadField label="User Type"    value={user.userType} />
            </dl>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              <EditField label="ID"           value={draft.id}          readOnly />
              <EditField label="Username"     value={draft.userName}    readOnly />
              <EditField label="Display Name" value={draft.displayName} onChange={(v) => set("displayName", v)} placeholder="John Doe" />
              <EditField label="User Type"    value={draft.userType}    onChange={(v) => set("userType", v)}    placeholder="Employee" />
            </div>
          )}
        </div>

        {/* ── Name ──────────────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <SectionLabel>Name</SectionLabel>
          {mode === "view" ? (
            <dl className="grid grid-cols-2 gap-2">
              <ReadField label="Formatted" value={user.name?.formatted} />
              <ReadField label="Given"     value={user.name?.givenName} />
              <ReadField label="Family"    value={user.name?.familyName} />
              <ReadField label="Middle"    value={user.name?.middleName} />
              <ReadField label="Prefix"    value={user.name?.honorificPrefix} />
              <ReadField label="Suffix"    value={user.name?.honorificSuffix} />
            </dl>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <EditField label="Formatted" value={draft.name?.formatted} onChange={(v) => setName("formatted", v)} placeholder="John M. Doe" />
              </div>
              <EditField label="Given"  value={draft.name?.givenName}       onChange={(v) => setName("givenName", v)}       placeholder="John" />
              <EditField label="Family" value={draft.name?.familyName}      onChange={(v) => setName("familyName", v)}      placeholder="Doe" />
              <EditField label="Middle" value={draft.name?.middleName}      onChange={(v) => setName("middleName", v)}      placeholder="M." />
              <EditField label="Prefix" value={draft.name?.honorificPrefix} onChange={(v) => setName("honorificPrefix", v)} placeholder="Mr." />
              <EditField label="Suffix" value={draft.name?.honorificSuffix} onChange={(v) => setName("honorificSuffix", v)} placeholder="Jr." />
            </div>
          )}
        </div>

        {/* ── Account ───────────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <SectionLabel>Account</SectionLabel>
          {mode === "view" ? (
            <dl className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Status</p>
                {user.active ? (
                  <Badge variant="outline" className="gap-1 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/40">
                    <CheckCircle2 className="h-3 w-3" /> Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-muted-foreground">
                    <XCircle className="h-3 w-3" /> Inactive
                  </Badge>
                )}
              </div>
              <ReadField label="Title"    value={user.title} />
              <ReadField label="Locale"   value={user.locale} />
              <ReadField label="Timezone" value={user.timezone} />
              <ReadField label="Language" value={user.preferredLanguage} />
            </dl>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2 flex items-center gap-3">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Active
                </Label>
                <Switch
                  checked={draft.active}
                  onCheckedChange={(v) => set("active", v)}
                />
                <span className="text-xs text-muted-foreground">
                  {draft.active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="col-span-2">
                <EditField label="Title" value={draft.title} onChange={(v) => set("title", v)} placeholder="Software Engineer" />
              </div>
              <EditField label="Locale"   value={draft.locale}            onChange={(v) => set("locale", v)}            placeholder="en-US" />
              <EditField label="Timezone" value={draft.timezone}          onChange={(v) => set("timezone", v)}          placeholder="America/New_York" />
              <EditField label="Language" value={draft.preferredLanguage} onChange={(v) => set("preferredLanguage", v)} placeholder="en" />
            </div>
          )}
        </div>

        {/* ── Contact ───────────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <SectionLabel>Contact</SectionLabel>
          {mode === "view" ? (
            <div className="space-y-1.5">
              {user.emails?.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-mono">
                  <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-foreground truncate">{e.value}</span>
                  <div className="flex gap-1 flex-shrink-0">
                    {e.type    && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{e.type}</Badge>}
                    {e.primary && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">primary</Badge>}
                  </div>
                </div>
              ))}
              {(!user.emails || user.emails.length === 0) && (
                <span className="text-xs text-muted-foreground/40 font-mono">No emails</span>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <EditField
                label="Primary Email"
                value={draft.emails?.find((e) => e.primary)?.value}
                onChange={setPrimaryEmail}
                placeholder="user@example.com"
              />
              {(draft.emails || []).filter((e) => !e.primary).map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                  <Mail className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{e.value}</span>
                  {e.type && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0">{e.type}</Badge>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Group memberships ─────────────────────────────────────────────── */}
        {user.groups && user.groups.length > 0 && (
          <div className="space-y-2">
            <SectionLabel>Group Memberships</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {user.groups.map((g) => (
                <Badge key={g.value} variant="secondary" className="text-xs font-mono">
                  {g.display}
                </Badge>
              ))}
            </div>
            {mode === "edit" && (
              <p className="text-[11px] text-muted-foreground/60">Manage memberships from the Groups page.</p>
            )}
          </div>
        )}

        {/* ── Entitlements ──────────────────────────────────────────────────── */}
        {(mode === "edit" || (draft.entitlements && draft.entitlements.length > 0)) && (
          <div className="space-y-2">
            <SectionLabel>Entitlements</SectionLabel>

            <div className="flex flex-wrap gap-1.5 min-h-[24px]">
              {(mode === "edit" ? draft.entitlements : user.entitlements ?? [])?.map((e) => (
                <Badge
                  key={e.value}
                  variant="outline"
                  className="gap-1 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40"
                >
                  <BadgeCheck className="h-3 w-3" />
                  {e.display ?? e.value}
                  {e.type && <span className="opacity-60">· {e.type}</span>}
                  {mode === "edit" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-3 w-3 ml-0.5 p-0 hover:bg-transparent hover:text-destructive"
                      onClick={() => removeEntitlement(e.value)}
                    >
                      <X className="h-2.5 w-2.5" />
                    </Button>
                  )}
                </Badge>
              ))}
              {!(mode === "edit" ? draft.entitlements : user.entitlements ?? [])?.length && mode !== "edit" && (
                <span className="text-xs text-muted-foreground/40">None assigned.</span>
              )}
            </div>

            {mode === "edit" && (
              <div className="relative">
                <Input
                  className="h-7 text-xs"
                  placeholder={loadingCatalog ? "Loading…" : "Search entitlements to assign…"}
                  value={entitlementSearch}
                  disabled={loadingCatalog}
                  onChange={(e) => setEntitlementSearch(e.target.value)}
                />
                {filteredEntitlements.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md overflow-hidden">
                    {filteredEntitlements.map((e) => (
                      <Button
                        key={e.id}
                        variant="ghost"
                        className="w-full justify-start h-auto px-3 py-1.5 text-xs rounded-none gap-2"
                        onMouseDown={() => addEntitlement(e)}
                      >
                        <BadgeCheck className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                        <span className="flex-1 font-medium truncate text-left">{e.displayName}</span>
                        <span className="text-muted-foreground text-[10px] flex-shrink-0">{e.type}</span>
                        <Plus className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Roles ─────────────────────────────────────────────────────────── */}
        {(mode === "edit" || (draft.roles && draft.roles.length > 0)) && (
          <div className="space-y-2">
            <SectionLabel>Roles</SectionLabel>

            <div className="flex flex-wrap gap-1.5 min-h-[24px]">
              {(mode === "edit" ? draft.roles : user.roles ?? [])?.map((r) => (
                <Badge
                  key={r.value}
                  variant="outline"
                  className="gap-1 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40"
                >
                  <Crown className="h-3 w-3" />
                  {r.display ?? r.value}
                  {mode === "edit" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-3 w-3 ml-0.5 p-0 hover:bg-transparent hover:text-destructive"
                      onClick={() => removeRole(r.value)}
                    >
                      <X className="h-2.5 w-2.5" />
                    </Button>
                  )}
                </Badge>
              ))}
              {!(mode === "edit" ? draft.roles : user.roles ?? [])?.length && mode !== "edit" && (
                <span className="text-xs text-muted-foreground/40">None assigned.</span>
              )}
            </div>

            {mode === "edit" && (
              <div className="relative">
                <Input
                  className="h-7 text-xs"
                  placeholder={loadingCatalog ? "Loading…" : "Search roles to assign…"}
                  value={roleSearch}
                  disabled={loadingCatalog}
                  onChange={(e) => setRoleSearch(e.target.value)}
                />
                {filteredRoles.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md overflow-hidden">
                    {filteredRoles.map((r) => (
                      <Button
                        key={r.id}
                        variant="ghost"
                        className="w-full justify-start h-auto px-3 py-1.5 text-xs rounded-none gap-2"
                        onMouseDown={() => addRole(r)}
                      >
                        <Crown className="h-3 w-3 text-rose-500 flex-shrink-0" />
                        <span className="flex-1 font-medium truncate text-left">{r.displayName}</span>
                        <Plus className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Meta ──────────────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <SectionLabel>Meta</SectionLabel>
          <dl className="grid grid-cols-1 gap-2">
            <ReadField label="Resource Type" value={user.meta?.resourceType} />
            <ReadField label="Created"       value={user.meta?.created       ? new Date(user.meta.created).toLocaleString()       : undefined} />
            <ReadField label="Last Modified" value={user.meta?.lastModified  ? new Date(user.meta.lastModified).toLocaleString()  : undefined} />
            <ReadField label="Version"       value={user.meta?.version} />
          </dl>
        </div>

      </div>
    </div>
  );
}
