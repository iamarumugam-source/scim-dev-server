"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, ToggleLeft, ToggleRight, ChevronDown, ChevronRight, GripVertical, X, Save, Loader2, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SchemaExtension, ExtensionField } from "@/lib/scim/services/extensionService";
import { usePageTracking } from "@/hooks/usePageTracking";

// ─── Constants ────────────────────────────────────────────────────────────────

const FAKER_GENERATORS: { label: string; value: string; category: string }[] = [
  { label: "Job Title",        value: "person.jobTitle",        category: "Person"   },
  { label: "Job Area",         value: "person.jobArea",         category: "Person"   },
  { label: "Job Type",         value: "person.jobType",         category: "Person"   },
  { label: "First Name",       value: "person.firstName",       category: "Person"   },
  { label: "Last Name",        value: "person.lastName",        category: "Person"   },
  { label: "Full Name",        value: "person.fullName",        category: "Person"   },
  { label: "Company Name",     value: "company.name",           category: "Company"  },
  { label: "Department",       value: "commerce.department",    category: "Company"  },
  { label: "Catch Phrase",     value: "company.catchPhrase",    category: "Company"  },
  { label: "City",             value: "location.city",          category: "Location" },
  { label: "Country",          value: "location.country",       category: "Location" },
  { label: "Country Code",     value: "location.countryCode",   category: "Location" },
  { label: "State",            value: "location.state",         category: "Location" },
  { label: "Phone Number",     value: "phone.number",           category: "Contact"  },
  { label: "Currency Code",    value: "finance.currencyCode",   category: "Finance"  },
  { label: "Amount",           value: "finance.amount",         category: "Finance"  },
  { label: "Date (Past)",      value: "date.past",              category: "Date"     },
  { label: "Date (Future)",    value: "date.future",            category: "Date"     },
  { label: "UUID",             value: "string.uuid",            category: "System"   },
  { label: "Word",             value: "lorem.word",             category: "Text"     },
];

const USER_PROPS: { label: string; value: string }[] = [
  { label: "User ID",         value: "id" },
  { label: "Username",        value: "userName" },
  { label: "Display Name",    value: "displayName" },
  { label: "Full Name",       value: "name.formatted" },
  { label: "Given Name",      value: "name.givenName" },
  { label: "Family Name",     value: "name.familyName" },
  { label: "Title",           value: "title" },
  { label: "User Type",       value: "userType" },
  { label: "Locale",          value: "locale" },
  { label: "Timezone",        value: "timezone" },
  { label: "Language",        value: "preferredLanguage" },
  { label: "Primary Email",   value: "emails.0.value" },
  { label: "Active",          value: "active" },
];

const FIELD_TYPES = ["string", "integer", "boolean", "dateTime", "reference", "complex"] as const;

const PRESET_URNS = [
  "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User",
  "urn:ietf:params:scim:schemas:extension:CustomAttributes:1.0:User",
];

// ─── Field editor row ─────────────────────────────────────────────────────────

function FieldRow({
  field,
  onChange,
  onRemove,
}: {
  field: ExtensionField;
  onChange: (f: ExtensionField) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 rounded-md border border-border bg-muted/20 p-3 sm:grid-cols-[auto_1fr_1fr_1fr_auto]">
      <div className="flex items-center text-muted-foreground sm:mt-1">
        <GripVertical className="h-4 w-4" />
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Attribute Name</label>
        <Input
          value={field.name}
          placeholder="e.g. employeeNumber"
          className="h-7 text-xs font-mono"
          onChange={(e) => onChange({ ...field, name: e.target.value })}
        />
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Type</label>
        <select
          value={field.type}
          onChange={(e) => onChange({ ...field, type: e.target.value as ExtensionField["type"] })}
          className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
        >
          {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Source</label>
        <div className="space-y-1">
          <select
            value={field.source}
            onChange={(e) => onChange({ ...field, source: e.target.value as ExtensionField["source"], userProp: undefined, generator: undefined, staticValue: undefined })}
            className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="user_prop">User Property</option>
            <option value="random">Random (Faker)</option>
            <option value="static">Static Value</option>
          </select>

          {field.source === "user_prop" && (
            <select
              value={field.userProp ?? ""}
              onChange={(e) => onChange({ ...field, userProp: e.target.value })}
              className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">— select property —</option>
              {USER_PROPS.map((p) => <option key={p.value} value={p.value}>{p.label} ({p.value})</option>)}
            </select>
          )}

          {field.source === "random" && (
            <select
              value={field.generator ?? ""}
              onChange={(e) => onChange({ ...field, generator: e.target.value })}
              className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">— select generator —</option>
              {FAKER_GENERATORS.map((g) => <option key={g.value} value={g.value}>{g.label} ({g.category})</option>)}
            </select>
          )}

          {field.source === "static" && (
            <Input
              value={String(field.staticValue ?? "")}
              placeholder="Static value"
              className="h-7 text-xs"
              onChange={(e) => onChange({ ...field, staticValue: e.target.value })}
            />
          )}
        </div>
      </div>

      <button onClick={onRemove} className="mt-5 self-start text-muted-foreground hover:text-destructive transition-colors sm:mt-6">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Extension card ───────────────────────────────────────────────────────────

function newField(): ExtensionField {
  return { id: crypto.randomUUID(), name: "", type: "string", source: "user_prop" };
}

function ExtensionCard({
  ext,
  userId,
  onRefresh,
}: {
  ext: SchemaExtension;
  userId: string;
  onRefresh: () => void;
}) {
  const [open,    setOpen]    = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [fields,  setFields]  = useState<ExtensionField[]>(ext.fields);
  const [urn,     setUrn]     = useState(ext.schemaUrn);

  const toggleEnabled = async () => {
    await fetch(`/api/${userId}/scim/v2/extensions/${ext.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !ext.enabled }),
    });
    onRefresh();
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/${userId}/scim/v2/extensions/${ext.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schemaUrn: urn, fields }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Extension saved.");
      setEditing(false);
      onRefresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this extension?")) return;
    await fetch(`/api/${userId}/scim/v2/extensions/${ext.id}`, { method: "DELETE" });
    toast.success("Extension deleted.");
    onRefresh();
  };

  const addField = () => setFields((p) => [...p, newField()]);
  const updateField = (idx: number, f: ExtensionField) =>
    setFields((p) => p.map((x, i) => (i === idx ? f : x)));
  const removeField = (idx: number) =>
    setFields((p) => p.filter((_, i) => i !== idx));

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 gap-3">
        <button
          className="flex items-center gap-2 min-w-0 flex-1 text-left"
          onClick={() => setOpen((p) => !p)}
        >
          {open ? <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}
          <div className="min-w-0">
            <p className="text-sm font-mono font-medium truncate">{ext.schemaUrn}</p>
            <p className="text-[11px] text-muted-foreground">{ext.fields.length} field{ext.fields.length !== 1 ? "s" : ""}</p>
          </div>
        </button>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={toggleEnabled}
            title={ext.enabled ? "Disable" : "Enable"}
            className={cn("transition-colors", ext.enabled ? "text-green-500 hover:text-green-600" : "text-muted-foreground hover:text-foreground")}
          >
            {ext.enabled ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
          </button>
          <Badge variant={ext.enabled ? "default" : "secondary"} className="text-[10px] px-1.5 py-0 h-4">
            {ext.enabled ? "Active" : "Disabled"}
          </Badge>
          <button onClick={() => { setEditing((p) => !p); setOpen(true); }} className="text-muted-foreground hover:text-foreground transition-colors">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={remove} className="text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          {editing && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Schema URN</label>
              <Input value={urn} onChange={(e) => setUrn(e.target.value)} className="h-7 text-xs font-mono" />
            </div>
          )}

          <div className="space-y-2">
            {(editing ? fields : ext.fields).length === 0 ? (
              <p className="text-xs text-muted-foreground">No fields defined. Add one below.</p>
            ) : (editing ? fields : ext.fields).map((f, i) => (
              editing
                ? <FieldRow key={f.id} field={f} onChange={(nf) => updateField(i, nf)} onRemove={() => removeField(i)} />
                : (
                  <div key={f.id} className="flex items-center gap-3 text-xs font-mono py-1 border-b border-border/40 last:border-0">
                    <span className="font-semibold text-foreground w-40 flex-shrink-0 truncate">{f.name}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0">{f.type}</Badge>
                    <span className="text-muted-foreground truncate">
                      {f.source === "user_prop" && `user.${f.userProp}`}
                      {f.source === "random"    && `faker.${f.generator}`}
                      {f.source === "static"    && `"${f.staticValue}"`}
                    </span>
                  </div>
                )
            ))}
          </div>

          {editing && (
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={addField} className="h-7 text-xs gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add Field
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setFields(ext.fields); setUrn(ext.schemaUrn); }} className="h-7 text-xs">
                  Cancel
                </Button>
                <Button size="sm" onClick={save} disabled={saving} className="h-7 text-xs gap-1.5">
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Save
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExtensionsPage() {
  usePageTracking();
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [extensions, setExtensions] = useState<SchemaExtension[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [newUrn,     setNewUrn]     = useState("");
  const [creating,   setCreating]   = useState(false);
  const [showNew,    setShowNew]    = useState(false);

  const fetchExtensions = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/${userId}/scim/v2/extensions`);
      if (!res.ok) throw new Error("Failed to load extensions.");
      setExtensions(await res.json());
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchExtensions(); }, [fetchExtensions]);

  const createExtension = async () => {
    if (!newUrn.trim()) { toast.error("Schema URN is required."); return; }
    setCreating(true);
    try {
      const res = await fetch(`/api/${userId}/scim/v2/extensions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schemaUrn: newUrn.trim(), fields: [], enabled: true }),
      });
      if (!res.ok) throw new Error("Failed to create extension.");
      toast.success("Extension created.");
      setNewUrn("");
      setShowNew(false);
      fetchExtensions();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="container mx-auto py-10 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Schema Extensions</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Configure custom SCIM schema extensions injected into user responses on the fly.
            Values are computed at request time — nothing is stored on the user record.
          </p>
        </div>
        <Button onClick={() => setShowNew((p) => !p)} className="gap-1.5 flex-shrink-0">
          <Plus className="h-4 w-4" /> New Extension
        </Button>
      </div>

      {showNew && (
        <div className="rounded-lg border border-primary/40 bg-card p-4 space-y-3">
          <p className="text-sm font-medium">Add Schema Extension</p>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Schema URN</label>
            <Input
              value={newUrn}
              onChange={(e) => setNewUrn(e.target.value)}
              placeholder="urn:ietf:params:scim:schemas:extension:..."
              className="h-8 text-xs font-mono"
              onKeyDown={(e) => { if (e.key === "Enter") createExtension(); }}
            />
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {PRESET_URNS.map((u) => (
                <button
                  key={u}
                  onClick={() => setNewUrn(u)}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors font-mono"
                >
                  {u.split(":").pop()}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button size="sm" onClick={createExtension} disabled={creating} className="gap-1.5">
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Create
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 rounded-lg border border-border bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : extensions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center space-y-2">
          <FlaskConical className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No schema extensions yet</p>
          <p className="text-xs text-muted-foreground/60">
            Create an extension to start adding custom attributes to SCIM user responses.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {extensions.map((ext) => (
            <ExtensionCard key={ext.id} ext={ext} userId={userId!} onRefresh={fetchExtensions} />
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border bg-muted/20 p-4 text-xs text-muted-foreground space-y-1.5">
        <p className="font-semibold text-foreground">How it works</p>
        <ul className="space-y-1 ml-3 list-disc">
          <li><strong>User Property</strong> — reads a value from the SCIM user object (e.g. <code className="font-mono">title</code>, <code className="font-mono">name.formatted</code>)</li>
          <li><strong>Random (Faker)</strong> — generates a fresh random value on every API call using Faker.js</li>
          <li><strong>Static</strong> — returns the exact value you configure, every time</li>
          <li>Enabled extensions are cached for 30 seconds and applied as an interceptor — they never modify stored data</li>
        </ul>
      </div>
    </div>
  );
}
