"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { JsonViewer } from "@/components/json-viewer";
import { toast } from "sonner";
import { Lock, KeyRound, FileJson, AlertCircle, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DecryptResult {
  type:         "JWE" | "JWT";
  jweHeader?:   Record<string, unknown>;
  header?:      Record<string, unknown>;
  payload?:     unknown;
  raw?:         string;
  innerIsJwt?:  boolean;
}

// ─── Key type hints ───────────────────────────────────────────────────────────

const KEY_HINTS = [
  { label: "RSA Private (JWK)",   desc: "kty: \"RSA\" with d, p, q — for RSA-OAEP, RSA-OAEP-256" },
  { label: "EC Private (JWK)",    desc: "kty: \"EC\" with d — for ECDH-ES, ECDH-ES+A256KW" },
  { label: "Symmetric (JWK)",     desc: "kty: \"oct\" with k — for dir+AES, HS256/384/512" },
  { label: "JWKS",                desc: "{ \"keys\": [...] } — server tries each key automatically" },
  { label: "Not needed for JWT",  desc: "Plain JWTs (3 parts) are decoded without a key" },
];

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Lock className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">Decoded output will appear here</p>
        <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
          Paste a token on the left and click Decode. JWTs are decoded without a key. JWE tokens require a private or symmetric key.
        </p>
      </div>
      <div className="w-full max-w-sm rounded-lg border border-border bg-muted/30 p-3 text-left space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Supported key types
        </p>
        {KEY_HINTS.map((h) => (
          <div key={h.label} className="flex items-start gap-2">
            <KeyRound className="h-3 w-3 text-muted-foreground/60 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-foreground">{h.label}</span>
              <span className="text-[11px] text-muted-foreground"> — {h.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Result view ──────────────────────────────────────────────────────────────

function ResultView({ result }: { result: DecryptResult }) {
  const isJwe      = result.type === "JWE";
  const hasJwsInner = isJwe && result.innerIsJwt;

  const defaultTab = isJwe ? "jwe-header" : "header";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Token type badge */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-border/60 flex-shrink-0">
        <Badge
          className={cn(
            "text-[10px] font-semibold px-2 py-0.5",
            isJwe
              ? "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
              : "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
          )}
        >
          {isJwe ? "JWE" : "JWT"}
        </Badge>
        {result.jweHeader && (
          <span className="text-xs text-muted-foreground font-mono">
            {String((result.jweHeader as any).alg ?? "")}
            {(result.jweHeader as any).enc ? ` / ${(result.jweHeader as any).enc}` : ""}
          </span>
        )}
        {!isJwe && result.header && (
          <span className="text-xs text-muted-foreground font-mono">
            {String((result.header as any).alg ?? "")}
          </span>
        )}
        {isJwe && hasJwsInner && (
          <span className="text-xs text-muted-foreground">→ contains JWT</span>
        )}
        <ShieldCheck className="h-3.5 w-3.5 text-green-500 ml-auto" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab} className="flex flex-col flex-1 min-h-0">
        <div className="flex-shrink-0 px-4 pt-2 bg-card border-b border-border/60">
          <TabsList className="h-7">
            {isJwe && (
              <TabsTrigger value="jwe-header" className="text-xs h-6 px-2">
                JWE Header
              </TabsTrigger>
            )}
            {result.header && (
              <TabsTrigger value="header" className="text-xs h-6 px-2">
                {hasJwsInner ? "JWT Header" : "Header"}
              </TabsTrigger>
            )}
            {result.payload !== undefined && (
              <TabsTrigger value="payload" className="text-xs h-6 px-2">
                {hasJwsInner ? "Claims" : "Payload"}
              </TabsTrigger>
            )}
            {result.raw && (
              <TabsTrigger value="raw" className="text-xs h-6 px-2">
                Raw
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto min-h-0 p-3">
          {isJwe && result.jweHeader && (
            <TabsContent value="jwe-header" className="mt-0 h-full">
              <JsonViewer data={result.jweHeader} />
            </TabsContent>
          )}
          {result.header && (
            <TabsContent value="header" className="mt-0 h-full">
              <JsonViewer data={result.header} />
            </TabsContent>
          )}
          {result.payload !== undefined && (
            <TabsContent value="payload" className="mt-0 h-full">
              <JsonViewer
                data={typeof result.payload === "object" ? result.payload : { value: result.payload }}
              />
            </TabsContent>
          )}
          {result.raw && (
            <TabsContent value="raw" className="mt-0 h-full">
              <pre className="rounded-md border border-border bg-card p-3 text-xs font-mono whitespace-pre-wrap break-all">
                {result.raw}
              </pre>
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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
      {/* Input panel */}
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

        <Button
          onClick={handleDecode}
          disabled={isDecoding}
          className="ml-auto"
        >
          {isDecoding ? "Decoding…" : "Decode"}
        </Button>
      </div>

      {/* Output panel */}
      <div className="flex flex-col w-1/2 rounded-lg border border-border overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/40 flex-shrink-0">
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold">Decoded Output</span>
        </div>

        {decodeError ? (
          <div className="flex items-start gap-3 p-4 m-4 rounded-lg border border-destructive/40 bg-destructive/10">
            <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">{decodeError}</p>
          </div>
        ) : result ? (
          <ResultView result={result} />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}
