"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Plus, Loader2, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePageTracking } from "@/hooks/usePageTracking";
import { JsonTemplateConverter } from "@/components/scim/json-template-converter";
import { ExtensionCard } from "@/components/scim/extensions/extension-card";
import { ReferenceCard } from "@/components/scim/extensions/reference-card";
import { PRESET_URNS } from "@/components/scim/extensions/constants";
import type { SchemaExtension } from "@/lib/scim/services/extensionService";

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
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ schemaUrn: newUrn.trim(), fields: [], enabled: true }),
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
    <div className="container mx-auto py-6 space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Configure custom SCIM schema extensions injected into user responses on the fly.
          Values are computed at request time — nothing is stored on the user record.
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <JsonTemplateConverter />
          <Button onClick={() => setShowNew((p) => !p)} className="gap-1.5">
            <Plus className="h-4 w-4" /> New Extension
          </Button>
        </div>
      </div>

      {/* New extension form */}
      {showNew && (
        <div className="rounded-lg border border-primary/40 bg-card p-4 space-y-3">
          <p className="text-sm font-medium">Add Schema Extension</p>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Schema URN
            </label>
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

      {/* Extension list */}
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

      {/* Reference card */}
      <ReferenceCard />
    </div>
  );
}
