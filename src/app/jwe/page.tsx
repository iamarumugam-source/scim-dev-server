"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { JweEmptyState } from "@/components/jwe/jwe-empty-state";
import { JweResultView } from "@/components/jwe/jwe-result-view";
import { toast } from "sonner";
import { Lock, KeyRound, FileJson, AlertCircle, Loader2 } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
    <div
      className="flex gap-4 p-4"
      style={{ height: "calc(100dvh - var(--header-height) - 2rem)" }}
    >
      {/* ── Input panel ───────────────────────────────────────────────────── */}
      <div className="flex flex-col w-1/2 gap-4 min-h-0">

        {/* Key input */}
        <Card className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <CardHeader className="flex-shrink-0">
            <CardTitle className="text-sm font-medium">Private / Symmetric Key</CardTitle>
            <CardDescription>JWK or JWKS · optional for plain JWT</CardDescription>
            <CardAction>
              <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                <KeyRound className="h-4 w-4 text-foreground/60" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 p-0 overflow-hidden">
            <Textarea
              placeholder={'Paste a JWK, JWKS, or leave empty for plain JWT\n\n{"kty":"RSA","d":"...","n":"...",...}\n{"keys":[{...},{...}]}'}
              className="h-full rounded-none border-0 resize-none font-mono text-xs focus-visible:ring-0"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Token input */}
        <Card className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <CardHeader className="flex-shrink-0">
            <CardTitle className="text-sm font-medium">Token</CardTitle>
            <CardDescription>JWE (5 parts) or JWT (3 parts)</CardDescription>
            <CardAction>
              <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                <FileJson className="h-4 w-4 text-foreground/60" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 p-0 overflow-hidden">
            <Textarea
              placeholder="eyJhbGciOiJSU0EtT0FFUC0yNTYiLCJlbmMiOiJBMjU2R0NNIn0..."
              className="h-full rounded-none border-0 resize-none font-mono text-xs focus-visible:ring-0"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
            />
          </CardContent>
        </Card>

        <Button onClick={handleDecode} disabled={isDecoding} className="ml-auto gap-1.5">
          {isDecoding && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {isDecoding ? "Decoding…" : "Decode"}
        </Button>
      </div>

      {/* ── Output panel ──────────────────────────────────────────────────── */}
      <Card className="flex flex-col w-1/2 min-h-0 overflow-hidden">
        <CardHeader className="flex-shrink-0">
          <CardTitle className="text-sm font-medium">Decoded Output</CardTitle>
          <CardAction>
            <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
              <Lock className="h-4 w-4 text-foreground/60" />
            </div>
          </CardAction>
        </CardHeader>

        <CardContent className="flex-1 min-h-0 p-0 overflow-hidden">
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
        </CardContent>
      </Card>
    </div>
  );
}
