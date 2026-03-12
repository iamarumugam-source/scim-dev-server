"use client";

import { useState } from "react";
import { ScimUser } from "@/lib/scim/models/scimSchemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Mail, Pencil, Save, X, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  user: ScimUser;
  userId: string;
  onUpdate: () => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/60 pb-1 mb-2">
      {children}
    </h4>
  );
}

function ReadField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-xs font-mono text-foreground truncate" title={value ?? undefined}>
        {value || <span className="text-muted-foreground/40">—</span>}
      </dd>
    </div>
  );
}

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
    <div className="min-w-0">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">
        {label}
      </label>
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

export function UserEditor({ user, userId, onUpdate }: Props) {
  const [mode,   setMode]   = useState<"view" | "edit">("view");
  const [saving, setSaving] = useState(false);
  const [draft,  setDraft]  = useState<ScimUser>(user);

  const set = (key: keyof ScimUser, value: any) =>
    setDraft((p) => ({ ...p, [key]: value }));

  const setName = (key: keyof NonNullable<ScimUser["name"]>, value: string) =>
    setDraft((p) => ({ ...p, name: { ...p.name, [key]: value } }));

  const setPrimaryEmail = (value: string) =>
    setDraft((p) => ({
      ...p,
      emails: (p.emails || []).map((e) => (e.primary ? { ...e, value } : e)),
    }));

  const startEdit = () => { setDraft({ ...user }); setMode("edit"); };
  const cancel    = () => setMode("view");

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

  const primaryEmail = user.emails?.find((e) => e.primary);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {mode === "edit" ? "Editing user — unsaved changes will be lost on cancel." : "Click Edit to modify this user."}
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
              <EditField label="User Type"    value={draft.userType}    onChange={(v) => set("userType", v)} placeholder="Employee" />
            </div>
          )}
        </div>

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
              <EditField label="Given"   value={draft.name?.givenName}       onChange={(v) => setName("givenName", v)}  placeholder="John" />
              <EditField label="Family"  value={draft.name?.familyName}      onChange={(v) => setName("familyName", v)} placeholder="Doe" />
              <EditField label="Middle"  value={draft.name?.middleName}      onChange={(v) => setName("middleName", v)} placeholder="M." />
              <EditField label="Prefix"  value={draft.name?.honorificPrefix} onChange={(v) => setName("honorificPrefix", v)} placeholder="Mr." />
              <EditField label="Suffix"  value={draft.name?.honorificSuffix} onChange={(v) => setName("honorificSuffix", v)} placeholder="Jr." />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <SectionLabel>Account</SectionLabel>
          {mode === "view" ? (
            <dl className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</dt>
                <dd className="mt-0.5 flex items-center gap-1.5">
                  {user.active
                    ? <><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /><span className="text-xs text-green-700 dark:text-green-400 font-medium">Active</span></>
                    : <><XCircle className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground">Inactive</span></>}
                </dd>
              </div>
              <ReadField label="Title"    value={user.title} />
              <ReadField label="Locale"   value={user.locale} />
              <ReadField label="Timezone" value={user.timezone} />
              <ReadField label="Language" value={user.preferredLanguage} />
            </dl>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2 flex items-center gap-3">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</label>
                <button
                  type="button"
                  onClick={() => set("active", !draft.active)}
                  className={cn(
                    "flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border transition-colors",
                    draft.active
                      ? "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950/40 dark:text-green-400"
                      : "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {draft.active
                    ? <><CheckCircle2 className="h-3 w-3" /> Active</>
                    : <><XCircle className="h-3 w-3" /> Inactive</>}
                </button>
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

        <div className="space-y-2">
          <SectionLabel>Contact</SectionLabel>
          {mode === "view" ? (
            <div className="space-y-1.5">
              {user.emails?.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-mono">
                  <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-foreground truncate">{e.value}</span>
                  <div className="flex gap-1 flex-shrink-0">
                    {e.type && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{e.type}</Badge>}
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
                  {e.type && <span className="text-[10px] flex-shrink-0">({e.type})</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {user.groups && user.groups.length > 0 && (
          <div className="space-y-2">
            <SectionLabel>Group Memberships</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {user.groups.map((g) => (
                <Badge key={g.value} variant="secondary" className="text-xs font-mono">{g.display}</Badge>
              ))}
            </div>
            {mode === "edit" && (
              <p className="text-[11px] text-muted-foreground/60">Manage memberships from the Groups page.</p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <SectionLabel>Meta</SectionLabel>
          <dl className="grid grid-cols-1 gap-2">
            <ReadField label="Resource Type" value={user.meta?.resourceType} />
            <ReadField label="Created"       value={user.meta?.created ? new Date(user.meta.created).toLocaleString() : undefined} />
            <ReadField label="Last Modified" value={user.meta?.lastModified ? new Date(user.meta.lastModified).toLocaleString() : undefined} />
            <ReadField label="Version"       value={user.meta?.version} />
          </dl>
        </div>
      </div>
    </div>
  );
}
