import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ChangeItem, Change } from "./change-item";

export interface Version {
  version:     string;
  date:        string;
  title:       string;
  description?: string;
  changes:     Change[];
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
      <div className="absolute left-[5px] top-[30px] bottom-0 w-px bg-border/60" />

      <Card className="overflow-hidden mb-6">
        <div className="flex items-start justify-between gap-4 px-5 py-4 bg-muted/20">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge
              variant="outline"
              className={cn(
                "text-sm font-bold font-mono",
                isLatest ? "bg-primary/10 text-primary border-primary/30" : "bg-muted text-muted-foreground",
              )}
            >
              v{v.version}
            </Badge>
            <h2 className="text-base font-semibold">{v.title}</h2>
            {isLatest && (
              <Badge className="text-[10px] font-semibold bg-primary/10 text-primary hover:bg-primary/10">
                Latest
              </Badge>
            )}
          </div>
          <time className="text-xs text-muted-foreground tabular-nums flex-shrink-0 mt-0.5">
            {new Date(v.date).toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" })}
          </time>
        </div>

        <CardContent className="px-5 py-0">
          {v.description && (
            <p className="pt-3 pb-0 text-sm text-muted-foreground">{v.description}</p>
          )}
          <Separator className="mt-3" />
          <ul className="py-3 space-y-0.5">
            {v.changes.map((c, i) => <ChangeItem key={i} change={c} />)}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
