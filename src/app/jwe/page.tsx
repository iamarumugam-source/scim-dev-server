"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { JweEmptyState } from "@/components/jwe/jwe-empty-state";
import { JweResultView } from "@/components/jwe/jwe-result-view";
import { toast } from "sonner";
import { Lock, KeyRound, FileJson, AlertCircle, Loader2 } from "lucide-react";

interface DecryptResult {
  type:        "JWE" | "JWT";
  jweHeader?:  Record<string, unknown>;
  header?:     Record<string, unknown>;
  payload?:    unknown;
  raw?:        string;
  innerIsJwt?: boolean;
}

export default function JwePage() {
  const [keyInput,    setKeyInput]    = useState("");
  const [tokenInput,  setTokenInput]  = useState("");
  const [isDecoding,  setIsDecoding]  = useState(false);
  const [result,      setResult]      = useState<DecryptResult | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);

  const handleDecode = async () => {
    setIsDecoding(true);
    setResult(null);
    setDecodeError(null);

    try {
      if (!tokenInput.trim()) throw new Error("Token cannot be empty.");

      let parsedKey: unknown = undefined;
      if (keyInput.trim()) {
        try {
          parsedKey = JSON.parse(keyInput.trim());
        } catch {
          throw new Error("Key must be valid JSON (JWK or JWKS format).");
        }
      }

      const res = await fetch("/api/jwe", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token: tokenInput.trim(), key: parsedKey }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Decoding failed.");

      setResult(data as DecryptResult);
      toast.success(data.type === "JWE" ? "JWE decrypted successfully" : "JWT decoded successfully");
    } catch (e: any) {
      setDecodeError(e.message);
      toast.error(e.message);
    } finally {
      setIsDecoding(false);
    }
  };

  return (
    <div className="flex gap-4 p-4 h-[calc(100vh-var(--header-height))]">
      {/* ── Input panel ───────────────────────────────────────────────────── */}
      <div className="flex flex-col w-1/2 gap-3 min-h-0">
        {/* Key input */}
        <div className="flex flex-col flex-1 rounded-lg border border-border overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/40 flex-shrink-0">
            <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold">Private / Symmetric Key</span>
            <span className="ml-auto text-[10px] text-muted-foreground">JWK or JWKS · optional for plain JWT</span>
          </div>
          <Textarea
            placeholder={'Paste a JWK, JWKS, or leave empty for plain JWT\n\n{"kty":"RSA","d":"...","n":"...",...}\n{"keys":[{...},{...}]}'}
            className="flex-1 rounded-none border-none resize-none font-mono text-xs focus-visible:ring-0"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
          />
        </div>

        {/* Token input */}
        <div className="flex flex-col flex-1 rounded-lg border border-border overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/40 flex-shrink-0">
            <FileJson className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold">Token</span>
            <span className="ml-auto text-[10px] text-muted-foreground">JWE (5 parts) or JWT (3 parts)</span>
          </div>
          <Textarea
            placeholder="eyJhbGciOiJSU0EtT0FFUC0yNTYiLCJlbmMiOiJBMjU2R0NNIn0..."
            className="flex-1 rounded-none border-none resize-none font-mono text-xs focus-visible:ring-0"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
          />
        </div>

        <Button onClick={handleDecode} disabled={isDecoding} className="ml-auto gap-1.5">
          {isDecoding && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {isDecoding ? "Decoding…" : "Decode"}
        </Button>
      </div>

      {/* ── Output panel ──────────────────────────────────────────────────── */}
      <div className="flex flex-col w-1/2 rounded-lg border border-border overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/40 flex-shrink-0">
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold">Decoded Output</span>
        </div>

        {decodeError ? (
          <div className="p-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{decodeError}</AlertDescription>
            </Alert>
          </div>
        ) : result ? (
          <JweResultView result={result} />
        ) : (
          <JweEmptyState />
        )}
      </div>
    </div>
  );
}
