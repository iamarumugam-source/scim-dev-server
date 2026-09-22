"use client";

// ─── Extension card ───────────────────────────────────────────────────────────
//
// What was wrong with the previous version, and what each change fixes:
//
//   • Identity was the raw URN alone — a long mono string, truncated. Two
//     extensions were indistinguishable at a glance. Now a readable name is
//     derived from the URN's last meaningful segment, with the full URN as
//     secondary copyable text.
//   • "3 fields" said nothing about WHICH attributes get injected — the one thing
//     you actually want when scanning. Attribute-name chips now show in the
//     collapsed header.
//   • A Switch AND an Active/Disabled badge sat side by side saying the same
//     thing, so it was unclear which was the control. One Switch with a plain
//     text label now.
//   • Edit/Delete were unlabelled icon buttons. They now carry aria-labels and
//     titles.
//   • Only the button area toggled the row; empty header space did nothing. The
//     whole header is the trigger now, with actions stopping propagation.
//   • Delete confirmed via a toast action — transient, so it vanished if you
//     hesitated, and inconsistent with every other destructive action here. Now
//     a Dialog, like the rest.
//   • Nothing showed the resulting JSON shape. For a feature whose entire job is
//     shaping a user response, that was the missing piece: there is now an output
//     preview built from the field definitions.

import { useState } from "react";
import {
  ChevronRight, Pencil, Trash2, Plus, Save, Loader2, X, Braces, FlaskConical,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { JsonViewer } from "@/components/json-viewer";
import { Band, CopyValue } from "@/components/scim/detail-bands";
import {
  Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@/components/ui/empty";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
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

/**
 * A readable label from a schema URN. URNs end with the meaningful part, so the
 * last segment that is not a bare version number is the best short name:
 *   urn:…:extension:enterprise:2.0:User  ->  "enterprise · User"
 */
function urnLabel(urn: string): string {
  const parts = urn.split(":").filter(Boolean);
  const meaningful = parts.filter((p) => !/^\d+(\.\d+)*$/.test(p));
  const tail = meaningful.slice(-2);
  return tail.length ? tail.join(" · ") : urn;
}

function sourceLabel(f: ExtensionField): string {
  switch (f.source) {
    case "user_prop": return "User property";
    case "random":    return "Faker";
    case "static":    return "Static";
    case "raw_json":  return "Raw JSON";
    default:          return f.source;
  }
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

/** True when a raw_json field is present but unparseable — surfaced up front. */
function fieldError(f: ExtensionField): string | null {
  if (f.source !== "raw_json" || !f.rawJson?.trim()) return null;
  try { JSON.parse(f.rawJson); return null; } catch { return "invalid JSON"; }
}

/**
 * The shape this extension adds to a user response. Values are placeholders
 * describing their source rather than resolved data — resolution happens
 * server-side per request, so the honest thing to show is the shape and where
 * each value will come from.
 */
function previewShape(fields: ExtensionField[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    let value: unknown;
    if (f.source === "user_prop")   value = `<user.${f.userProp ?? "…"}>`;
    else if (f.source === "random") value = `<faker.${f.generator ?? "…"}>`;
    else if (f.source === "static") value = f.staticValue ?? null;
    else if (f.source === "raw_json") {
      try { value = f.rawJson?.trim() ? JSON.parse(f.rawJson) : null; }
      catch { value = "⚠ invalid JSON"; }
    }
    if (f.multiValued && !Array.isArray(value)) value = [value];

    // An unnamed raw_json object spreads its keys into the extension root —
    // that is the documented "spread mode", not a mistake.
    if (!f.name.trim()) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        Object.assign(out, value as Record<string, unknown>);
      }
      continue;
    }
    out[f.name] = value;
  }
  return out;
}

export function ExtensionCard({ ext, userId, onRefresh }: Props) {
  const [open,        setOpen]        = useState(false);
  const [editing,     setEditing]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [toggling,    setToggling]    = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fields,      setFields]      = useState<ExtensionField[]>(ext.fields);
  const [urn,         setUrn]         = useState(ext.schemaUrn);

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
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setToggling(false);
    }
  };

  const startEdit = () => { setFields(ext.fields); setUrn(ext.schemaUrn); setEditing(true); setOpen(true); };
  const cancelEdit = () => { setFields(ext.fields); setUrn(ext.schemaUrn); setEditing(false); };

  const save = async () => {
    const bad = fields.filter(fieldError);
    if (bad.length) {
      toast.error(`${bad.length} field${bad.length === 1 ? " has" : "s have"} invalid JSON.`);
      return;
    }
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
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/${userId}/scim/v2/extensions/${ext.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete extension.");
      toast.success("Extension deleted.");
      setConfirmOpen(false);
      onRefresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const addField    = () => setFields((p) => [...p, newField()]);
  const updateField = (idx: number, f: ExtensionField) =>
    setFields((p) => p.map((x, i) => (i === idx ? f : x)));
  const removeField = (idx: number) =>
    setFields((p) => p.filter((_, i) => i !== idx));

  const displayFields = editing ? fields : ext.fields;
  const shownUrn      = editing ? urn : ext.schemaUrn;
  const errorCount    = displayFields.filter(fieldError).length;
  const named         = displayFields.filter((f) => f.name.trim());
  const spreadCount   = displayFields.length - named.length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className={cn("gap-0 overflow-hidden p-0", !ext.enabled && "bg-muted/30")}>

        {/* ── Header (collapsed view) ─────────────────────────────────────── */}
        {/* The whole row toggles; the controls on the right stop propagation. */}
        <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
          <CollapsibleTrigger asChild>
            <button
              className="group/hdr flex min-w-0 flex-1 items-center gap-2.5 text-left"
              aria-label={`${open ? "Collapse" : "Expand"} ${urnLabel(shownUrn)}`}
            >
              <ChevronRight className={cn(
                "h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-transform duration-150",
                open && "rotate-90",
              )} />
              <span className={cn(
                "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md",
                ext.enabled
                  ? "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
                  : "bg-muted text-muted-foreground",
              )}>
                <FlaskConical className="h-3.5 w-3.5" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className={cn(
                    "truncate text-sm font-medium",
                    !ext.enabled && "text-muted-foreground",
                  )}>
                    {urnLabel(shownUrn)}
                  </span>
                  <Badge variant="secondary" className="h-4 flex-shrink-0 px-1.5 py-0 text-[10px] font-normal tabular-nums">
                    {displayFields.length} field{displayFields.length !== 1 ? "s" : ""}
                  </Badge>
                  {errorCount > 0 && (
                    <Badge variant="destructive" className="h-4 flex-shrink-0 px-1.5 py-0 text-[10px]">
                      {errorCount} invalid
                    </Badge>
                  )}
                </span>
                <span className="block truncate font-mono text-[10px] text-muted-foreground" title={shownUrn}>
                  {shownUrn}
                </span>
              </span>
            </button>
          </CollapsibleTrigger>

          {/* Attribute chips — the "what does this actually inject" answer,
              previously only visible after expanding. */}
          {named.length > 0 && (
            <div className="hidden min-w-0 flex-wrap items-center gap-1 lg:flex">
              {named.slice(0, 3).map((f) => (
                <code
                  key={f.id}
                  className="max-w-[9rem] truncate rounded border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                  title={`${f.name} — ${fieldValue(f)}`}
                >
                  {f.name}
                </code>
              ))}
              {named.length > 3 && (
                <span className="text-[10px] text-muted-foreground">+{named.length - 3}</span>
              )}
            </div>
          )}

          <div className="flex flex-shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {editing ? (
              <>
                <Button size="sm" variant="outline" onClick={cancelEdit} disabled={saving} className="h-7 gap-1.5 text-xs">
                  <X className="h-3 w-3" /> Cancel
                </Button>
                <Button size="sm" onClick={save} disabled={saving} className="h-7 gap-1.5 text-xs">
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Save
                </Button>
              </>
            ) : (
              <>
                {/* One control for state, with a plain text label. Previously a
                    Switch and a status Badge both showed the same thing. */}
                <div className="flex items-center gap-1.5">
                  <Switch
                    checked={ext.enabled}
                    onCheckedChange={toggleEnabled}
                    disabled={toggling}
                    aria-label={ext.enabled ? "Disable extension" : "Enable extension"}
                    className="scale-90"
                  />
                  <span className={cn(
                    "w-12 text-[11px]",
                    ext.enabled ? "font-medium text-foreground" : "text-muted-foreground",
                  )}>
                    {toggling ? "…" : ext.enabled ? "Active" : "Off"}
                  </span>
                </div>

                <Button
                  variant="ghost" size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={startEdit}
                  aria-label="Edit extension" title="Edit extension"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirmOpen(true)}
                  aria-label="Delete extension" title="Delete extension"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ── Expanded body ──────────────────────────────────────────────────── */}
        <CollapsibleContent>
          <CardContent className="border-t p-0">

            <Band label="Schema URN" first>
              {editing ? (
                <Input
                  value={urn}
                  onChange={(e) => setUrn(e.target.value)}
                  className="h-7 max-w-xl text-xs font-mono"
                />
              ) : (
                <CopyValue value={ext.schemaUrn} className="text-xs" />
              )}
            </Band>

            <Band label={`Fields${displayFields.length ? ` (${displayFields.length})` : ""}`}>
              {displayFields.length === 0 ? (
                <Empty className="border-0 py-6">
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><Plus className="h-4 w-4" /></EmptyMedia>
                    <EmptyTitle className="text-sm">No fields defined</EmptyTitle>
                    <EmptyDescription className="text-xs">
                      Add a field to start injecting attributes under this schema URN.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
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
                // Column headers: previously three unlabelled columns that you
                // had to decode by inspection.
                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="h-7 text-[10px] font-semibold uppercase tracking-wide">Attribute</TableHead>
                        <TableHead className="h-7 w-24 text-[10px] font-semibold uppercase tracking-wide">Type</TableHead>
                        <TableHead className="h-7 w-28 text-[10px] font-semibold uppercase tracking-wide">Source</TableHead>
                        <TableHead className="h-7 text-[10px] font-semibold uppercase tracking-wide">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayFields.map((f) => {
                        const err = fieldError(f);
                        return (
                          <TableRow key={f.id} className="hover:bg-muted/30">
                            <TableCell className="py-1.5 font-mono text-xs font-medium">
                              {f.name || (
                                <span className="font-sans font-normal text-muted-foreground" title="An unnamed raw-JSON object merges its keys into the extension root">
                                  (spread)
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="py-1.5">
                              <Badge variant="outline" className="h-4 px-1.5 py-0 text-[10px]">
                                {f.type}{f.multiValued ? "[]" : ""}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-1.5 text-[11px] text-muted-foreground">
                              {sourceLabel(f)}
                            </TableCell>
                            <TableCell className={cn(
                              "py-1.5 font-mono text-xs",
                              err ? "text-destructive" : "text-muted-foreground",
                            )}>
                              {fieldValue(f)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {spreadCount > 0 && !editing && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {spreadCount} unnamed raw-JSON field{spreadCount === 1 ? "" : "s"} merge their
                  keys directly into the extension root rather than nesting under a name.
                </p>
              )}

              {editing && (
                <Button size="sm" variant="outline" onClick={addField} className="mt-2 h-7 gap-1.5 text-xs">
                  <Plus className="h-3.5 w-3.5" /> Add field
                </Button>
              )}
            </Band>

            {/* The payoff band: what this actually adds to a user response. */}
            <Band label="Output preview">
              {displayFields.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing is injected yet.</p>
              ) : (
                <div className="space-y-1.5">
                  <JsonViewer
                    data={{ [shownUrn]: previewShape(displayFields) }}
                    className="max-h-[260px]"
                  />
                  <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                    <Braces className="mt-0.5 h-3 w-3 flex-shrink-0" />
                    Shape only — <code className="font-mono">&lt;user.*&gt;</code> and{" "}
                    <code className="font-mono">&lt;faker.*&gt;</code> placeholders are resolved
                    per request on the server, so real responses carry actual values here.
                  </p>
                </div>
              )}
            </Band>
          </CardContent>
        </CollapsibleContent>
      </Card>

      {/* ── Delete confirmation ─────────────────────────────────────────────── */}
      {/* A Dialog rather than the previous toast action, which disappeared if you
          hesitated and was inconsistent with every other destructive action. */}
      <Dialog open={confirmOpen} onOpenChange={(o) => !deleting && setConfirmOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this extension?</DialogTitle>
            <DialogDescription>
              <code className="font-mono text-xs">{ext.schemaUrn}</code> and its{" "}
              {ext.fields.length} field{ext.fields.length === 1 ? "" : "s"} will be removed.
              User responses stop including these attributes immediately. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" className="gap-1.5" onClick={remove} disabled={deleting}>
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Collapsible>
  );
}
