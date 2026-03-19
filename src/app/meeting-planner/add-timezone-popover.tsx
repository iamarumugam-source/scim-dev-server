"use client";

import { useState, useMemo } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ALL_TIMEZONES, TzInfo } from "@/lib/timezones";
import { avatarColor, initials } from "./utils";

interface Props {
  added: string[];
  onAdd: (tz: TzInfo) => void;
}

export function AddTimezonePopover({ added, onAdd }: Props) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return ALL_TIMEZONES.filter(
      (tz) =>
        !added.includes(tz.id) &&
        (tz.city.toLowerCase().includes(q) ||
          tz.country.toLowerCase().includes(q) ||
          tz.region.toLowerCase().includes(q) ||
          tz.id.toLowerCase().includes(q)),
    );
  }, [query, added]);

  const regions = useMemo(
    () => [...new Set(filtered.map((z) => z.region))],
    [filtered],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add timezone
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 space-y-2" align="end">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            autoFocus
            placeholder="Search city or timezone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="max-h-64 overflow-y-auto space-y-3 pr-0.5">
          {regions.map((region) => (
            <div key={region}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1 mb-1">
                {region}
              </p>
              {filtered
                .filter((z) => z.region === region)
                .map((tz) => (
                  <button
                    key={tz.id}
                    className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors text-left"
                    onClick={() => { onAdd(tz); setOpen(false); setQuery(""); }}
                  >
                    <div className={cn("flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold", avatarColor(tz.id))}>
                      {initials(tz.city)}
                    </div>
                    <span className="flex-1 font-medium">{tz.city}</span>
                    {tz.country && (
                      <span className="text-xs text-muted-foreground">{tz.country}</span>
                    )}
                  </button>
                ))}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No timezones found.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
