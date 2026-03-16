import { Plus, Wrench, Bug, Zap, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ChangeType = "new" | "improved" | "fixed" | "breaking" | "security";

export interface Change {
  type: ChangeType;
  text: string;
}

export const TYPE_CONFIG: Record<ChangeType, { label: string; icon: React.ElementType; class: string }> = {
  new:      { label: "New",      icon: Plus,   class: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800"         },
  improved: { label: "Improved", icon: Zap,    class: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 border-violet-200 dark:border-violet-800" },
  fixed:    { label: "Fixed",    icon: Bug,    class: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 border-green-200 dark:border-green-800"    },
  breaking: { label: "Breaking", icon: Wrench, class: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800"   },
  security: { label: "Security", icon: Shield, class: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800"         },
};

export function ChangeItem({ change }: { change: Change }) {
  const { label, icon: Icon, class: cls } = TYPE_CONFIG[change.type];
  return (
    <li className="flex items-start gap-2.5 py-1">
      <Badge variant="outline" className={cn("flex items-center gap-1 text-[10px] font-semibold flex-shrink-0 mt-0.5 px-1.5 py-0.5", cls)}>
        <Icon className="h-2.5 w-2.5" />
        {label}
      </Badge>
      <span className="text-sm text-foreground/80 leading-relaxed">{change.text}</span>
    </li>
  );
}
