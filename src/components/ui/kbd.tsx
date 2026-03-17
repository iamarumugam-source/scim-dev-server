import * as React from "react";
import { cn } from "@/lib/utils";

function Kbd({ className, children, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "pointer-events-none inline-flex h-5 min-w-[20px] select-none items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[11px] font-medium text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}

export { Kbd };
