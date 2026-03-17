"use client";

import { GripHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmt, buildRefDate } from "./utils";

interface CursorProps {
  minutes:        number;
  label:          string;
  variant:        "start" | "end";
  isActive:       boolean;
  gridW:          number;
  dateStr:        string;
  userTz:         string;
  userTzCity:     string;
  use24h:         boolean;
  userOffsetMins: number;
  onDragStart:    (e: React.MouseEvent | React.TouchEvent) => void;
}

export function Cursor({
  minutes, label, variant, isActive, gridW,
  dateStr, userTz, userTzCity, use24h, userOffsetMins,
  onDragStart,
}: CursorProps) {
  // X based on LOCAL position so it aligns with the local-hour grid columns
  const localMins    = ((minutes + userOffsetMins) % 1440 + 1440) % 1440;
  const x            = (localMins / 1439) * gridW;
  const isStart      = variant === "start";
  const bubbleBg     = isStart
    ? "bg-primary text-primary-foreground"
    : "bg-foreground text-background dark:bg-foreground dark:text-background";
  const lineBg       = isStart ? "bg-primary/60" : "bg-foreground/50";
  const diamondBg    = isStart ? "bg-primary" : "bg-foreground";

  // Format time directly from Date — matches getLocalHour exactly
  const refDate      = buildRefDate(dateStr, Math.floor(minutes / 60), minutes % 60);
  const localTimeStr = fmt(refDate, userTz, { hour: "numeric", minute: "2-digit", hour12: !use24h });

  const bubble = (
    <div
      className={cn(
        "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono font-bold shadow-md whitespace-nowrap pointer-events-auto",
        "cursor-grab active:cursor-grabbing select-none transition-transform",
        bubbleBg,
        isActive && "scale-110 shadow-lg",
      )}
      onMouseDown={onDragStart}
      onTouchStart={onDragStart}
      onClick={(e) => e.stopPropagation()}
    >
      <GripHorizontal className="h-3 w-3 opacity-70 flex-shrink-0" />
      <span className="text-[10px] opacity-70 font-sans font-medium">{label}</span>
      {localTimeStr}
      <span className="text-[9px] opacity-60 font-sans font-normal ml-0.5">{userTzCity}</span>
    </div>
  );

  return (
    <div
      className="absolute top-0 bottom-0 z-20 flex flex-col items-center pointer-events-none"
      style={{ left: x, transform: "translateX(-50%)" }}
    >
      {/* Bubble — Start sits at top, End sits just below to avoid overlap */}
      <div className={isStart ? "mt-1.5" : "mt-9"}>{bubble}</div>
      <div className={cn("flex-1 w-0.5", lineBg)} />
      <div className={cn("w-2 h-2 rotate-45 flex-shrink-0", diamondBg)} />
    </div>
  );
}
