"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Copy, Trash2, Plus, KeyRound, Check } from "lucide-react";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Skeleton } from "./ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
}



function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-7 w-7 flex-shrink-0"
      onClick={() => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard!");
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

export default function ApiKeyManager() {
  const [keys,         setKeys]         = useState<ApiKey[]>([]);
  const [newKeyName,   setNewKeyName]   = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: session } = useSession();
  const userId = session?.user?.id;

  const fetchKeys = async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/${userId}/keys`);
      if (!res.ok) throw new Error("Failed to fetch API keys.");
      setKeys(await res.json());
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { if (userId) fetchKeys(); }, [userId]);

  const handleGenerateKey = async () => {
    if (!newKeyName.trim()) { toast.error("Please enter a name for the API key."); return; }
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/${userId}/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to generate key.");
      }
      const data = await res.json();
      setGeneratedKey(data.rawKey);
      toast.success("API Key generated. Copy it now — it won't be shown again.");
      await fetchKeys();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevokeKey = (keyId: string, keyName: string) => {
    toast(`Delete "${keyName}"?`, {
      description: "This API key will be permanently removed and can no longer be used.",
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            const res = await fetch(`/api/${userId}/keys/${keyId}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to revoke key.");
            toast.success("API key deleted.");
            await fetchKeys();
          } catch (e: any) {
            toast.error(e.message);
          }
        },
      },
      cancel: { label: "Cancel", onClick: () => {} },
    });
  };

  const handleCloseDialog = () => { setNewKeyName(""); setGeneratedKey(null); setIsDialogOpen(false); };
  const handleOpenDialog  = () => { setNewKeyName(""); setGeneratedKey(null); setIsDialogOpen(true); };

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              API Keys
            </h2>
            {!isLoading && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {keys.length} key{keys.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={handleOpenDialog} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> New API Key
              </Button>
            </DialogTrigger>
            <DialogContent
              className="w-[calc(100%-2rem)] sm:max-w-md"
              onInteractOutside={(e) => { if (generatedKey) e.preventDefault(); }}
            >
              <DialogHeader>
                <DialogTitle>Generate New API Key</DialogTitle>
                <DialogDescription>Provide a descriptive name for your new key.</DialogDescription>
              </DialogHeader>

              {generatedKey ? (
                <div className="space-y-3 mt-2">
                  <div className="rounded-md border border-border bg-muted/50 px-3 py-2.5">
                    <p className="text-xs text-foreground/70 font-medium">
                      Copy this key now — it will not be shown again.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2">
                    <code className="flex-1 text-xs font-mono break-all text-foreground">{generatedKey}</code>
                    <CopyButton text={generatedKey} />
                  </div>
                </div>
              ) : (
                <div className="mt-2">
                  <Input
                    placeholder="e.g. 'Okta Production'"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleGenerateKey(); }}
                    disabled={isGenerating}
                  />
                </div>
              )}

              <DialogFooter>
                {generatedKey ? (
                  <Button onClick={handleCloseDialog}>Done</Button>
                ) : (
                  <Button onClick={handleGenerateKey} disabled={isGenerating}>
                    {isGenerating ? "Generating…" : "Generate"}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <Table className="min-w-[480px]">
              <TableHeader className="bg-muted dark:bg-white/[0.04]">
                <TableRow>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Name</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Prefix</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide hidden sm:table-cell">Created</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-7 w-7 rounded-md flex-shrink-0" />
                          <div className="space-y-1.5">
                            <Skeleton className="h-3.5 w-28" />
                            <Skeleton className="h-2.5 w-36" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Skeleton className="h-5 w-20 rounded" /></TableCell>
                      <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell />
                    </TableRow>
                  ))
                ) : keys.length > 0 ? (
                  keys.map((key) => (
                    <TableRow key={key.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground dark:bg-white/[0.08] dark:text-foreground/60">
                            <KeyRound className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{key.name}</p>
                            <p className="text-[11px] text-muted-foreground font-mono truncate">{key.id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="bg-muted text-foreground font-mono text-xs px-2 py-0.5 rounded border border-border/60">
                          {key.key_prefix}…
                        </code>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {new Date(key.created_at).toLocaleDateString(undefined, {
                          year: "numeric", month: "short", day: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon" variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                          onClick={() => handleRevokeKey(key.id, key.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      No API keys yet. Generate one to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>
    </div>
  );
}
