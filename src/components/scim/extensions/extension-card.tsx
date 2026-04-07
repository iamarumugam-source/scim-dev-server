"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Trash2, Plus, Save, Loader2, CheckCircle2, CircleOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

function fieldValue(f: ExtensionField): string {
  if (f.source === "user_prop") return `user.${f.userProp ?? ""}`;
  if (f.source === "random")    return `faker.${f.generator ?? ""}`;
  if (f.source === "static")    return `"${f.staticValue ?? ""}"`;
  if (f.source === "raw_json") {
    if (!f.rawJson?.trim()) return "— empty —";
    try {
      const p = JSON.parse(f.rawJson);
      if (Array.isArray(p))                    return `[ array · ${p.length} item${p.length !== 1 ? "s" : ""} ]`;
      if (typeof p === "object" && p !== null) return `{ object · ${Object.keys(p).length} key${Object.keys(p).length !== 1 ? "s" : ""} }`;
      return String(p);
    } catch { return "⚠ invalid JSON"; }
  }
  return "";
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
        label:   "Delete",
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

  const displayFields = editing ? fields : ext.fields;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 px-3 py-1.5">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 min-w-0 flex-1 justify-start h-7 px-0 hover:bg-transparent"
            >
              {open
                ? <ChevronDown  className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                : <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />}
              <span className="text-xs font-mono font-medium truncate">{ext.schemaUrn}</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0 font-normal">
                {ext.fields.length} field{ext.fields.length !== 1 ? "s" : ""}
              </Badge>
            </Button>
          </CollapsibleTrigger>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Enabled toggle */}
            <Switch
              checked={ext.enabled}
              onCheckedChange={toggleEnabled}
              disabled={toggling || saving}
              aria-label={ext.enabled ? "Disable extension" : "Enable extension"}
              className="scale-90"
            />
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-medium h-4 px-1.5 py-0 gap-1",
                ext.enabled
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-700/50"
                  : "text-muted-foreground dark:border-white/15",
              )}
            >
              {ext.enabled
                ? <CheckCircle2 className="h-2.5 w-2.5" />
                : <CircleOff className="h-2.5 w-2.5" />}
              {ext.enabled ? "Active" : "Disabled"}
            </Badge>

            <Separator orientation="vertical" className="h-4" />

            {/* Edit */}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => { setEditing((p) => !p); setOpen(true); }}
            >
              <Pencil className="h-3 w-3" />
            </Button>

            {/* Delete */}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={remove}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* ── Expanded body ───────────────────────────────────────────────── */}
        <CollapsibleContent>
          <Separator />
          <CardContent className="px-4 py-4 space-y-4">

            {/* Schema URN edit */}
            {editing && (
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Schema URN
                </Label>
                <Input
                  value={urn}
                  onChange={(e) => setUrn(e.target.value)}
                  className="h-7 text-xs font-mono"
                />
              </div>
            )}

            {/* Fields */}
            {displayFields.length === 0 ? (
              <p className="text-xs text-muted-foreground">No fields defined. Add one below.</p>
            ) : editing ? (
              <div className="space-y-2">
                {fields.map((f, i) => (
                  <FieldRow
                    key={f.id}
                    field={f}
                    onChange={(nf) => updateField(i, nf)}
                    onRemove={() => removeField(i)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableBody>
                    {ext.fields.map((f) => (
                      <TableRow key={f.id} className="hover:bg-muted/30">
                        <TableCell className="py-1.5 font-mono text-xs font-semibold text-foreground w-40">
                          {f.name || <span className="text-muted-foreground/50 font-normal">(spread)</span>}
                        </TableCell>
                        <TableCell className="py-1.5 w-24">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{f.type}</Badge>
                        </TableCell>
                        <TableCell className="py-1.5 font-mono text-xs text-muted-foreground">
                          {fieldValue(f)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Editing actions */}
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

          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
