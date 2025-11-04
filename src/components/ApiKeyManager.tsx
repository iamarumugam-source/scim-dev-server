"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Copy, Trash2, PlusCircle } from "lucide-react";

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

export default function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const apiEndpoint = `https://okta-scim.vercel.app/api/${userId}/scim/v2`;

  const fetchKeys = async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/${userId}/keys`);
      if (!res.ok) throw new Error("Failed to fetch API keys.");
      const data = await res.json();
      setKeys(data);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchKeys();
    }
  }, [userId]);

  const handleGenerateKey = async () => {
    if (!newKeyName.trim()) {
      toast.error("Please enter a name for the API key.");
      return;
    }
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/${userId}/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to generate key.");
      }
      const data = await res.json();
      setGeneratedKey(data.rawKey);
      toast.success("API Key generated successfully! Please copy it now.");
      await fetchKeys();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm("Are you sure? This will permanently delete the API key.")) {
      return;
    }
    try {
      const res = await fetch(`/api/${userId}/keys/${keyId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to revoke key.");
      toast.success("API Key revoked successfully.");
      await fetchKeys();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleCloseDialog = () => {
    setNewKeyName("");
    setGeneratedKey(null);
    setIsDialogOpen(false);
  };

  const handleOpenDialog = () => {
    setNewKeyName("");
    setGeneratedKey(null);
    setIsDialogOpen(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  return (
    <>
      {isLoading ? (
        <LoadingScreen />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 p-4 border rounded-lg">
            <div>
              <h3 className="font-medium">Your SCIM Endpoint</h3>
              <div className="flex items-center gap-2 p-2 mt-2 bg-muted rounded-md border text-sm">
                <code className="flex-1 font-mono">{apiEndpoint}</code>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => copyToClipboard(apiEndpoint)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={handleOpenDialog}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground dark:text-sidebar-accent-foreground 
                  dark:hover:text-sidebar-accent-foreground dark:active:text-sidebar-accent-foreground
                  min-w-8 duration-200 ease-linear"
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Generate New Key
                </Button>
              </DialogTrigger>
              <DialogContent
                className="sm:max-w-[425px]"
                onInteractOutside={(e) => {
                  if (generatedKey) e.preventDefault();
                }}
              >
                <DialogHeader>
                  <DialogTitle>Generate New API Key</DialogTitle>
                  <DialogDescription>
                    Provide a descriptive name for your new key.
                  </DialogDescription>
                </DialogHeader>
                {generatedKey ? (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      Please copy this key now. You will not be able to see it
                      again.
                    </p>
                    <div className="flex items-center gap-2 p-2 bg-muted rounded-md border">
                      <code className="flex-1 font-mono text-sm break-all">
                        {generatedKey}
                      </code>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground dark:text-sidebar-accent-foreground 
                  dark:hover:text-sidebar-accent-foreground dark:active:text-sidebar-accent-foreground
                  min-w-8 duration-200 ease-linear"
                        onClick={() => copyToClipboard(generatedKey)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 py-4">
                    <Input
                      id="name"
                      placeholder="e.g., 'Third-Party App'"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      disabled={isGenerating}
                    />
                  </div>
                )}
                <DialogFooter>
                  {generatedKey ? (
                    <Button onClick={handleCloseDialog}>Close</Button>
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
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key Prefix</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.length > 0 ? (
                  keys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell>
                        <code>{key.key_prefix}...</code>
                      </TableCell>
                      <TableCell>
                        {new Date(key.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRevokeKey(key.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      No API keys found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </>
  );
}
