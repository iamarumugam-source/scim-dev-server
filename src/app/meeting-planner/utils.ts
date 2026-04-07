
// ─── Grid constants ────────────────────────────────────────────────────────────

export const CELL_W = 48;
export const GRID_W = CELL_W * 24;
export const ROW_H  = 44;
export const HEAD_H = 68;

// ─── Avatar colours ────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300",
  "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300",
];

export function avatarColor(str: string): string {
  const hash = Array.from(str).reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

// ─── Formatting ────────────────────────────────────────────────────────────────

export function fmt(date: Date, tz: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opts }).format(date);
}

export function getLocalHour(date: Date, tz: string): number {
  return parseInt(fmt(date, tz, { hour: "numeric", hour12: false })) % 24;
}

/**
 * Returns the background Tailwind class for a given local hour.
 * Used by both header cells (user's local time) and grid cells (row timezone's local hour).
 */
export function timeCellBg(h: number): string {
  if (h <= 5 || h >= 22)              return "bg-muted/50";   // deep night
  if (h === 6  || h === 21)           return "bg-primary/5";  // dawn / dusk
  if ((h >= 7 && h <= 8) || (h >= 19 && h <= 20)) return "bg-primary/10"; // morning / evening
  return "";                                                   // day — inherit container
}

/**
 * Returns background + text Tailwind classes for a grid data cell based on the
 * timezone-local hour, giving the grid a subtle time-of-day gradient feel.
 */
export function blockStyle(h: number): string {
  if (h <= 5 || h >= 22)              return "bg-muted/50 text-muted-foreground/60";
  if (h === 6  || h === 21)           return "bg-primary/5  text-foreground/60";
  if ((h >= 7 && h <= 8) || (h >= 19 && h <= 20)) return "bg-primary/10 text-foreground/70";
  return "bg-card text-foreground/80";
}

export function initials(city: string): string {
  return city.split(/[\s-]/).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

export function toLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDisplayDate(dateStr: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  }).format(parseDateStr(dateStr));
}

export function buildRefDate(dateStr: string, utcHour: number, utcMinute: number): Date {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCHours(utcHour, utcMinute, 0, 0);
  return d;
}

export function formatHour(h: number, use24h: boolean): string {
  if (use24h) return String(h).padStart(2, "0");
  if (h === 0)  return "12a";
  if (h < 12)   return `${h}a`;
  if (h === 12) return "12p";
  return `${h - 12}p`;
}

export function addDays(dateStr: string, n: number): string {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + n);
  return toLocalISODate(d);
}

export function durationLabel(startMins: number, endMins: number): string {
  const diff = Math.abs(endMins - startMins);
  const h    = Math.floor(diff / 60);
  const m    = diff % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
