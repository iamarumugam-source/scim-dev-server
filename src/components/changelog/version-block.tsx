"use client";

import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ItemGroup } from "@/components/ui/item";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ChangeItem, type Change } from "./change-item";

export interface Version {
  version:      string;
  date:         string;
  title:        string;
  description?: string;
  changes:      Change[];
}

export function VersionBlock({
  v, isLatest, open, onOpenChange, changes, matchedOf,
}: {
  v: Version;
  isLatest: boolean;
  /**
   * CONTROLLED, deliberately. This was `defaultOpen`, which Radix reads once on
   * mount — so with a stable key, a search could not reopen an already-collapsed
   * release. The card and its count updated while the matched entry stayed
   * hidden inside, which made search look broken.
   */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Changes to render; may be a filtered subset of v.changes. */
  changes: Change[];
  /** When filtering, how many of the total matched. */
  matchedOf?: number;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="relative pl-8">
      {/* Timeline dot + line */}
      <div className={cn(
        "absolute left-0 top-[19px] h-3 w-3 rounded-full border-2 border-background ring-2",
        isLatest
          ? "bg-[color:var(--seq-strong)] ring-[color:var(--seq-strong)]/25"
          : "bg-muted-foreground/40 ring-muted-foreground/10",
      )} />
      <div className="absolute bottom-0 left-[5px] top-[31px] w-px bg-border/60" />

      <Card className="mb-4 gap-0 overflow-hidden py-0">
        <CollapsibleTrigger asChild>
          <button className="group/ver flex w-full items-start justify-between gap-4 bg-muted/20 px-4 py-3 text-left transition-colors hover:bg-muted/40">
            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-transform duration-150 group-data-[state=open]/ver:rotate-90" />
              <Badge
                variant="outline"
                className={cn(
                  "font-mono text-xs font-bold",
                  isLatest
                    ? "border-[color:var(--seq-strong)]/40 bg-[color:var(--seq-strong)]/10 text-[color:var(--seq-strong)]"
                    : "bg-muted text-muted-foreground",
                )}
              >
                v{v.version}
              </Badge>
              <span className="truncate text-sm font-semibold">{v.title}</span>
              {isLatest && (
                <Badge className="bg-[color:var(--seq-strong)]/10 text-[10px] font-semibold text-[color:var(--seq-strong)] hover:bg-[color:var(--seq-strong)]/10">
                  Latest
                </Badge>
              )}
              <Badge variant="secondary" className="text-[10px] font-normal tabular-nums">
                {matchedOf !== undefined && matchedOf !== changes.length
                  ? `${changes.length} of ${matchedOf}`
                  : `${changes.length} change${changes.length === 1 ? "" : "s"}`}
              </Badge>
            </div>
            <time className="mt-0.5 flex-shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {new Date(v.date).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" })}
            </time>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="px-4 py-0">
            {v.description && (
              <p className="pt-3 text-sm text-muted-foreground">{v.description}</p>
            )}
            <Separator className="mt-3" />
            <ItemGroup className="py-2">
              {changes.map((c, i) => <ChangeItem key={i} change={c} />)}
            </ItemGroup>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
