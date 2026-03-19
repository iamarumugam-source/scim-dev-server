"use client";

import { useMemo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS    = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] as const;
const WEEK_DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"] as const;
const ROW_LABEL: Record<number, string> = { 1: "Mon", 3: "Wed", 5: "Fri" };

// ─── Types ────────────────────────────────────────────────────────────────────

interface Cell {
  dateStr:  string;
  count:    number;
  isToday:  boolean;
  isFuture: boolean;
}

interface Week {
  cells:      Cell[];
  monthLabel: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a YYYY-MM-DD string in the user's local timezone — avoids the UTC
 *  offset shift that `toISOString().slice(0,10)` causes for UTC+ locales. */
function localDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildCalendar(counts: Record<string, number>): Week[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = localDateStr(today);

  // Start on the Sunday of the week 52 full weeks ago.
  const cursor = new Date(today);
  cursor.setDate(cursor.getDate() - cursor.getDay() - 52 * 7);

  const weeks: Week[] = [];
  let prevMonth = -1;

  for (let w = 0; w < 53; w++) {
    const cells: Cell[] = [];
    const m = cursor.getMonth();
    const monthLabel = m !== prevMonth ? MONTHS[m] : "";
    if (monthLabel) prevMonth = m;

    for (let d = 0; d < 7; d++) {
      const dateStr = localDateStr(cursor);
      cells.push({
        dateStr,
        count:    counts[dateStr] ?? 0,
        isToday:  dateStr === todayStr,
        isFuture: cursor > today,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    weeks.push({ cells, monthLabel });
  }

  return weeks;
}

function aggregateCounts(timestamps: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const ts of timestamps) {
    const key = localDateStr(new Date(ts));
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function computeStreak(counts: Record<string, number>): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = localDateStr(today);

  let streak = 0;
  const cursor = new Date(today);

  while (true) {
    const d = localDateStr(cursor);
    if (!counts[d]) {
      // Don't penalise if the user hasn't logged in yet today.
      if (d === todayStr && streak === 0) {
        cursor.setDate(cursor.getDate() - 1);
        continue;
      }
      break;
    }
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function cellColor(count: number): string {
  return count > 0 ? "bg-primary" : "bg-muted/50 dark:bg-muted/30";
}

function formatTooltip(dateStr: string, count: number): string {
  const label = new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month:   "short",
    day:     "numeric",
    year:    "numeric",
  });
  return count > 0 ? `Logged in — ${label}` : `No activity — ${label}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface LoginActivityGridProps {
  timestamps: string[];
  total:      number;
}

export function LoginActivityGrid({ timestamps, total }: LoginActivityGridProps) {
  const { weeks, streak } = useMemo(() => {
    const counts = aggregateCounts(timestamps);
    return {
      weeks:  buildCalendar(counts),
      streak: computeStreak(counts),
    };
  }, [timestamps]);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="space-y-4">

        {/* Summary stats */}
        <div className="flex items-center gap-6 text-sm">
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{total}</span>
            {" "}total login{total !== 1 ? "s" : ""}
          </span>
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{streak}</span>
            {"-day streak"}
          </span>
        </div>

        {/* Grid — fills full card width; cells scale with available space */}
        <div className="w-full flex flex-col gap-[3px]">

          {/* Month labels */}
          <div className="flex gap-[3px] pl-7">
            {weeks.map((week, wi) => (
              <div
                key={wi}
                className="flex-1 min-w-0 text-[9px] leading-none text-muted-foreground overflow-visible whitespace-nowrap"
              >
                {week.monthLabel}
              </div>
            ))}
          </div>

          {/* Day rows */}
          {WEEK_DAYS.map((_, dayIdx) => (
            <div key={dayIdx} className="flex items-center gap-[3px]">
              <span className="w-7 flex-shrink-0 text-[9px] leading-none text-muted-foreground text-right pr-1.5">
                {ROW_LABEL[dayIdx] ?? ""}
              </span>

              {weeks.map((week, wi) => {
                const cell = week.cells[dayIdx];
                if (!cell) return <div key={wi} className="flex-1 aspect-square" />;

                return (
                  <Tooltip key={wi}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "flex-1 aspect-square rounded-[2px] cursor-default transition-opacity",
                          cell.isFuture
                            ? "opacity-0 pointer-events-none"
                            : cellColor(cell.count),
                        )}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {formatTooltip(cell.dateStr, cell.count)}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </div>

      </div>
    </TooltipProvider>
  );
}
