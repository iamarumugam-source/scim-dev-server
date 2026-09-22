"use client";

import { useState, useCallback } from "react";
import { ScimUser, ScimEntitlement, ScimRole } from "@/lib/scim/models/scimSchemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { JsonViewer } from "@/components/json-viewer";
import { UserAvatar } from "@/components/scim/user-avatar";
import { Band, Inline, InlineList, LabelText, Muted, CopyValue } from "@/components/scim/detail-bands";
import {
  Mail, Pencil, Save, X, Loader2, CheckCircle2, XCircle, BadgeCheck, Crown,
  Plus, Boxes, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  user: ScimUser;
  userId: string;
  onUpdate: () => void;
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

  // ── Derived display values ────────────────────────────────────────────────
  const shown    = mode === "edit" ? draft : user;

  const groupCount = user.groups?.length ?? 0;
  const entCount   = (mode === "edit" ? draft.entitlements : user.entitlements)?.length ?? 0;
  const roleCount  = (mode === "edit" ? draft.roles        : user.roles)?.length ?? 0;


  return (
    <div className="space-y-3">

      {/* ── Identity header ───────────────────────────────────────────────── */}
      {/* Repeats who you are looking at: the expanded row can be tall enough
          that the collapsed row scrolls out of view. */}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-muted/30 px-3.5 py-3">
        <div className="flex min-w-0 items-start gap-3">
          {/* Same hashed tint and radius as the collapsed row, so expanding a
              row does not change the user's colour out from under you. */}
          <UserAvatar user={shown} size="lg" className="flex-shrink-0" />
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-mono text-sm font-medium">{shown.userName}</p>
              {shown.active ? (
                <Badge variant="outline" className="h-5 gap-1 border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950/40 dark:text-green-400">
                  <CheckCircle2 className="h-3 w-3" /> Active
                </Badge>
              ) : (
                <Badge variant="outline" className="h-5 gap-1 text-muted-foreground">
                  <XCircle className="h-3 w-3" /> Inactive
                </Badge>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {[shown.displayName || shown.name?.formatted, shown.title].filter(Boolean).join(" · ") || "—"}
            </p>
            <CopyValue value={user.id} />
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {mode === "view" ? (
            <Button size="sm" variant="outline" onClick={startEdit} className="h-7 gap-1.5 text-xs">
              <Pencil className="h-3 w-3" /> Edit
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={cancel} disabled={saving} className="h-7 gap-1.5 text-xs">
                <X className="h-3 w-3" /> Cancel
              </Button>
              <Button size="sm" onClick={save} disabled={saving} className="h-7 gap-1.5 text-xs">
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      {mode === "edit" && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Unsaved changes are lost on cancel. Saving issues a SCIM{" "}
          <code className="font-mono">PUT</code>, which <strong>replaces the whole
          resource</strong> — attributes cleared here are cleared on the server.
        </p>
      )}

      {/* ── Detail bands ──────────────────────────────────────────────────── */}
      {/* Deliberately NOT tabs. The expanded row exists to take in a whole user
          at a glance; putting attributes behind tab clicks defeats that. The
          original problem was a 3-column grid whose wildly different section
          heights read as ragged and unrelated — full-width bands fix that while
          keeping everything on screen, scanning cleanly top-to-bottom.
          Only the raw JSON is collapsed, because it is bulky and secondary. */}
      <div className="rounded-lg border">

        <Band label="Identity" first>
          {mode === "view" ? (
            <InlineList>
              <Inline label="user"     value={user.userName} mono />
              <Inline label="display"  value={user.displayName} />
              <Inline label="type"     value={user.userType} />
              <Inline label="nickname" value={user.nickName} />
            </InlineList>
          ) : (
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <EditField label="Username"     value={draft.userName}    readOnly />
              <EditField label="Display Name" value={draft.displayName} onChange={(v) => set("displayName", v)} placeholder="John Doe" />
              <EditField label="User Type"    value={draft.userType}    onChange={(v) => set("userType", v)}    placeholder="Employee" />
              <EditField label="Nickname"     value={draft.nickName}    onChange={(v) => set("nickName", v)}    placeholder="Johnny" />
            </div>
          )}
        </Band>

        <Band label="Name">
          {mode === "view" ? (
            <InlineList>
              <Inline label="formatted" value={user.name?.formatted} />
              <Inline label="given"     value={user.name?.givenName} />
              <Inline label="family"    value={user.name?.familyName} />
              <Inline label="middle"    value={user.name?.middleName} />
              <Inline label="prefix"    value={user.name?.honorificPrefix} />
              <Inline label="suffix"    value={user.name?.honorificSuffix} />
            </InlineList>
          ) : (
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
              <EditField label="Formatted" value={draft.name?.formatted}       onChange={(v) => setName("formatted", v)}       placeholder="John M. Doe" />
              <EditField label="Given"     value={draft.name?.givenName}       onChange={(v) => setName("givenName", v)}       placeholder="John" />
              <EditField label="Family"    value={draft.name?.familyName}      onChange={(v) => setName("familyName", v)}      placeholder="Doe" />
              <EditField label="Middle"    value={draft.name?.middleName}      onChange={(v) => setName("middleName", v)}      placeholder="M." />
              <EditField label="Prefix"    value={draft.name?.honorificPrefix} onChange={(v) => setName("honorificPrefix", v)} placeholder="Mr." />
              <EditField label="Suffix"    value={draft.name?.honorificSuffix} onChange={(v) => setName("honorificSuffix", v)} placeholder="Jr." />
            </div>
          )}
        </Band>

        <Band label="Account">
          {mode === "view" ? (
            <InlineList>
              <Inline label="title"    value={user.title} />
              <Inline label="locale"   value={user.locale} mono />
              <Inline label="timezone" value={user.timezone} mono />
              <Inline label="language" value={user.preferredLanguage} mono />
            </InlineList>
          ) : (
            <div className="space-y-2">
              <div className="flex w-fit items-center gap-3 rounded-md border px-2.5 py-1.5">
                <Switch
                  id={`active-${user.id}`}
                  checked={draft.active}
                  onCheckedChange={(v) => set("active", v)}
                />
                <Label htmlFor={`active-${user.id}`} className="text-xs font-normal">
                  {draft.active ? "Active" : "Inactive"}
                </Label>
                <span className="text-[10px] text-muted-foreground">Okta deactivation maps here</span>
              </div>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <EditField label="Title"    value={draft.title}             onChange={(v) => set("title", v)}             placeholder="Software Engineer" />
                <EditField label="Locale"   value={draft.locale}            onChange={(v) => set("locale", v)}            placeholder="en-US" />
                <EditField label="Timezone" value={draft.timezone}          onChange={(v) => set("timezone", v)}          placeholder="America/New_York" />
                <EditField label="Language" value={draft.preferredLanguage} onChange={(v) => set("preferredLanguage", v)} placeholder="en" />
              </div>
            </div>
          )}
        </Band>

        <Band label="Email">
          {mode === "view" ? (
            <div className="flex flex-wrap gap-1.5">
              {user.emails?.map((e, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs">
                  <Mail className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                  <span className="font-mono">{e.value}</span>
                  {e.primary && <Badge variant="secondary" className="h-4 px-1 py-0 text-[9px]">primary</Badge>}
                  {e.type && <span className="text-[10px] text-muted-foreground">{e.type}</span>}
                </span>
              ))}
              {!user.emails?.length && <Muted>No email addresses.</Muted>}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="max-w-sm">
                <EditField
                  label="Primary Email"
                  value={draft.emails?.find((e) => e.primary)?.value}
                  onChange={setPrimaryEmail}
                  placeholder="user@example.com"
                />
              </div>
              {(draft.emails || []).filter((e) => !e.primary).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {(draft.emails || []).filter((e) => !e.primary).map((e, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <span className="font-mono">{e.value}</span>
                      {e.type && <span className="text-[10px]">{e.type}</span>}
                    </span>
                  ))}
                  <Muted>Secondary addresses come from the IdP and are read-only.</Muted>
                </div>
              )}
            </div>
          )}
        </Band>

        <Band label={`Groups${groupCount ? ` (${groupCount})` : ""}`}>
          <div className="flex flex-wrap items-center gap-1.5">
            {user.groups?.map((g) => (
              <Badge key={g.value} variant="secondary" className="gap-1 font-mono text-xs">
                <Boxes className="h-3 w-3" />
                {g.display ?? g.value}
              </Badge>
            ))}
            {groupCount === 0 && <Muted>No memberships.</Muted>}
            {mode === "edit" && <Muted>Managed from the Groups page.</Muted>}
          </div>
        </Band>

        <Band label={`Entitlements${entCount ? ` (${entCount})` : ""}`}>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {(mode === "edit" ? draft.entitlements : user.entitlements ?? [])?.map((e) => (
                <Badge
                  key={e.value}
                  variant="outline"
                  className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                >
                  <BadgeCheck className="h-3 w-3" />
                  {e.display ?? e.value}
                  {e.type && <span className="opacity-60">· {e.type}</span>}
                  {mode === "edit" && (
                    <button
                      onClick={() => removeEntitlement(e.value)}
                      aria-label={`Remove ${e.display ?? e.value}`}
                      className="ml-0.5 rounded hover:text-destructive"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </Badge>
              ))}
              {entCount === 0 && mode !== "edit" && <Muted>None assigned.</Muted>}
            </div>

            {mode === "edit" && (
              <div className="relative max-w-sm">
                <Input
                  className="h-7 text-xs"
                  placeholder={loadingCatalog ? "Loading…" : "Search entitlements to assign…"}
                  value={entitlementSearch}
                  disabled={loadingCatalog}
                  onChange={(e) => setEntitlementSearch(e.target.value)}
                />
                {filteredEntitlements.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-md">
                    {filteredEntitlements.map((e) => (
                      <Button
                        key={e.id}
                        variant="ghost"
                        className="h-auto w-full justify-start gap-2 rounded-none px-3 py-1.5 text-xs"
                        onMouseDown={() => addEntitlement(e)}
                      >
                        <BadgeCheck className="h-3 w-3 flex-shrink-0 text-emerald-500" />
                        <span className="flex-1 truncate text-left font-medium">{e.displayName}</span>
                        <span className="flex-shrink-0 text-[10px] text-muted-foreground">{e.type}</span>
                        <Plus className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Band>

        <Band label={`Roles${roleCount ? ` (${roleCount})` : ""}`}>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {(mode === "edit" ? draft.roles : user.roles ?? [])?.map((r) => (
                <Badge
                  key={r.value}
                  variant="outline"
                  className="gap-1 border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
                >
                  <Crown className="h-3 w-3" />
                  {r.display ?? r.value}
                  {mode === "edit" && (
                    <button
                      onClick={() => removeRole(r.value)}
                      aria-label={`Remove ${r.display ?? r.value}`}
                      className="ml-0.5 rounded hover:text-destructive"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </Badge>
              ))}
              {roleCount === 0 && mode !== "edit" && <Muted>None assigned.</Muted>}
            </div>

            {mode === "edit" && (
              <div className="relative max-w-sm">
                <Input
                  className="h-7 text-xs"
                  placeholder={loadingCatalog ? "Loading…" : "Search roles to assign…"}
                  value={roleSearch}
                  disabled={loadingCatalog}
                  onChange={(e) => setRoleSearch(e.target.value)}
                />
                {filteredRoles.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-md">
                    {filteredRoles.map((r) => (
                      <Button
                        key={r.id}
                        variant="ghost"
                        className="h-auto w-full justify-start gap-2 rounded-none px-3 py-1.5 text-xs"
                        onMouseDown={() => addRole(r)}
                      >
                        <Crown className="h-3 w-3 flex-shrink-0 text-rose-500" />
                        <span className="flex-1 truncate text-left font-medium">{r.displayName}</span>
                        <Plus className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Band>

        <Band label="Meta">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <Inline label="created"  value={user.meta?.created      ? new Date(user.meta.created).toLocaleString()      : undefined} />
            <Inline label="modified" value={user.meta?.lastModified ? new Date(user.meta.lastModified).toLocaleString() : undefined} />
            {user.meta?.version && (
              <span className="inline-flex items-baseline gap-1.5">
                <LabelText>etag</LabelText>
                <CopyValue value={user.meta.version} />
              </span>
            )}
            {user.meta?.location && (
              <span className="inline-flex min-w-0 items-baseline gap-1.5">
                <LabelText>location</LabelText>
                <CopyValue value={user.meta.location} className="max-w-[28rem]" />
              </span>
            )}
          </div>
        </Band>

        {/* Raw resource — the only thing hidden by default, because it is bulky
            and secondary. In edit mode it shows the DRAFT, so you can read the
            exact body a Save would PUT before committing to it. */}
        <Collapsible>
          <CollapsibleTrigger className="group/json flex w-full items-center gap-2 border-t px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/40 hover:text-foreground">
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-data-[state=open]/json:rotate-90" />
            {mode === "edit" ? "Pending resource (unsaved draft)" : "Raw JSON"}
            <span className="ml-auto font-normal normal-case tracking-normal">
              what the service provider receives
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t p-3">
            <JsonViewer data={mode === "edit" ? draft : user} className="max-h-[340px]" />
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
