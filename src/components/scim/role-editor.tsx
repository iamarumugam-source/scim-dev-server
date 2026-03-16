"use client";

import { useState } from "react";
import { ScimRole } from "@/lib/scim/models/scimSchemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Pencil, Save, X, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  role: ScimRole;
  userId: string;
  onUpdate: () => void;
  onDelete: () => void;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{children}</p>
      <Separator />
    </div>
  );
}

export function RoleEditor({ role, userId, onUpdate, onDelete }: Props) {
  const [mode,        setMode]        = useState<"view" | "edit">("view");
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [displayName, setDisplayName] = useState(role.displayName);
  const [description, setDescription] = useState(role.description ?? "");

  const cancel = () => {
    setDisplayName(role.displayName);
    setDescription(role.description ?? "");
    setMode("view");
  };

  const save = async () => {
    if (!displayName.trim()) { toast.error("Display name is required."); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/${userId}/scim/v2/Roles/${role.id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...role, displayName: displayName.trim(), description: description.trim() || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed to update role.");
      toast.success("Role updated.");
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
      const res = await fetch(`/api/${userId}/scim/v2/Roles/${role.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error((await res.json()).detail || "Failed to delete.");
      toast.success("Role deleted.");
      onDelete();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {mode === "edit" ? "Editing role — unsaved changes will be lost on cancel." : "Click Edit to modify this role."}
        </span>
        <div className="flex items-center gap-2">
          {mode === "view" ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setMode("edit")} className="h-7 text-xs gap-1.5">
                <Pencil className="h-3 w-3" /> Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={remove} disabled={deleting}
                className="h-7 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10">
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
        {/* Editable fields */}
        <div className="space-y-3">
          <SectionHeading>Role Info</SectionHeading>
          {(["displayName", "description"] as const).map((field) => {
            const labels:  Record<string, string>              = { displayName: "Display Name", description: "Description" };
            const vals:    Record<string, string>              = { displayName, description };
            const setters: Record<string, (v: string) => void> = { displayName: setDisplayName, description: setDescription };
            return (
              <div key={field} className="min-w-0 space-y-0.5">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {labels[field]}{field === "displayName" && <span className="text-destructive ml-0.5">*</span>}
                </Label>
                {mode === "view" ? (
                  <p className="text-sm font-medium">{vals[field] || <span className="text-muted-foreground/40 font-normal text-xs">—</span>}</p>
                ) : (
                  <Input
                    className="h-7 text-xs"
                    value={vals[field]}
                    onChange={(e) => setters[field](e.target.value)}
                    placeholder={field === "displayName" ? "e.g. Admin" : "Optional description"}
                    maxLength={field === "description" ? 1000 : undefined}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Metadata */}
        <div className="space-y-3">
          <SectionHeading>Metadata</SectionHeading>
          <div className="grid grid-cols-1 gap-1.5">
            {[
              ["ID",            role.id],
              ["Schema",        role.schemas?.[0]],
              ["Created",       role.meta?.created      ? new Date(role.meta.created).toLocaleString()      : undefined],
              ["Last Modified", role.meta?.lastModified ? new Date(role.meta.lastModified).toLocaleString() : undefined],
              ["Version",       role.meta?.version],
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
