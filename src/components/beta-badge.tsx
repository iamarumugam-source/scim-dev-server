import { cn } from "@/lib/utils";

// Marks a feature as not yet stable. Kept as one component so every "Beta"
// marker in the app stays visually identical — sidebar, page headings, etc.
export function BetaBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-sm border px-1.5 py-0 text-[10px] font-medium leading-4 tracking-wide",
        "border-amber-200 bg-amber-50 text-amber-700",
        "dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
        className,
      )}
    >
      Beta
    </span>
  );
}
