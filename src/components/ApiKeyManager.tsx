"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Copy, Trash2, PlusCircle, KeyRound, Check } from "lucide-react";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
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
import { LoadingSpinner } from "./helper-components";
import { LoadingScreen } from "./LoadingScreen";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
}

const KEY_COLORS = [
  "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  "bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400",
  "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
  "bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400",
  "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400",
];

function keyColor(id: string) {
  const hash = Array.from(id).reduce((a, c) => a + c.charCodeAt(0), 0);
  return KEY_COLORS[hash % KEY_COLORS.length];
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
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
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
      cancel: {
        label: "Cancel",
        onClick: () => {},
      },
    });
  };

  const handleCloseDialog = () => { setNewKeyName(""); setGeneratedKey(null); setIsDialogOpen(false); };
  const handleOpenDialog  = () => { setNewKeyName(""); setGeneratedKey(null); setIsDialogOpen(true); };

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="space-y-6">
      {/* API Keys — header + generate button + table */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              API Keys
            </h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {keys.length} key{keys.length !== 1 ? "s" : ""}
            </span>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={handleOpenDialog} className="gap-1.5">
                <PlusCircle className="h-3.5 w-3.5" /> Generate New Key
              </Button>
            </DialogTrigger>
            <DialogContent
              className="w-[calc(100%-2rem)] sm:max-w-md"
              onInteractOutside={(e) => { if (generatedKey) e.preventDefault(); }}
            >
              <DialogHeader>
                <DialogTitle>Generate New API Key</DialogTitle>
                <DialogDescription>
                  Provide a descriptive name for your new key.
                </DialogDescription>
              </DialogHeader>

              {generatedKey ? (
                <div className="space-y-3 mt-2">
                  <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2.5">
                    <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                      Copy this key now — it will not be shown again.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2">
                    <code className="flex-1 text-xs font-mono break-all text-foreground">
                      {generatedKey}
                    </code>
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
                    {isGenerating ? <LoadingSpinner /> : "Generate"}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <Table className="min-w-[480px]">
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Name</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Prefix</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide hidden sm:table-cell">Created</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.length > 0 ? (
                  keys.map((key) => (
                    <TableRow key={key.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md ${keyColor(key.id)}`}>
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
                          size="icon"
                          variant="ghost"
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
