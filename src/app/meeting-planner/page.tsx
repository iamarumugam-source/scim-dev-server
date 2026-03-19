"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Clock,
  Globe,
  Copy,
  Check,
  CalendarDays,
  User,
  Video,
  ArrowLeft,
  ArrowRight,
  X,
  GripVertical,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
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
import { usePageTracking } from "@/hooks/usePageTracking";
import {
  TzInfo,
  findTimezone,
  getUtcOffset,
  getOffsetMinutes,
} from "@/lib/timezones";

import {
  CELL_W,
  GRID_W,
  ROW_H,
  HEAD_H,
  avatarColor,
  initials,
  fmt,
  getLocalHour,
  blockStyle,
  timeCellBg,
  toLocalISODate,
  parseDateStr,
  formatDisplayDate,
  buildRefDate,
  formatHour,
  addDays,
  durationLabel,
} from "./utils";
import { ScheduledCall, newCall, buildEmailText } from "./types";
import { Cursor } from "./cursor";
import { AddTimezonePopover } from "./add-timezone-popover";
import { ScheduledCallCard } from "./scheduled-call-card";

export default function TimeConverterPage() {
  usePageTracking();
  const { timezone: userTz, isReady } = useUserTimezone();
  const userTzInfo = findTimezone(userTz);

  const [dateStr, setDateStr] = useState(() => toLocalISODate(new Date()));
  const [startMinutes, setStartMinutes] = useState(540);
  const [endMinutes, setEndMinutes] = useState(600);
  const [dragging, setDragging] = useState<"start" | "end" | null>(null);
  const [zones, setZones] = useState<TzInfo[]>([]);
  const [scheduledCalls, setScheduledCalls] = useState<ScheduledCall[]>([]);
  const [copiedAll, setCopiedAll] = useState(false);
  const [use24h, setUse24h] = useState(false);
  const [snapMins, setSnapMins] = useState(15);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isReady) return;
    const n = new Date();
    const h = n.getUTCHours();
    const m = n.getUTCMinutes();
    const base = h * 60 + m;
    setStartMinutes(base);
    setEndMinutes(Math.min(1439, base + 60));
    setDateStr(toLocalISODate(n));
    setZones(
      ["America/New_York", "Europe/London", "Asia/Tokyo"]
        .filter((id) => id !== userTz)
        .map((id) => findTimezone(id)),
    );
    setTimeout(() => {
      if (scrollRef.current) {
        const offsetMins = getOffsetMinutes(
          userTz,
          new Date(toLocalISODate(n) + "T12:00:00Z"),
        );
        const localH = Math.floor(
          ((((h * 60 + m + offsetMins) % 1440) + 1440) % 1440) / 60,
        );
        const target =
          localH * CELL_W - scrollRef.current.clientWidth / 2 + CELL_W / 2;
        scrollRef.current.scrollLeft = Math.max(0, target);
      }
    }, 80);
  }, [isReady, userTz]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const allZones: TzInfo[] = useMemo(
    () => [userTzInfo, ...zones],
    [userTzInfo, zones],
  );
  const startRef = buildRefDate(
    dateStr,
    Math.floor(startMinutes / 60),
    startMinutes % 60,
  );
  const endRef = buildRefDate(
    dateStr,
    Math.floor(endMinutes / 60),
    endMinutes % 60,
  );
  const lo = Math.min(startMinutes, endMinutes);
  const hi = Math.max(startMinutes, endMinutes);

  // User's UTC offset — converts everything to LOCAL-time display positions
  const userOffsetMins = useMemo(
    () => getOffsetMinutes(userTz, buildRefDate(dateStr, 12, 0)),
    [userTz, dateStr],
  );

  const toLocalPos = useCallback(
    (utcM: number) => (((utcM + userOffsetMins) % 1440) + 1440) % 1440,
    [userOffsetMins],
  );

  const toUtcFromPos = useCallback(
    (localM: number) => (((localM - userOffsetMins) % 1440) + 1440) % 1440,
    [userOffsetMins],
  );

  // Compute each cursor's local X independently then take min/max —
  // prevents negative width when the range wraps across local midnight
  const startLocalX = (toLocalPos(startMinutes) / 1439) * GRID_W;
  const endLocalX = (toLocalPos(endMinutes) / 1439) * GRID_W;
  const loX = Math.min(startLocalX, endLocalX);
  const hiX = Math.max(startLocalX, endLocalX);

  // ── Drag ──────────────────────────────────────────────────────────────────

  const startDrag = useCallback(
    (which: "start" | "end", startClientX: number) => {
      const el = scrollRef.current;
      if (!el) return;
      const baseLocalMins = toLocalPos(
        which === "start" ? startMinutes : endMinutes,
      );
      setDragging(which);

      const onMove = (clientX: number) => {
        const deltaPx = clientX - startClientX;
        const deltaLocalMins = (deltaPx / GRID_W) * 1439;
        const rawLocalMins = Math.max(
          0,
          Math.min(1439, baseLocalMins + deltaLocalMins),
        );
        const snapped = Math.round(rawLocalMins / snapMins) * snapMins;
        const newUtcMins = toUtcFromPos(snapped);
        if (which === "start") setStartMinutes(newUtcMins);
        else setEndMinutes(newUtcMins);
        const rect = el.getBoundingClientRect();
        if (clientX - rect.left < 60) el.scrollLeft -= 4;
        if (rect.right - clientX < 60) el.scrollLeft += 4;
      };

      const onMouseMove = (e: MouseEvent) => {
        e.preventDefault();
        onMove(e.clientX);
      };
      const onTouchMove = (e: TouchEvent) => onMove(e.touches[0].clientX);
      const onEnd = () => {
        setDragging(null);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onEnd);
        document.removeEventListener("touchmove", onTouchMove);
        document.removeEventListener("touchend", onEnd);
      };
      document.addEventListener("mousemove", onMouseMove, { passive: false });
      document.addEventListener("mouseup", onEnd);
      document.addEventListener("touchmove", onTouchMove, { passive: true });
      document.addEventListener("touchend", onEnd);
    },
    [startMinutes, endMinutes, toLocalPos, toUtcFromPos, snapMins],
  );

  const handleHeaderClick = (e: React.MouseEvent) => {
    if (dragging) return;
    const el = scrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const xInGrid = e.clientX - rect.left + el.scrollLeft;
    const localMins = Math.max(
      0,
      Math.min(1439, Math.round((xInGrid / GRID_W) * 1439)),
    );
    const snapped = Math.round(localMins / snapMins) * snapMins;
    const utcMins = toUtcFromPos(snapped);
    const dStart = Math.abs(utcMins - startMinutes);
    const dEnd = Math.abs(utcMins - endMinutes);
    if (dStart <= dEnd) setStartMinutes(utcMins);
    else setEndMinutes(utcMins);
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <motion.div
      className="container mx-auto py-6 space-y-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold">Meeting Planner</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Drag the <strong>Start</strong> and <strong>End</strong> handles to
            select a time range, then schedule.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Snap interval */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Snap</span>
            <div className="flex items-center border border-border rounded-md overflow-hidden">
              {[5, 10, 15, 30].map((m) => (
                <button
                  key={m}
                  onClick={() => setSnapMins(m)}
                  className={cn(
                    "px-2 h-8 text-xs font-medium transition-colors",
                    snapMins === m
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted",
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
                use24h
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              24h
            </button>
            <button
              onClick={() => setUse24h(false)}
              className={cn(
                "px-2.5 h-8 text-xs font-medium transition-colors",
                !use24h
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              12h
            </button>
          </div>

          <AddTimezonePopover
            added={allZones.map((z) => z.id)}
            onAdd={(tz) => setZones((p) => [...p, tz])}
          />
        </div>
      </div>

      {/* Grid */}
      {allZones.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden bg-card">
          {/* Date navigation */}
          <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-1.5">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1.5 font-semibold text-sm">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatDisplayDate(dateStr)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={parseDateStr(dateStr)}
                  onSelect={(date) => { if (date) setDateStr(toLocalISODate(date)); }}
                  captionLayout="dropdown"
                />
              </PopoverContent>
            </Popover>
            <div className="flex items-stretch rounded-md overflow-hidden border border-border">
              <button
                onClick={() => setDateStr(addDays(dateStr, -1))}
                className="px-3 h-7 flex items-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors border-r border-border"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setDateStr(addDays(dateStr, 1))}
                className="px-3 h-7 flex items-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex">
            {/* Fixed labels column */}
            <div className="flex-shrink-0 w-52 border-r border-border">
              <div
                style={{ height: HEAD_H }}
                className="flex flex-col items-center justify-center gap-1.5 bg-muted/40 border-b border-border"
              >
                <Globe className="h-3.5 w-3.5 text-foreground/70" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-foreground/80">
                  Timezone
                </span>
              </div>
              {allZones.map((tz, allIdx) => {
                const isUserTz = tz.id === userTz;
                const zonesIdx = allIdx - 1; // index into zones[] (allIdx 0 = user)
                const offset = getUtcOffset(tz.id, startRef);
                const isDragging = !isUserTz && dragFrom === zonesIdx;
                const isDropTarget =
                  !isUserTz && dragOver === zonesIdx && dragFrom !== zonesIdx;
                return (
                  <div
                    key={tz.id}
                    draggable={!isUserTz}
                    onDragStart={
                      !isUserTz ? () => setDragFrom(zonesIdx) : undefined
                    }
                    onDragOver={
                      !isUserTz
                        ? (e) => {
                            e.preventDefault();
                            setDragOver(zonesIdx);
                          }
                        : undefined
                    }
                    onDrop={
                      !isUserTz
                        ? () => {
                            if (
                              dragFrom !== null &&
                              dragOver !== null &&
                              dragFrom !== dragOver
                            ) {
                              const next = [...zones];
                              const [item] = next.splice(dragFrom, 1);
                              next.splice(dragOver, 0, item);
                              setZones(next);
                            }
                            setDragFrom(null);
                            setDragOver(null);
                          }
                        : undefined
                    }
                    onDragEnd={() => {
                      setDragFrom(null);
                      setDragOver(null);
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 border-b border-border/80 last:border-0 transition-opacity",
                      isUserTz
                        ? "bg-primary/[0.03]"
                        : "cursor-grab active:cursor-grabbing",
                      isDragging && "opacity-40",
                      isDropTarget && "border-t-2 border-t-primary",
                    )}
                    style={{ height: ROW_H }}
                  >
                    {!isUserTz && (
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0 -ml-1" />
                    )}
                    <div
                      className={cn(
                        "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                        avatarColor(tz.id),
                      )}
                    >
                      {isUserTz ? (
                        <User className="h-2.5 w-2.5" />
                      ) : (
                        initials(tz.city)
                      )}
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div className="flex items-center gap-1 leading-none">
                        <span className="text-xs font-medium truncate">
                          {tz.city}
                        </span>
                        {isUserTz && (
                          <span className="text-[9px] bg-primary/10 text-primary px-1 rounded font-medium flex-shrink-0">
                            You
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {tz.country && (
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {tz.country}
                          </span>
                        )}
                        {tz.country && (
                          <span className="text-muted-foreground/40 text-[10px]">
                            ·
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {offset}
                        </span>
                      </div>
                    </div>
                    {!isUserTz && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground flex-shrink-0 -mr-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setZones((p) => p.filter((z) => z.id !== tz.id));
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Scrollable grid */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-x-auto scrollbar-hide min-w-0"
            >
              <div style={{ width: GRID_W }} className="relative">
                {/* Header row with cursors */}
                <div
                  style={{ height: HEAD_H }}
                  className="relative flex bg-muted/40 border-b border-border cursor-crosshair"
                  onClick={handleHeaderClick}
                >
                  {Array.from({ length: 24 }, (_, localH) => (
                    <div
                      key={localH}
                      style={{ width: CELL_W, height: HEAD_H }}
                      className={cn(
                        "flex-shrink-0 flex items-end justify-center pb-2 text-[11px] font-mono font-medium pointer-events-none text-muted-foreground/50",
                        timeCellBg(localH),
                      )}
                    >
                      {String(localH).padStart(2, "0")}
                    </div>
                  ))}
                </div>

                {/* Timezone rows */}
                <div className="relative">
                  {allZones.map((tz) => {
                    const isUserTz = tz.id === userTz;
                    const localHours = Array.from(
                      { length: 24 },
                      (_, localH) => {
                        const utcMins =
                          (((localH * 60 - userOffsetMins) % 1440) + 1440) %
                          1440;
                        const d = buildRefDate(
                          dateStr,
                          Math.floor(utcMins / 60),
                          utcMins % 60,
                        );
                        return getLocalHour(d, tz.id);
                      },
                    );
                    return (
                      <div
                        key={tz.id}
                        className={cn(
                          "flex gap-px px-px border-b border-border/60 last:border-0",
                          isUserTz ? "bg-primary/20" : "bg-border/50",
                        )}
                        style={{ height: ROW_H }}
                      >
                        {localHours.map((lh, localH) => (
                          <div
                            key={localH}
                            className={cn(
                              "flex-shrink-0 flex items-center justify-center text-[11px] font-mono transition-colors rounded-sm my-px",
                              blockStyle(lh),
                            )}
                            style={{ width: CELL_W - 1, height: ROW_H - 2 }}
                          >
                            {formatHour(lh, use24h)}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>

                {/* Range highlight — spans full grid height (header + all rows) */}
                <div
                  className="absolute top-0 bottom-0 bg-primary/15 pointer-events-none"
                  style={{ left: loX, width: hiX - loX }}
                />

                {/* Cursors — outside header/rows so they span the full grid height */}
                <Cursor
                  minutes={startMinutes}
                  label="Start"
                  variant="start"
                  isActive={dragging === "start"}
                  gridW={GRID_W}
                  dateStr={dateStr}
                  userTz={userTz}
                  userTzCity={userTzInfo.city}
                  use24h={use24h}
                  userOffsetMins={userOffsetMins}
                  onDragStart={(e) => {
                    e.stopPropagation();
                    startDrag(
                      "start",
                      "touches" in e ? e.touches[0].clientX : e.clientX,
                    );
                  }}
                />
                <Cursor
                  minutes={endMinutes}
                  label="End"
                  variant="end"
                  isActive={dragging === "end"}
                  gridW={GRID_W}
                  dateStr={dateStr}
                  userTz={userTz}
                  userTzCity={userTzInfo.city}
                  use24h={use24h}
                  userOffsetMins={userOffsetMins}
                  onDragStart={(e) => {
                    e.stopPropagation();
                    startDrag(
                      "end",
                      "touches" in e ? e.touches[0].clientX : e.clientX,
                    );
                  }}
                />
              </div>
            </div>
          </div>

          {/* Compact footer */}
          <div className="border-t border-border bg-muted/10 px-4 py-2.5 flex items-center gap-x-6 gap-y-1.5 flex-wrap">
            {allZones.map((tz) => {
              const isUserTz = tz.id === userTz;
              const t1 = fmt(startRef, tz.id, {
                hour: "numeric",
                minute: "2-digit",
                hour12: !use24h,
              });
              const t2 = fmt(endRef, tz.id, {
                hour: "numeric",
                minute: "2-digit",
                hour12: !use24h,
              });
              const day1 = fmt(startRef, tz.id, {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
              const dayBase = fmt(parseDateStr(dateStr), tz.id, {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
              return (
                <div
                  key={tz.id}
                  className="flex items-center gap-1.5 flex-shrink-0"
                >
                  <div
                    className={cn(
                      "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-semibold",
                      avatarColor(tz.id),
                    )}
                  >
                    {isUserTz ? (
                      <User className="h-2.5 w-2.5" />
                    ) : (
                      initials(tz.city)
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {tz.city}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-mono tabular-nums",
                      isUserTz
                        ? "font-bold text-foreground"
                        : "text-foreground/80",
                    )}
                  >
                    {t1}
                    <span className="text-muted-foreground mx-1">–</span>
                    {t2}
                  </span>
                  {day1 !== dayBase && (
                    <span className="text-[10px] text-muted-foreground">
                      ({day1})
                    </span>
                  )}
                </div>
              );
            })}
            <div className="flex items-center gap-3 ml-auto flex-shrink-0">
              <span className="text-xs text-muted-foreground">
                Duration{" "}
                <span className="font-semibold text-foreground">
                  {durationLabel(lo, hi)}
                </span>
              </span>
              <Button size="sm" className="gap-1.5" onClick={handleSchedule}>
                <Video className="h-3.5 w-3.5" /> Schedule this call
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Scheduled Calls */}
      <AnimatePresence initial={false}>
        {scheduledCalls.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Scheduled Calls</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {scheduledCalls.length} call
                  {scheduledCalls.length !== 1 ? "s" : ""}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={copyAll}
              >
                {copiedAll ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copiedAll ? "Copied!" : "Copy all for email"}
              </Button>
            </div>
            <Separator />
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {scheduledCalls.map((call) => (
                  <ScheduledCallCard
                    key={call.id}
                    call={call}
                    zones={allZones}
                    use24h={use24h}
                    onRemove={() =>
                      setScheduledCalls((p) =>
                        p.filter((c) => c.id !== call.id),
                      )
                    }
                    onUpdateLabel={(label) =>
                      setScheduledCalls((p) =>
                        p.map((c) => (c.id === call.id ? { ...c, label } : c)),
                      )
                    }
                  />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {allZones.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Globe className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No timezones added</p>
          <p className="text-sm text-muted-foreground">
            Click "Add timezone" to get started.
          </p>
        </div>
      )}
    </motion.div>
  );
}
