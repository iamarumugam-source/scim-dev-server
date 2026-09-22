"use client";

// ─── Catalogue editor ─────────────────────────────────────────────────────────
//
// Shared expanded-row editor for Entitlements and Roles. The two previous
// editors were 165 and 160 lines differing by 19: identical state, save, delete
// and layout, with `type` present on entitlements only.
//
// Same structure as the user and group editors — identity header, full-width
// detail bands, raw resource behind a collapsible — using the shared primitives
// in detail-bands.tsx so all four views stay identical.

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { JsonViewer } from "@/components/json-viewer";
import { Band, Inline, InlineList, LabelText, Muted, CopyValue } from "@/components/scim/detail-bands";
import { Pencil, Save, X, Loader2, Trash2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CatalogItem {
  id: string;
  displayName: string;
  description?: string;
  type?: string;
  schemas?: readonly string[];
  meta?: { resourceType?: string; created?: string; lastModified?: string; version?: string; location?: string };
}

export function CatalogEditor<T extends CatalogItem>({
  item, userId, resource, noun, icon, tint, hasType, onUpdate, onDelete,
}: {
  item: T;
  userId: string;
  /** SCIM path segment, e.g. "Entitlements". */
  resource: string;
  noun: string;
  icon: ReactNode;
  /** Tint classes for the header tile — matches the row icon in the list. */
  tint: string;
  hasType?: boolean;
  onUpdate: () => void;
  onDelete: () => void;
}) {
  const [mode,        setMode]        = useState<"view" | "edit">("view");
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [displayName, setDisplayName] = useState(item.displayName);
  const [type,        setType]        = useState(item.type ?? "");
  const [description, setDescription] = useState(item.description ?? "");

  const cancel = () => {
    setDisplayName(item.displayName);
    setType(item.type ?? "");
    setDescription(item.description ?? "");
    setMode("view");
  };

  const draft = {
    ...item,
    displayName: displayName.trim() || item.displayName,
    ...(hasType ? { type: type.trim() } : {}),
    description: description.trim() || undefined,
  };

  const save = async () => {
    if (!displayName.trim())        { toast.error("Display name is required."); return; }
    if (hasType && !type.trim())    { toast.error("Type is required.");         return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/${userId}/scim/v2/${resource}/${item.id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(draft),
      });
      if (!res.ok) throw new Error((await res.json()).detail || `Failed to update ${noun}.`);
      toast.success(`${noun[0].toUpperCase()}${noun.slice(1)} updated.`);
      onUpdate();
      setMode("view");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/${userId}/scim/v2/${resource}/${item.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        throw new Error((await res.json()).detail || "Failed to delete.");
      }
      toast.success(`${noun[0].toUpperCase()}${noun.slice(1)} deleted.`);
      setConfirmOpen(false);
      onDelete();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">

      {/* ── Identity header ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-muted/30 px-3.5 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md", tint)}>
            {icon}
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-medium">
                {mode === "edit" ? (displayName || item.displayName) : item.displayName}
              </p>
              {hasType && (mode === "edit" ? type : item.type) && (
                <Badge variant="outline" className="h-5 text-[10px]">
                  {mode === "edit" ? type : item.type}
                </Badge>
              )}
            </div>
            <CopyValue value={item.id} />
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {mode === "view" ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setMode("edit")} className="h-7 gap-1.5 text-xs">
                <Pencil className="h-3 w-3" /> Edit
              </Button>
              {/* Now behind a confirmation. Previously a single click deleted
                  immediately with no undo. */}
              <Button
                size="sm" variant="ghost" onClick={() => setConfirmOpen(true)} disabled={deleting}
                className="h-7 gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </Button>
            </>
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
          resource</strong> — fields cleared here are cleared on the server.
        </p>
      )}

      {/* ── Detail bands ──────────────────────────────────────────────────── */}
      <div className="rounded-lg border">

        <Band label="Name" first>
          {mode === "view" ? (
            <p className="text-sm font-medium">{item.displayName}</p>
          ) : (
            <div className="max-w-sm space-y-0.5">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Display Name <span className="text-destructive">*</span>
              </Label>
              <Input
                className="h-7 text-xs"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={hasType ? "e.g. Read Only Access" : "e.g. Admin"}
              />
            </div>
          )}
        </Band>

        {hasType && (
          <Band label="Type">
            {mode === "view" ? (
              item.type
                ? <Badge variant="outline" className="text-[10px]">{item.type}</Badge>
                : <Muted>Not set.</Muted>
            ) : (
              <div className="max-w-sm space-y-0.5">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Type <span className="text-destructive">*</span>
                </Label>
                <Input
                  className="h-7 text-xs"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  placeholder="e.g. role · permission · license · feature"
                />
              </div>
            )}
          </Band>
        )}

        <Band label="Description">
          {mode === "view" ? (
            item.description
              ? <p className="text-xs leading-relaxed">{item.description}</p>
              : <Muted>No description.</Muted>
          ) : (
            <div className="max-w-xl space-y-0.5">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Description
              </Label>
              <Input
                className="h-7 text-xs"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
          )}
        </Band>

        <Band label="Meta">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <InlineList>
              <Inline label="schema"   value={item.schemas?.[0]} mono />
              <Inline label="type"     value={item.meta?.resourceType} />
              <Inline label="created"  value={item.meta?.created      ? new Date(item.meta.created).toLocaleString()      : undefined} />
              <Inline label="modified" value={item.meta?.lastModified ? new Date(item.meta.lastModified).toLocaleString() : undefined} />
            </InlineList>
            {item.meta?.version && (
              <span className="inline-flex items-baseline gap-1.5">
                <LabelText>etag</LabelText>
                <CopyValue value={item.meta.version} />
              </span>
            )}
            {item.meta?.location && (
              <span className="inline-flex min-w-0 items-baseline gap-1.5">
                <LabelText>location</LabelText>
                <CopyValue value={item.meta.location} className="max-w-[28rem]" />
              </span>
            )}
          </div>
        </Band>

        <Collapsible>
          <CollapsibleTrigger className="group/json flex w-full items-center gap-2 border-t px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/40 hover:text-foreground">
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-data-[state=open]/json:rotate-90" />
            {mode === "edit" ? "Pending resource (unsaved draft)" : "Raw JSON"}
            <span className="ml-auto font-normal normal-case tracking-normal">
              what the service provider receives
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t p-3">
            <JsonViewer data={mode === "edit" ? draft : item} className="max-h-[340px]" />
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* ── Delete confirmation ───────────────────────────────────────────── */}
      <Dialog open={confirmOpen} onOpenChange={(o) => !deleting && setConfirmOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{item.displayName}”?</DialogTitle>
            <DialogDescription>
              Users currently assigned this {noun} keep the reference in their resource
              until the next sync, which will then report it as unknown. This cannot be
              undone.
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
    </div>
  );
}
