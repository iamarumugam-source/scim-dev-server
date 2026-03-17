"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Plus, X, Search, Clock, Globe, Copy, Check,
  CalendarDays, User, Video, Trash2, GripHorizontal,
  ChevronLeft, ChevronRight, CalendarPlus,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useUserTimezone } from "@/hooks/useUserTimezone";
import { ALL_TIMEZONES, TzInfo, findTimezone, getUtcOffset, getOffsetMinutes } from "@/lib/timezones";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(date: Date, tz: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opts }).format(date);
}

function getLocalHour(date: Date, tz: string): number {
  return parseInt(fmt(date, tz, { hour: "numeric", hour12: false })) % 24;
}

function blockStyle(localHour: number): string {
  if (localHour >= 22 || localHour < 6)  return "bg-background text-muted-foreground/30";
  if (localHour < 9  || localHour >= 18) return "bg-muted/40 text-muted-foreground/60";
  return "bg-card text-foreground/70";
}

function initials(city: string): string {
  return city.split(/[\s-]/).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function toLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDisplayDate(dateStr: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  }).format(parseDateStr(dateStr));
}

function buildRefDate(dateStr: string, utcHour: number, utcMinute: number): Date {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCHours(utcHour, utcMinute, 0, 0);
  return d;
}

function minsToLabel(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

/** Convert UTC minutes-from-midnight to local minutes-from-midnight in `tz`.
 *  Uses Intl.DateTimeFormat (DST-aware) so it stays in sync with the grid cells. */
function utcMinsToLocal(utcMins: number, dateStr: string, tz: string): number {
  const d  = buildRefDate(dateStr, Math.floor(utcMins / 60), utcMins % 60);
  const h  = parseInt(fmt(d, tz, { hour: "numeric", hour12: false })) % 24;
  const m  = parseInt(fmt(d, tz, { minute: "2-digit" }));
  return h * 60 + m;
}

/** Format a local-hour (0-23) for display in a grid cell. */
function formatHour(h: number, use24h: boolean): string {
  if (use24h) return String(h).padStart(2, "0");
  if (h === 0)  return "12a";
  if (h < 12)   return `${h}a`;
  if (h === 12) return "12p";
  return `${h - 12}p`;
}

/** Format minutes-from-midnight as a time string. */
function formatMins(mins: number, use24h: boolean): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const mm = String(m).padStart(2, "0");
  if (use24h) return `${String(h).padStart(2, "0")}:${mm}`;
  const period = h < 12 ? "AM" : "PM";
  const h12    = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mm} ${period}`;
}

/** ±N days from a YYYY-MM-DD string. */
function addDays(dateStr: string, n: number): string {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + n);
  return toLocalISODate(d);
}

function durationLabel(startMins: number, endMins: number): string {
  const diff = Math.abs(endMins - startMins);
  const h    = Math.floor(diff / 60);
  const m    = diff % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const AVATAR_COLORS = [
  "bg-primary/10 text-primary",
  "bg-muted text-foreground/70",
  "bg-primary/15 text-primary/80",
  "bg-muted/80 text-foreground/60",
  "bg-secondary text-secondary-foreground",
  "bg-primary/20 text-primary/90",
];
function avatarColor(str: string): string {
  const hash = Array.from(str).reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ScheduledCall {
  id:              string;
  dateStr:         string;
  startUtcMinutes: number;
  endUtcMinutes:   number;
  label:           string;
}

function newCall(dateStr: string, start: number, end: number): ScheduledCall {
  return { id: crypto.randomUUID(), dateStr, startUtcMinutes: start, endUtcMinutes: end, label: "" };
}

function buildEmailText(calls: ScheduledCall[], zones: TzInfo[]): string {
  return calls.map((call) => {
    const startRef = buildRefDate(call.dateStr, Math.floor(call.startUtcMinutes / 60), call.startUtcMinutes % 60);
    const endRef   = buildRefDate(call.dateStr, Math.floor(call.endUtcMinutes   / 60), call.endUtcMinutes   % 60);
    const dateHdr  = new Intl.DateTimeFormat("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
    }).format(startRef);
    const dur = durationLabel(call.startUtcMinutes, call.endUtcMinutes);
    const lines = zones.map((tz) => {
      const t1      = fmt(startRef, tz.id, { hour: "numeric", minute: "2-digit", hour12: true });
      const t2      = fmt(endRef,   tz.id, { hour: "numeric", minute: "2-digit", hour12: true });
      const day     = fmt(startRef, tz.id, { weekday: "short", month: "short", day: "numeric" });
      const dayBase = fmt(parseDateStr(call.dateStr), tz.id, { weekday: "short", month: "short", day: "numeric" });
      const offset  = getUtcOffset(tz.id, startRef);
      return `  • ${tz.city}${tz.country ? `, ${tz.country}` : ""}: ${t1} – ${t2}${day !== dayBase ? ` (${day})` : ""} [${offset}]`;
    });
    return [`${call.label || "Call"} — ${dateHdr} (${dur})`, ...lines].join("\n");
  }).join("\n\n");
}

function buildGoogleCalendarUrl(call: ScheduledCall, zones: TzInfo[]): string {
  const startRef = buildRefDate(call.dateStr, Math.floor(call.startUtcMinutes / 60), call.startUtcMinutes % 60);
  const endRef   = buildRefDate(call.dateStr, Math.floor(call.endUtcMinutes   / 60), call.endUtcMinutes   % 60);

  // YYYYMMDDTHHMMSSZ
  const gcalDt = (d: Date) => d.toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";

  // "7:30a" / "8:00p"
  const shortTime = (d: Date, tz: string) =>
    fmt(d, tz, { hour: "numeric", minute: "2-digit", hour12: true })
      .replace(":00 AM", "a").replace(" AM", "a")
      .replace(":00 PM", "p").replace(" PM", "p")
      .replace(":30 AM", ":30a").replace(":30 PM", ":30p")
      .replace(/:(\d\d) AM/, ":$1a").replace(/:(\d\d) PM/, ":$1p");

  // "Tue, Mar 17 2026" (no comma after day)
  const shortDate = (d: Date, tz: string) =>
    fmt(d, tz, { weekday: "short", month: "short", day: "numeric", year: "numeric" })
      .replace(/(\w{3} \d+),/, "$1");   // strip comma after day number

  // Timezone abbreviation e.g. "IST", "EST"
  const tzAbbr = (d: Date, tz: string) => {
    const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(d);
    return p.find((x) => x.type === "timeZoneName")?.value ?? tz;
  };

  // Long name e.g. "India Standard Time"
  const tzLong = (d: Date, tz: string) => {
    const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "long" }).formatToParts(d);
    return p.find((x) => x.type === "timeZoneName")?.value ?? tz;
  };

  let details = "";
  for (const tz of zones) {
    // Header: "CITY, Country" or "ABBR, Long Timezone Name"
    const header = tz.city !== tz.id
      ? [tz.city.toUpperCase(), tz.country].filter(Boolean).join(", ")
      : `${tzAbbr(startRef, tz.id)}, ${tzLong(startRef, tz.id)}`;

    details +=
      `\n\n${header}` +
      `\n${shortTime(startRef, tz.id)}\t${shortDate(startRef, tz.id)}` +
      `\n${shortTime(endRef, tz.id)}\t${shortDate(endRef, tz.id)}`;
  }
  details += "\n\n\n\rScheduled with Time Converter\n";

  const params = new URLSearchParams({
    text:     call.label || "Meeting",
    dates:    `${gcalDt(startRef)}/${gcalDt(endRef)}`,
    details,
    location: "",
    trp:      "true",
  });
  return `https://calendar.google.com/calendar/u/0/r/eventedit?${params.toString()}`;
}

// ─── Grid constants ────────────────────────────────────────────────────────────

const CELL_W = 48;
const GRID_W = CELL_W * 24;
const ROW_H  = 44;
const HEAD_H = 68;

// ─── Cursor component ──────────────────────────────────────────────────────────

function Cursor({
  minutes,
  label,
  variant,
  isActive,
  gridW,
  dateStr,
  userTz,
  userTzCity,
  use24h,
  userOffsetMins,
  onDragStart,
}: {
  minutes:     number;
  label:       string;
  variant:     "start" | "end";
  isActive:    boolean;
  gridW:       number;
  dateStr:     string;
  userTz:      string;
  userTzCity:      string;
  use24h:          boolean;
  userOffsetMins:  number;
  onDragStart: (e: React.MouseEvent | React.TouchEvent) => void;
}) {
  // X based on LOCAL position so it aligns with the local-hour grid columns
  const localMins   = ((minutes + userOffsetMins) % 1440 + 1440) % 1440;
  const x           = (localMins / 1439) * gridW;
  const isStart     = variant === "start";
  const bubbleBg    = isStart ? "bg-primary text-primary-foreground" : "bg-foreground text-background dark:bg-foreground dark:text-background";
  const lineBg      = isStart ? "bg-primary/60" : "bg-foreground/50";
  const diamondBg   = isStart ? "bg-primary" : "bg-foreground";
  // Format the time directly from the Date so it matches getLocalHour exactly
  const refDate     = buildRefDate(dateStr, Math.floor(minutes / 60), minutes % 60);
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
      className="absolute top-0 bottom-0 z-20 flex items-center pointer-events-none"
      style={{ left: x, transform: "translateX(-50%)", flexDirection: isStart ? "column" : "column-reverse" }}
    >
      {/* Bubble — top for Start, bottom for End */}
      <div className={isStart ? "mt-1.5" : "mb-1.5"}>{bubble}</div>

      {/* Stem */}
      <div className={cn("flex-1 w-0.5", lineBg)} />

      {/* Diamond tip — at bottom for Start, at top for End */}
      <div className={cn("w-2 h-2 rotate-45 flex-shrink-0", diamondBg)} />
    </div>
  );
}

// ─── Add timezone popover ──────────────────────────────────────────────────────

function AddTimezonePopover({ added, onAdd }: { added: string[]; onAdd: (tz: TzInfo) => void }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return ALL_TIMEZONES.filter((tz) => !added.includes(tz.id) && (
      tz.city.toLowerCase().includes(q) || tz.country.toLowerCase().includes(q) ||
      tz.region.toLowerCase().includes(q) || tz.id.toLowerCase().includes(q)));
  }, [query, added]);
  const regions = useMemo(() => [...new Set(filtered.map((z) => z.region))], [filtered]);

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
          <Input autoFocus placeholder="Search city or timezone…" value={query}
            onChange={(e) => setQuery(e.target.value)} className="h-8 pl-8 text-xs" />
        </div>
        <div className="max-h-64 overflow-y-auto space-y-3 pr-0.5">
          {regions.map((region) => (
            <div key={region}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1 mb-1">{region}</p>
              {filtered.filter((z) => z.region === region).map((tz) => (
                <button key={tz.id}
                  className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors text-left"
                  onClick={() => { onAdd(tz); setOpen(false); setQuery(""); }}>
                  <div className={cn("flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold", avatarColor(tz.id))}>
                    {initials(tz.city)}
                  </div>
                  <span className="flex-1 font-medium">{tz.city}</span>
                  {tz.country && <span className="text-xs text-muted-foreground">{tz.country}</span>}
                </button>
              ))}
            </div>
          ))}
          {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No timezones found.</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Scheduled call card ───────────────────────────────────────────────────────

function ScheduledCallCard({ call, zones, use24h, onRemove, onUpdateLabel }: {
  call: ScheduledCall; zones: TzInfo[]; use24h: boolean;
  onRemove: () => void; onUpdateLabel: (l: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const startRef  = buildRefDate(call.dateStr, Math.floor(call.startUtcMinutes / 60), call.startUtcMinutes % 60);
  const endRef    = buildRefDate(call.dateStr, Math.floor(call.endUtcMinutes   / 60), call.endUtcMinutes   % 60);
  const duration  = durationLabel(call.startUtcMinutes, call.endUtcMinutes);

  const copy = () => {
    navigator.clipboard.writeText(buildEmailText([call], zones));
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, height: 0 }} transition={{ duration: 0.18 }}
      className="border border-border rounded-lg overflow-hidden bg-card">
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border/60 bg-muted/30">
        <Video className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <input value={call.label} onChange={(e) => onUpdateLabel(e.target.value)}
          placeholder="Call label (optional)"
          className="flex-1 bg-transparent text-sm font-medium placeholder:text-muted-foreground/50 outline-none min-w-0" />
        <span className="text-xs text-muted-foreground flex-shrink-0">
          {formatDisplayDate(call.dateStr)} · {duration}
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={copy}
          title="Copy for email">
          {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
        <a href={buildGoogleCalendarUrl(call, zones)} target="_blank" rel="noopener noreferrer"
          title="Add to Google Calendar">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary">
            <CalendarPlus className="h-3.5 w-3.5" />
          </Button>
        </a>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
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
              {day !== dayBase && <span className="text-[10px] text-muted-foreground">({day})</span>}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function TimeConverterPage() {
  const { timezone: userTz, isReady } = useUserTimezone();
  const userTzInfo = findTimezone(userTz);

  const [now,            setNow]            = useState(new Date());
  const [dateStr,        setDateStr]        = useState(() => toLocalISODate(new Date()));
  const [startMinutes,   setStartMinutes]   = useState(540);   // 09:00 UTC default
  const [endMinutes,     setEndMinutes]     = useState(600);   // 10:00 UTC default
  const [dragging,       setDragging]       = useState<"start" | "end" | null>(null);
  const [zones,          setZones]          = useState<TzInfo[]>([]);
  const [scheduledCalls, setScheduledCalls] = useState<ScheduledCall[]>([]);
  const [isLive,         setIsLive]         = useState(false);
  const [copiedAll,      setCopiedAll]      = useState(false);
  const [use24h,         setUse24h]         = useState(true);
  const [snapMins,       setSnapMins]       = useState(15);

  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Init ──
  useEffect(() => {
    if (!isReady) return;
    const n    = new Date();
    const h    = n.getUTCHours();
    const m    = n.getUTCMinutes();
    const base = h * 60 + m;
    setStartMinutes(base);
    setEndMinutes(Math.min(1439, base + 60));
    setDateStr(toLocalISODate(n));
    setNow(n);
    setZones(["America/New_York", "Europe/London", "Asia/Tokyo"]
      .filter((id) => id !== userTz)
      .map((id) => findTimezone(id)));
    setTimeout(() => {
      if (scrollRef.current) {
        // Scroll to current LOCAL hour position (not UTC)
        const offsetMins = getOffsetMinutes(userTz, new Date(toLocalISODate(n) + "T12:00:00Z"));
        const localH     = Math.floor(((h * 60 + m + offsetMins) % 1440 + 1440) % 1440 / 60);
        const target     = localH * CELL_W - scrollRef.current.clientWidth / 2 + CELL_W / 2;
        scrollRef.current.scrollLeft = Math.max(0, target);
      }
    }, 80);
  }, [isReady, userTz]);

  const allZones: TzInfo[] = useMemo(() => [userTzInfo, ...zones], [userTzInfo, zones]);

  const startRef = buildRefDate(dateStr, Math.floor(startMinutes / 60), startMinutes % 60);
  const endRef   = buildRefDate(dateStr, Math.floor(endMinutes   / 60), endMinutes   % 60);

  // User's UTC offset in minutes — used to convert everything to LOCAL-time display positions
  const userOffsetMins = useMemo(
    () => getOffsetMinutes(userTz, buildRefDate(dateStr, 12, 0)),
    [userTz, dateStr],
  );

  // Convert UTC minutes → user's local minutes (for display/cursor X)
  const toLocalPos = useCallback(
    (utcM: number) => ((utcM + userOffsetMins) % 1440 + 1440) % 1440,
    [userOffsetMins],
  );

  // Convert local-position minutes → UTC minutes (for state updates)
  const toUtcFromPos = useCallback(
    (localM: number) => ((localM - userOffsetMins) % 1440 + 1440) % 1440,
    [userOffsetMins],
  );

  // Sorted UTC values
  const lo  = Math.min(startMinutes, endMinutes);
  const hi  = Math.max(startMinutes, endMinutes);

  // Range band in LOCAL-time pixel space
  const loX = (toLocalPos(lo) / 1439) * GRID_W;
  const hiX = (toLocalPos(hi) / 1439) * GRID_W;

  // ── Drag ──
  const startDrag = useCallback((which: "start" | "end", startClientX: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const baseUtcMins   = which === "start" ? startMinutes : endMinutes;
    const baseLocalMins = toLocalPos(baseUtcMins);

    setDragging(which);

    const onMove = (clientX: number) => {
      const deltaPx       = clientX - startClientX;
      const deltaLocalMins = (deltaPx / GRID_W) * 1439;
      const rawLocalMins  = Math.max(0, Math.min(1439, baseLocalMins + deltaLocalMins));
      const snappedLocal  = Math.round(rawLocalMins / snapMins) * snapMins;
      const newUtcMins    = toUtcFromPos(snappedLocal);
      if (which === "start") setStartMinutes(newUtcMins);
      else                   setEndMinutes(newUtcMins);

      // Edge autoscroll
      const rect = el.getBoundingClientRect();
      if (clientX - rect.left  < 60) el.scrollLeft -= 4;
      if (rect.right - clientX < 60) el.scrollLeft += 4;
    };

    const onMouseMove = (e: MouseEvent) => { e.preventDefault(); onMove(e.clientX); };
    const onTouchMove = (e: TouchEvent) => onMove(e.touches[0].clientX);
    const onEnd       = () => {
      setDragging(null);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup",   onEnd);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend",  onEnd);
    };

    document.addEventListener("mousemove", onMouseMove, { passive: false });
    document.addEventListener("mouseup",   onEnd);
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend",  onEnd);
  }, [startMinutes, endMinutes, toLocalPos, toUtcFromPos, snapMins]);

  // Click on header → snap nearest cursor
  const handleHeaderClick = (e: React.MouseEvent) => {
    if (dragging) return;
    const el = scrollRef.current;
    if (!el) return;
    const rect        = el.getBoundingClientRect();
    const xInGrid     = e.clientX - rect.left + el.scrollLeft;
    const localMins   = Math.max(0, Math.min(1439, Math.round((xInGrid / GRID_W) * 1439)));
    const snappedLocal = Math.round(localMins / snapMins) * snapMins;
    const utcMins     = toUtcFromPos(snappedLocal);
    const dStart      = Math.abs(utcMins - startMinutes);
    const dEnd        = Math.abs(utcMins - endMinutes);
    if (dStart <= dEnd) setStartMinutes(utcMins);
    else                setEndMinutes(utcMins);
  };

  const handleSchedule = () => {
    setScheduledCalls((p) => [...p, newCall(dateStr, lo, hi)]);
    toast.success("Call scheduled");
  };

  const copyAll = () => {
    navigator.clipboard.writeText(buildEmailText(scheduledCalls, allZones));
    setCopiedAll(true);
    toast.success("All calls copied");
    setTimeout(() => setCopiedAll(false), 2000);
  };

  if (!isReady) return null;

  return (
    <div className="container mx-auto py-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold">Time Converter</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Drag the <strong>Start</strong> and <strong>End</strong> handles to select a time range, then schedule.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Snap interval */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Snap</span>
            <div className="flex items-center border border-border rounded-md overflow-hidden">
              {[5, 10, 15, 30].map((m) => (
                <button key={m}
                  onClick={() => setSnapMins(m)}
                  className={cn(
                    "px-2 h-8 text-xs font-medium transition-colors",
                    snapMins === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>

          {/* 12h / 24h toggle */}
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <button
              onClick={() => setUse24h(true)}
              className={cn(
                "px-2.5 h-8 text-xs font-medium transition-colors",
                use24h ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >24h</button>
            <button
              onClick={() => setUse24h(false)}
              className={cn(
                "px-2.5 h-8 text-xs font-medium transition-colors",
                !use24h ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >12h</button>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 font-normal">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDisplayDate(dateStr)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={parseDateStr(dateStr)}
                onSelect={(date) => { if (date) setDateStr(toLocalISODate(date)); }}
                captionLayout="dropdown"
              />
            </PopoverContent>
          </Popover>
          <AddTimezonePopover
            added={allZones.map((z) => z.id)}
            onAdd={(tz) => setZones((p) => [...p, tz])}
          />
        </div>
      </div>

      {/* ── Grid ── */}
      {allZones.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden bg-card">

          {/* ── Date navigation header ── */}
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-2">
            <Button
              variant="ghost" size="sm"
              className="h-8 gap-1 text-muted-foreground hover:text-foreground"
              onClick={() => setDateStr(addDays(dateStr, -1))}
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <span className="text-sm font-semibold">{formatDisplayDate(dateStr)}</span>
            <Button
              variant="ghost" size="sm"
              className="h-8 gap-1 text-muted-foreground hover:text-foreground"
              onClick={() => setDateStr(addDays(dateStr, 1))}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Two-column layout: fixed labels | scrollable grid */}
          <div className="flex">

            {/* ── Fixed left labels column ── */}
            <div className="flex-shrink-0 w-52 border-r border-border">
              {/* Header spacer — matches HEAD_H */}
              <div
                style={{ height: HEAD_H }}
                className="flex items-end pb-2.5 px-3 bg-muted/40 border-b border-border"
              >
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Timezone
                </span>
              </div>

              {/* One label per timezone row */}
              {allZones.map((tz) => {
                const isUserTz = tz.id === userTz;
                const color    = avatarColor(tz.id);
                const offset   = getUtcOffset(tz.id, startRef);
                return (
                  <div
                    key={tz.id}
                    className={cn(
                      "flex items-center gap-2 px-3 border-b border-border/30 last:border-0",
                      isUserTz && "bg-primary/[0.03]",
                    )}
                    style={{ height: ROW_H }}
                  >
                    <div className={cn("flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold", color)}>
                      {isUserTz ? <User className="h-2.5 w-2.5" /> : initials(tz.city)}
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div className="flex items-center gap-1 leading-none">
                        <span className="text-xs font-medium truncate">{tz.city}</span>
                        {isUserTz && (
                          <span className="text-[9px] bg-primary/10 text-primary px-1 rounded font-medium flex-shrink-0">You</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {tz.country && (
                          <span className="text-[10px] text-muted-foreground font-medium">{tz.country}</span>
                        )}
                        {tz.country && <span className="text-muted-foreground/40 text-[10px]">·</span>}
                        <span className="text-[10px] text-muted-foreground font-mono">{offset}</span>
                      </div>
                    </div>
                    {!isUserTz && (
                      <Button
                        variant="ghost" size="icon"
                        className="h-5 w-5 text-muted-foreground flex-shrink-0 -mr-1"
                        onClick={() => setZones((p) => p.filter((z) => z.id !== tz.id))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Scrollable grid ── */}
            <div ref={scrollRef} className="flex-1 overflow-x-auto scrollbar-hide min-w-0">
              <div style={{ width: GRID_W }} className="relative">

                {/* Header row */}
                <div
                  style={{ height: HEAD_H }}
                  className="relative flex bg-muted/40 border-b border-border cursor-crosshair"
                  onClick={handleHeaderClick}
                >
                  {Array.from({ length: 24 }, (_, localH) => {
                    const loLocalMins = toLocalPos(lo);
                    const hiLocalMins = toLocalPos(hi);
                    const inRange = localH * 60 >= loLocalMins && localH * 60 <= hiLocalMins;
                    return (
                      <div key={localH} style={{ width: CELL_W, height: HEAD_H }}
                        className={cn(
                          "flex-shrink-0 flex items-end justify-center pb-2 text-[11px] font-mono font-medium pointer-events-none",
                          inRange ? "text-primary font-bold" : "text-muted-foreground/50",
                        )}>
                        {String(localH).padStart(2, "0")}
                      </div>
                    );
                  })}

                  <div className="absolute top-0 bottom-0 bg-primary/20 pointer-events-none"
                    style={{ left: loX, width: hiX - loX }} />

                  <Cursor minutes={startMinutes} label="Start" variant="start"
                    isActive={dragging === "start"} gridW={GRID_W}
                    dateStr={dateStr} userTz={userTz} userTzCity={userTzInfo.city}
                    use24h={use24h} userOffsetMins={userOffsetMins}
                    onDragStart={(e) => {
                      e.stopPropagation();
                      startDrag("start", "touches" in e ? e.touches[0].clientX : e.clientX);
                    }} />

                  <Cursor minutes={endMinutes} label="End" variant="end"
                    isActive={dragging === "end"} gridW={GRID_W}
                    dateStr={dateStr} userTz={userTz} userTzCity={userTzInfo.city}
                    use24h={use24h} userOffsetMins={userOffsetMins}
                    onDragStart={(e) => {
                      e.stopPropagation();
                      startDrag("end", "touches" in e ? e.touches[0].clientX : e.clientX);
                    }} />
                </div>

                {/* Timezone rows */}
                <div className="relative">
                  {allZones.map((tz) => {
                    const isUserTz    = tz.id === userTz;
                    const loLocalMins = toLocalPos(lo);
                    const hiLocalMins = toLocalPos(hi);

                    const localHours  = Array.from({ length: 24 }, (_, localH) => {
                      const utcMins = ((localH * 60 - userOffsetMins) % 1440 + 1440) % 1440;
                      const d = buildRefDate(dateStr, Math.floor(utcMins / 60), utcMins % 60);
                      return getLocalHour(d, tz.id);
                    });

                    return (
                      <div
                        key={tz.id}
                        className={cn(
                          "flex gap-px border-b border-border/30 last:border-0 px-px",
                          isUserTz ? "bg-primary/10" : "bg-border/20",
                        )}
                        style={{ height: ROW_H }}
                      >
                        {localHours.map((lh, localH) => {
                          const inRange  = localH * 60 >= loLocalMins && localH * 60 < hiLocalMins;
                          const isFirst  = inRange && (localH - 1) * 60 < loLocalMins;
                          const isLast   = inRange && (localH + 1) * 60 >= hiLocalMins;

                          return (
                            <div
                              key={localH}
                              className={cn(
                                "flex-shrink-0 flex items-center justify-center text-[11px] font-mono transition-all my-px",
                                inRange
                                  ? cn(
                                      "bg-primary text-primary-foreground font-semibold shadow-sm",
                                      isFirst && "rounded-l-md",
                                      isLast  && "rounded-r-md",
                                    )
                                  : cn(
                                      "rounded-sm",
                                      blockStyle(lh),
                                    ),
                              )}
                              style={{ width: CELL_W - 1, height: ROW_H - 2 }}
                            >
                              {formatHour(lh, use24h)}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

              </div>
            </div>
          </div>

          {/* ── Compact footer: time per zone + duration + schedule ── */}
          <div className="border-t border-border bg-muted/10 px-4 py-2.5 flex items-center gap-x-6 gap-y-1.5 flex-wrap">
            {allZones.map((tz) => {
              const isUserTz = tz.id === userTz;
              const t1       = fmt(startRef, tz.id, { hour: "numeric", minute: "2-digit", hour12: !use24h });
              const t2       = fmt(endRef,   tz.id, { hour: "numeric", minute: "2-digit", hour12: !use24h });
              const day1     = fmt(startRef, tz.id, { weekday: "short", month: "short", day: "numeric" });
              const dayBase  = fmt(parseDateStr(dateStr), tz.id, { weekday: "short", month: "short", day: "numeric" });
              return (
                <div key={tz.id} className="flex items-center gap-1.5 flex-shrink-0">
                  <div className={cn("flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-semibold", avatarColor(tz.id))}>
                    {isUserTz ? <User className="h-2.5 w-2.5" /> : initials(tz.city)}
                  </div>
                  <span className="text-xs text-muted-foreground">{tz.city}</span>
                  <span className={cn("text-xs font-mono tabular-nums", isUserTz ? "font-bold text-foreground" : "text-foreground/80")}>
                    {t1}<span className="text-muted-foreground mx-1">–</span>{t2}
                  </span>
                  {day1 !== dayBase && (
                    <span className="text-[10px] text-muted-foreground">({day1})</span>
                  )}
                </div>
              );
            })}

            <div className="flex items-center gap-3 ml-auto flex-shrink-0">
              <span className="text-xs text-muted-foreground">
                Duration <span className="font-semibold text-foreground">{durationLabel(lo, hi)}</span>
              </span>
              <Button size="sm" className="gap-1.5" onClick={handleSchedule}>
                <Video className="h-3.5 w-3.5" /> Schedule this call
              </Button>
            </div>
          </div>

        </div>
      )}

      {/* ── Scheduled Calls ── */}
      <AnimatePresence initial={false}>
        {scheduledCalls.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Scheduled Calls</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {scheduledCalls.length} call{scheduledCalls.length !== 1 ? "s" : ""}
                </p>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={copyAll}>
                {copiedAll ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedAll ? "Copied!" : "Copy all for email"}
              </Button>
            </div>
            <Separator />
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {scheduledCalls.map((call) => (
                  <ScheduledCallCard key={call.id} call={call} zones={allZones} use24h={use24h}
                    onRemove={() => setScheduledCalls((p) => p.filter((c) => c.id !== call.id))}
                    onUpdateLabel={(label) =>
                      setScheduledCalls((p) => p.map((c) => c.id === call.id ? { ...c, label } : c))}
                  />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Empty state ── */}
      {allZones.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Globe className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No timezones added</p>
          <p className="text-sm text-muted-foreground">Click "Add timezone" to get started.</p>
        </div>
      )}

      {/* ── Legend ── */}
      {allZones.length > 0 && (
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground">Grid:</span>
          {[
            { label: "Night",    cls: "bg-muted/20"  },
            { label: "Shoulder", cls: "bg-muted/60"  },
            { label: "Working",  cls: "bg-muted/90"  },
            { label: "Range",    cls: "bg-primary/20" },
          ].map(({ label, cls }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={cn("h-3 w-5 rounded-sm", cls)} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
