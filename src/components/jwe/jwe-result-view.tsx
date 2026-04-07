import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JsonViewer } from "@/components/json-viewer";

interface DecryptResult {
  type:        "JWE" | "JWT";
  jweHeader?:  Record<string, unknown>;
  header?:     Record<string, unknown>;
  payload?:    unknown;
  raw?:        string;
  innerIsJwt?: boolean;
}

export function JweResultView({ result }: { result: DecryptResult }) {
  const isJwe       = result.type === "JWE";
  const hasJwsInner = isJwe && result.innerIsJwt;
  const defaultTab  = isJwe ? "jwe-header" : "header";

  const alg = isJwe
    ? [
        String((result.jweHeader as any)?.alg ?? ""),
        (result.jweHeader as any)?.enc ? String((result.jweHeader as any).enc) : "",
      ].filter(Boolean).join(" / ")
    : String((result.header as any)?.alg ?? "");

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">

      {/* ── Meta bar ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 flex-shrink-0 bg-muted/30 dark:bg-white/[0.04]">
        <Badge variant={isJwe ? "default" : "secondary"} className="text-xs font-semibold">
          {isJwe ? "JWE" : "JWT"}
        </Badge>
        {alg && (
          <span className="text-xs text-muted-foreground font-mono">{alg}</span>
        )}
        {hasJwsInner && (
          <Badge variant="outline" className="text-[10px] font-normal">
            contains JWT
          </Badge>
        )}
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 ml-auto" />
      </div>

      <Separator className="flex-shrink-0" />

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <Tabs defaultValue={defaultTab} className="flex flex-col flex-1 min-h-0">
        <div className="px-4 pt-3 pb-2 flex-shrink-0">
          <TabsList>
            {isJwe && (
              <TabsTrigger value="jwe-header" className="text-xs">JWE Header</TabsTrigger>
            )}
            {result.header && (
              <TabsTrigger value="header" className="text-xs">
                {hasJwsInner ? "JWT Header" : "Header"}
              </TabsTrigger>
            )}
            {result.payload !== undefined && (
              <TabsTrigger value="payload" className="text-xs">
                {hasJwsInner ? "Claims" : "Payload"}
              </TabsTrigger>
            )}
            {result.raw && (
              <TabsTrigger value="raw" className="text-xs">Raw</TabsTrigger>
            )}
          </TabsList>
        </div>

        <Separator className="flex-shrink-0" />

        {/* Tab content — scrollable */}
        <div className="flex-1 overflow-auto min-h-0 p-4">
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
                data={
                  typeof result.payload === "object"
                    ? result.payload
                    : { value: result.payload }
                }
              />
            </TabsContent>
          )}
          {result.raw && (
            <TabsContent value="raw" className="mt-0 h-full">
              <pre className="rounded-sm border border-border bg-muted/30 dark:bg-white/[0.04] p-3 text-xs font-mono whitespace-pre-wrap break-all">
                {result.raw}
              </pre>
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
}
