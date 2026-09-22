import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ItemGroup } from "@/components/ui/item";
import { cn } from "@/lib/utils";
import { ChangeItem, Change } from "./change-item";

export interface Version {
  version:      string;
  date:         string;
  title:        string;
  description?: string;
  changes:      Change[];
}

export function VersionBlock({ v, isLatest }: { v: Version; isLatest: boolean }) {
  return (
    <div className="relative pl-8">
      {/* Timeline dot */}
      <div className={cn(
        "absolute left-0 top-[18px] h-3 w-3 rounded-full border-2 border-background ring-2",
        isLatest ? "bg-primary ring-primary/30" : "bg-muted-foreground/40 ring-muted-foreground/10",
      )} />
      {/* Timeline line */}
      <div className="absolute bottom-0 left-[5px] top-[30px] w-px bg-border/60" />

      <Card className="mb-6 gap-0 overflow-hidden py-0">
        <div className="flex items-start justify-between gap-4 bg-muted/20 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              variant="outline"
              className={cn(
                "font-mono text-sm font-bold",
                isLatest ? "border-primary/30 bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              v{v.version}
            </Badge>
            <h2 className="text-base font-semibold">{v.title}</h2>
            {isLatest && (
              <Badge className="bg-primary/10 text-[10px] font-semibold text-primary hover:bg-primary/10">
                Latest
              </Badge>
            )}
            <Badge variant="secondary" className="text-[10px] font-normal tabular-nums">
              {v.changes.length} change{v.changes.length === 1 ? "" : "s"}
            </Badge>
          </div>
          <time className="mt-0.5 flex-shrink-0 text-xs tabular-nums text-muted-foreground">
            {new Date(v.date).toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" })}
          </time>
        </div>

        <CardContent className="px-5 py-0">
          {v.description && (
            <p className="pb-0 pt-3 text-sm text-muted-foreground">{v.description}</p>
          )}
          <Separator className="mt-3" />
          {/* ItemGroup rather than a bare <ul>: it owns the separation and
              spacing between rows, so ChangeItem does not hand-roll it. */}
          <ItemGroup className="py-2">
            {v.changes.map((c, i) => <ChangeItem key={i} change={c} />)}
          </ItemGroup>
        </CardContent>
      </Card>
    </div>
  );
}
