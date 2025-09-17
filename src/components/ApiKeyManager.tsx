"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { LoadingSpinner } from "./helper-components";
import { Copy, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";

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
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const fetchKeys = async () => {
    setIsLoading(true);
    try {
      if (!userId) return;
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
    fetchKeys();
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
      setNewKeyName("");
      await fetchKeys();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (
      !confirm(
        "Are you sure you want to revoke this API key? This action cannot be undone."
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/${userId}/keys/${keyId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to revoke key.");
      }
      toast.success("API Key revoked successfully.");
      await fetchKeys();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Key copied to clipboard!");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generate New API Key</CardTitle>
          <CardDescription>
            Create a new API key to grant access to the SCIM endpoints.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Descriptive name (e.g., 'Third-Party App')"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              disabled={isGenerating}
            />
            <Button onClick={handleGenerateKey} disabled={isGenerating}>
              {isGenerating ? "Generating..." : "Generate Key"}
            </Button>
          </div>
          {generatedKey && (
            <div className="mt-4 p-4 bg-green-100 dark:bg-green-900/50 border border-green-400 rounded-lg">
              <h4 className="font-semibold text-green-800 dark:text-green-300">
                New API Key Generated
              </h4>
              <p className="text-sm text-muted-foreground my-2">
                Please copy this key and store it securely. You will not be able
                to see it again.
              </p>
              <div className="flex items-center gap-2 p-2 bg-background rounded-md">
                <code className="flex-1 font-mono text-sm">{generatedKey}</code>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => copyToClipboard(generatedKey)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing API Keys</CardTitle>
          <CardDescription>Manage your existing API keys.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key Prefix</TableHead>
                  <TableHead>Created At</TableHead>
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
                    <TableCell colSpan={4} className="text-center">
                      No API keys have been generated yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
