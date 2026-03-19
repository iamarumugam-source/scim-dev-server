"use client";

import { useState } from "react";
import { Video, Copy, Check, CalendarPlus, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TzInfo } from "@/lib/timezones";
import { fmt, buildRefDate, parseDateStr, formatDisplayDate, durationLabel, avatarColor, initials } from "./utils";
import { ScheduledCall, buildEmailText, buildGoogleCalendarUrl } from "./types";

interface Props {
  call:          ScheduledCall;
  zones:         TzInfo[];
  use24h:        boolean;
  onRemove:      () => void;
  onUpdateLabel: (label: string) => void;
}

export function ScheduledCallCard({ call, zones, use24h, onRemove, onUpdateLabel }: Props) {
  const [copied, setCopied] = useState(false);

  const startRef = buildRefDate(call.dateStr, Math.floor(call.startUtcMinutes / 60), call.startUtcMinutes % 60);
  const endRef   = buildRefDate(call.dateStr, Math.floor(call.endUtcMinutes   / 60), call.endUtcMinutes   % 60);
  const duration = durationLabel(call.startUtcMinutes, call.endUtcMinutes);

  const copy = () => {
    navigator.clipboard.writeText(buildEmailText([call], zones));
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, height: 0 }}
      transition={{ duration: 0.18 }}
      className="border border-border rounded-lg overflow-hidden bg-card"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border/60 bg-muted/30">
        <Video className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <input
          value={call.label}
          onChange={(e) => onUpdateLabel(e.target.value)}
          placeholder="Call label (optional)"
          className="flex-1 bg-transparent text-sm font-medium placeholder:text-muted-foreground/50 outline-none min-w-0"
        />
        <span className="text-xs text-muted-foreground flex-shrink-0">
          {formatDisplayDate(call.dateStr)} · {duration}
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={copy} title="Copy for email">
          {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
        <a href={buildGoogleCalendarUrl(call, zones)} target="_blank" rel="noopener noreferrer" title="Add to Google Calendar">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary">
            <CalendarPlus className="h-3.5 w-3.5" />
          </Button>
        </a>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Timezone breakdown */}
      <div className="flex flex-wrap gap-x-6 gap-y-1.5 px-4 py-3">
        {zones.map((tz) => {
          const t1      = fmt(startRef, tz.id, { hour: "numeric", minute: "2-digit", hour12: !use24h });
          const t2      = fmt(endRef,   tz.id, { hour: "numeric", minute: "2-digit", hour12: !use24h });
          const day     = fmt(startRef, tz.id, { weekday: "short", month: "short", day: "numeric" });
          const dayBase = fmt(parseDateStr(call.dateStr), tz.id, { weekday: "short", month: "short", day: "numeric" });
          return (
            <div key={tz.id} className="flex items-center gap-2 min-w-[200px]">
              <div className={cn("flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-semibold", avatarColor(tz.id))}>
                {initials(tz.city)}
              </div>
              <span className="text-xs text-muted-foreground">{tz.city}</span>
              <span className="text-xs font-semibold tabular-nums ml-auto">{t1} – {t2}</span>
              {day !== dayBase && (
                <span className="text-[10px] text-muted-foreground">({day})</span>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
