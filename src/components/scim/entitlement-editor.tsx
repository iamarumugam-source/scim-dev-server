"use client";

import { useState } from "react";
import { ScimEntitlement } from "@/lib/scim/models/scimSchemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Save, X, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  entitlement: ScimEntitlement;
  userId: string;
  onUpdate: () => void;
  onDelete: () => void;
}

export function EntitlementEditor({ entitlement, userId, onUpdate, onDelete }: Props) {
  const [mode,        setMode]        = useState<"view" | "edit">("view");
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [displayName, setDisplayName] = useState(entitlement.displayName);
  const [type,        setType]        = useState(entitlement.type);
  const [description, setDescription] = useState(entitlement.description ?? "");

  const cancel = () => {
    setDisplayName(entitlement.displayName);
    setType(entitlement.type);
    setDescription(entitlement.description ?? "");
    setMode("view");
  };

  const save = async () => {
    if (!displayName.trim()) { toast.error("Display name is required."); return; }
    if (!type.trim())        { toast.error("Type is required.");         return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/${userId}/scim/v2/Entitlements/${entitlement.id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...entitlement, displayName: displayName.trim(), type: type.trim(), description: description.trim() || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed to update entitlement.");
      toast.success("Entitlement updated.");
      onUpdate();
      setMode("view");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/${userId}/scim/v2/Entitlements/${entitlement.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error((await res.json()).detail || "Failed to delete.");
      toast.success("Entitlement deleted.");
      onDelete();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {mode === "edit" ? "Editing entitlement — unsaved changes will be lost on cancel." : "Click Edit to modify this entitlement."}
        </span>
        <div className="flex items-center gap-2">
          {mode === "view" ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setMode("edit")} className="h-7 text-xs gap-1.5">
                <Pencil className="h-3 w-3" /> Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={remove}
                disabled={deleting}
                className="h-7 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                Delete
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={cancel} disabled={saving} className="h-7 text-xs gap-1.5">
                <X className="h-3 w-3" /> Cancel
              </Button>
              <Button size="sm" onClick={save} disabled={saving} className="h-7 text-xs gap-1.5">
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {/* Left — editable fields */}
        <div className="space-y-3">
          <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/60 pb-1">
            Entitlement Info
          </h4>

          {(["displayName", "type", "description"] as const).map((field) => {
            const labels: Record<string, string> = { displayName: "Display Name", type: "Type", description: "Description" };
            const vals: Record<string, string>   = { displayName, type, description };
            const setters: Record<string, (v: string) => void> = { displayName: setDisplayName, type: setType, description: setDescription };
            return (
              <div key={field} className="min-w-0">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">
                  {labels[field]}{(field === "displayName" || field === "type") && <span className="text-destructive ml-0.5">*</span>}
                </label>
                {mode === "view" ? (
                  <p className="text-sm font-medium">{vals[field] || <span className="text-muted-foreground/40 font-normal text-xs">—</span>}</p>
                ) : (
                  <Input
                    className="h-7 text-xs"
                    value={vals[field]}
                    onChange={(e) => setters[field](e.target.value)}
                    placeholder={field === "displayName" ? "e.g. Read Only Access" : field === "type" ? "e.g. role" : "Optional description"}
                    maxLength={field === "description" ? 1000 : undefined}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Right — metadata */}
        <div className="space-y-3">
          <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/60 pb-1">
            Metadata
          </h4>
          <div className="grid grid-cols-1 gap-1.5">
            {[
              ["ID",            entitlement.id],
              ["Schema",        entitlement.schemas?.[0]],
              ["Resource Type", entitlement.meta?.resourceType],
              ["Created",       entitlement.meta?.created ? new Date(entitlement.meta.created).toLocaleString() : undefined],
              ["Last Modified", entitlement.meta?.lastModified ? new Date(entitlement.meta.lastModified).toLocaleString() : undefined],
              ["Version",       entitlement.meta?.version],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 text-xs font-mono text-foreground truncate">
                  {value || <span className="text-muted-foreground/40">—</span>}
                </dd>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
