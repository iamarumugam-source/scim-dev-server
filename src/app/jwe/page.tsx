"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JweEmptyState } from "@/components/jwe/jwe-empty-state";
import { JweResultView } from "@/components/jwe/jwe-result-view";
import { toast } from "sonner";
import { AlertCircle, Loader2, X, Unlock } from "lucide-react";

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

  const handleClear = () => {
    setTokenInput("");
    setKeyInput("");
    setResult(null);
    setDecodeError(null);
  };

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
      toast.success(data.type === "JWE" ? "JWE decrypted" : "JWT decoded");
    } catch (e: any) {
      setDecodeError(e.message);
      toast.error(e.message);
    } finally {
      setIsDecoding(false);
    }
  };

  const hasInput = tokenInput.trim().length > 0 || keyInput.trim().length > 0;

  return (
    <div
      className="flex overflow-hidden"
      style={{ height: "calc(100dvh - var(--header-height))" }}
    >
      {/* ── Left: input panel ─────────────────────────────────────────────── */}
      <div className="flex flex-col w-[400px] flex-shrink-0 border-r min-h-0">

        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
          <p className="text-sm font-medium">Input</p>
          {hasInput && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-muted-foreground hover:text-foreground"
              onClick={handleClear}
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>

        {/* Token + Key tabs */}
        <Tabs defaultValue="token" className="flex flex-col flex-1 min-h-0">
          <div className="px-4 pt-3 flex-shrink-0">
            <TabsList className="w-full">
              <TabsTrigger value="token" className="flex-1 gap-1.5">
                Token
                {tokenInput && (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px] font-normal">
                    set
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="key" className="flex-1 gap-1.5">
                Key
                {keyInput && (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px] font-normal">
                    set
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="token" className="flex-1 min-h-0 mt-0 px-4 pb-0 pt-3 flex flex-col gap-2">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex-shrink-0">
              JWE (5 parts) or plain JWT (3 parts)
            </Label>
            <Textarea
              placeholder={"eyJhbGciOiJSU0EtT0FFUC0yNTYiLCJlbmMiOiJBMjU2R0NNIn0..."}
              className="flex-1 resize-none font-mono text-xs min-h-0"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleDecode();
              }}
            />
          </TabsContent>

          <TabsContent value="key" className="flex-1 min-h-0 mt-0 px-4 pb-0 pt-3 flex flex-col gap-2">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex-shrink-0">
              JWK or JWKS — leave empty for plain JWT
            </Label>
            <Textarea
              placeholder={'{\n  "kty": "RSA",\n  "d": "...",\n  "n": "..."\n}'}
              className="flex-1 resize-none font-mono text-xs min-h-0"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
            />
          </TabsContent>
        </Tabs>

        <Separator className="flex-shrink-0" />

        {/* Decode button */}
        <div className="px-4 py-3 flex-shrink-0 space-y-2">
          <Button
            onClick={handleDecode}
            disabled={isDecoding || !tokenInput.trim()}
            className="w-full gap-2"
          >
            {isDecoding
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Unlock className="h-4 w-4" />}
            {isDecoding ? "Decoding…" : "Decode"}
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">
            or press <kbd className="font-mono">⌘ Enter</kbd> in the token field
          </p>
        </div>
      </div>

      {/* ── Right: output panel ────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-h-0 min-w-0">
        {decodeError ? (
          <div className="p-6">
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
