import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Result meta row */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border/60 flex-shrink-0 bg-muted/30">
        <Badge variant="secondary" className="text-xs font-semibold px-2">
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
          <span className="text-xs text-muted-foreground">contains JWT</span>
        )}
        <ShieldCheck className="h-3.5 w-3.5 text-primary ml-auto" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab} className="flex flex-col flex-1 min-h-0">
        <div className="flex-shrink-0 px-4 pt-3 pb-2 bg-card border-b border-border/60">
          <TabsList className="h-8">
            {isJwe && (
              <TabsTrigger value="jwe-header" className="text-xs px-3">JWE Header</TabsTrigger>
            )}
            {result.header && (
              <TabsTrigger value="header" className="text-xs px-3">
                {hasJwsInner ? "JWT Header" : "Header"}
              </TabsTrigger>
            )}
            {result.payload !== undefined && (
              <TabsTrigger value="payload" className="text-xs px-3">
                {hasJwsInner ? "Claims" : "Payload"}
              </TabsTrigger>
            )}
            {result.raw && (
              <TabsTrigger value="raw" className="text-xs px-3">Raw</TabsTrigger>
            )}
          </TabsList>
        </div>

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
              <JsonViewer data={typeof result.payload === "object" ? result.payload : { value: result.payload }} />
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
