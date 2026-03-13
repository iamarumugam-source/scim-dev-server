"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Trash2, Plus, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { SchemaExtension, ExtensionField } from "@/lib/scim/services/extensionService";
import { FieldRow } from "./field-row";

export function newField(): ExtensionField {
  return { id: crypto.randomUUID(), name: "", type: "string", source: "user_prop" };
}

interface Props {
  ext:       SchemaExtension;
  userId:    string;
  onRefresh: () => void;
}

export function ExtensionCard({ ext, userId, onRefresh }: Props) {
  const [open,     setOpen]     = useState(false);
  const [editing,  setEditing]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [toggling, setToggling] = useState(false);
  const [fields,   setFields]   = useState<ExtensionField[]>(ext.fields);
  const [urn,      setUrn]      = useState(ext.schemaUrn);

  const toggleEnabled = async (newValue: boolean) => {
    if (toggling) return;
    setToggling(true);
    try {
      const res = await fetch(`/api/${userId}/scim/v2/extensions/${ext.id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ enabled: newValue }),
      });
      if (!res.ok) throw new Error("Failed to update extension.");
      onRefresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setToggling(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/${userId}/scim/v2/extensions/${ext.id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ schemaUrn: urn, fields }),
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
    toast("Delete this extension?", {
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            const res = await fetch(`/api/${userId}/scim/v2/extensions/${ext.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete extension.");
            toast.success("Extension deleted.");
            onRefresh();
          } catch (e: any) {
            toast.error(e.message);
          }
        },
      },
      cancel: { label: "Cancel", onClick: () => {} },
    });
  };

  const addField    = () => setFields((p) => [...p, newField()]);
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
          {open
            ? <ChevronDown  className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}
          <div className="min-w-0">
            <p className="text-sm font-mono font-medium truncate">{ext.schemaUrn}</p>
            <p className="text-[11px] text-muted-foreground">
              {ext.fields.length} field{ext.fields.length !== 1 ? "s" : ""}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Switch
              checked={ext.enabled}
              onCheckedChange={toggleEnabled}
              disabled={toggling || saving}
              aria-label={ext.enabled ? "Disable extension" : "Enable extension"}
            />
            <span className={cn(
              "text-xs font-medium select-none",
              ext.enabled ? "text-green-600 dark:text-green-400" : "text-muted-foreground",
            )}>
              {ext.enabled ? "Active" : "Disabled"}
            </span>
          </div>
          <button
            onClick={() => { setEditing((p) => !p); setOpen(true); }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
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
              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Schema URN
              </label>
              <Input
                value={urn}
                onChange={(e) => setUrn(e.target.value)}
                className="h-7 text-xs font-mono"
              />
            </div>
          )}

          <div className="space-y-2">
            {(editing ? fields : ext.fields).length === 0 ? (
              <p className="text-xs text-muted-foreground">No fields defined. Add one below.</p>
            ) : (editing ? fields : ext.fields).map((f, i) =>
              editing ? (
                <FieldRow
                  key={f.id}
                  field={f}
                  onChange={(nf) => updateField(i, nf)}
                  onRemove={() => removeField(i)}
                />
              ) : (
                <div key={f.id} className="flex items-center gap-3 text-xs font-mono py-1 border-b border-border/40 last:border-0">
                  <span className="font-semibold text-foreground w-40 flex-shrink-0 truncate">{f.name}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0">{f.type}</Badge>
                  <span className="text-muted-foreground truncate">
                    {f.source === "user_prop" && `user.${f.userProp}`}
                    {f.source === "random"    && `faker.${f.generator}`}
                    {f.source === "static"    && `"${f.staticValue}"`}
                    {f.source === "raw_json"  && (() => {
                      if (!f.rawJson?.trim()) return "— empty —";
                      try {
                        const p = JSON.parse(f.rawJson);
                        return Array.isArray(p)
                          ? `[ array · ${p.length} item${p.length !== 1 ? "s" : ""} ]`
                          : typeof p === "object" && p !== null
                            ? `{ object · ${Object.keys(p).length} key${Object.keys(p as object).length !== 1 ? "s" : ""} }`
                            : String(p);
                      } catch { return "⚠ invalid JSON"; }
                    })()}
                  </span>
                </div>
              )
            )}
          </div>

          {editing && (
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={addField} className="h-7 text-xs gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add Field
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setEditing(false); setFields(ext.fields); setUrn(ext.schemaUrn); }}
                  className="h-7 text-xs"
                >
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
