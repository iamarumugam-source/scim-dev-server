import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";

// ─── Data ─────────────────────────────────────────────────────────────────────

const GROUPS: {
  group: string;
  items: { keys: string[]; label: string }[];
}[] = [
  {
    group: "Sidebar",
    items: [
      { keys: ["⌘", "\\"], label: "Toggle sidebar"   },
      { keys: ["?"],        label: "Show this dialog" },
      { keys: ["⌘", "D"],  label: "Toggle theme"     },
    ],
  },
  {
    group: "Actions",
    items: [
      { keys: ["⌘", "G"], label: "Generate mock data" },
      { keys: ["⌘", "⌫"], label: "Reset data"         },
    ],
  },
  {
    group: "Navigate",
    items: [
      { keys: ["⌘", "L"], label: "Logs" },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function KeyboardShortcuts() {
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Keyboard Shortcuts</CardTitle>
        <CardDescription className="text-xs">
          Shortcuts are disabled when focus is inside an input field.
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="flex flex-col gap-4">
          {GROUPS.map(({ group, items }, gi) => (
            <div key={group} className="flex flex-col gap-1">

              {/* Group label */}
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                {group}
              </p>

              {/* Rows */}
              {items.map(({ keys, label }, i) => (
                <div key={label}>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-foreground/80">{label}</span>
                    <div className="flex items-center gap-1">
                      {keys.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </div>
                  </div>
                  {i < items.length - 1 && <Separator />}
                </div>
              ))}

            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
