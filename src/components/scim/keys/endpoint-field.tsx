"use client";

import { Badge } from "@/components/ui/badge";
import { CopyButton } from "./copy-button";

const METHOD_STYLE: Record<"GET" | "POST", string> = {
  GET:  "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  POST: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400 border-green-200 dark:border-green-800",
};

interface EndpointFieldProps {
  method: "GET" | "POST";
  value: string;
}

export function EndpointField({ method, value }: EndpointFieldProps) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">URL</p>
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-2">
        <Badge variant="outline" className={`flex-shrink-0 text-[10px] font-bold font-mono px-1.5 py-0.5 ${METHOD_STYLE[method]}`}>
          {method}
        </Badge>
        <code className="flex-1 text-xs font-mono text-foreground truncate min-w-0">{value}</code>
        <CopyButton value={value} />
      </div>
    </div>
  );
}
