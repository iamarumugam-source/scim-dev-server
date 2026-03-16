"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Plus, Loader2, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
        <Card className="border-primary/40">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Add Schema Extension</p>
            <Separator />
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Schema URN
              </Label>
              <Input
                value={newUrn}
                onChange={(e) => setNewUrn(e.target.value)}
                placeholder="urn:ietf:params:scim:schemas:extension:..."
                className="h-8 text-xs font-mono"
                onKeyDown={(e) => { if (e.key === "Enter") createExtension(); }}
              />
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {PRESET_URNS.map((u) => (
                  <Button
                    key={u}
                    variant="outline"
                    size="sm"
                    onClick={() => setNewUrn(u)}
                    className="h-6 text-[10px] px-2 font-mono"
                  >
                    {u.split(":").pop()}
                  </Button>
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
          </CardContent>
        </Card>
      )}

      {/* Extension list */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : extensions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center space-y-2">
            <FlaskConical className="h-8 w-8 mx-auto text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No schema extensions yet</p>
            <p className="text-xs text-muted-foreground/60">
              Create an extension to start adding custom attributes to SCIM user responses.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {extensions.map((ext) => (
            <ExtensionCard key={ext.id} ext={ext} userId={userId!} onRefresh={fetchExtensions} />
          ))}
        </div>
      )}

      <ReferenceCard />
    </div>
  );
}
