import { TzInfo, getUtcOffset } from "@/lib/timezones";
import { fmt, buildRefDate, parseDateStr, durationLabel } from "./utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ScheduledCall {
  id:              string;
  dateStr:         string;
  startUtcMinutes: number;
  endUtcMinutes:   number;
  label:           string;
}

export function newCall(dateStr: string, start: number, end: number): ScheduledCall {
  return { id: crypto.randomUUID(), dateStr, startUtcMinutes: start, endUtcMinutes: end, label: "" };
}

// ─── Email export ──────────────────────────────────────────────────────────────

export function buildEmailText(calls: ScheduledCall[], zones: TzInfo[]): string {
  return calls.map((call) => {
    const startRef = buildRefDate(call.dateStr, Math.floor(call.startUtcMinutes / 60), call.startUtcMinutes % 60);
    const endRef   = buildRefDate(call.dateStr, Math.floor(call.endUtcMinutes   / 60), call.endUtcMinutes   % 60);
    const dateHdr  = new Intl.DateTimeFormat("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
    }).format(startRef);
    const dur   = durationLabel(call.startUtcMinutes, call.endUtcMinutes);
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

// ─── Google Calendar export ────────────────────────────────────────────────────

export function buildGoogleCalendarUrl(call: ScheduledCall, zones: TzInfo[]): string {
  const startRef = buildRefDate(call.dateStr, Math.floor(call.startUtcMinutes / 60), call.startUtcMinutes % 60);
  const endRef   = buildRefDate(call.dateStr, Math.floor(call.endUtcMinutes   / 60), call.endUtcMinutes   % 60);

  const gcalDt = (d: Date) => d.toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";

  const shortTime = (d: Date, tz: string) =>
    fmt(d, tz, { hour: "numeric", minute: "2-digit", hour12: true })
      .replace(":00 AM", "a").replace(" AM", "a")
      .replace(":00 PM", "p").replace(" PM", "p")
      .replace(":30 AM", ":30a").replace(":30 PM", ":30p")
      .replace(/:(\d\d) AM/, ":$1a").replace(/:(\d\d) PM/, ":$1p");

  const shortDate = (d: Date, tz: string) =>
    fmt(d, tz, { weekday: "short", month: "short", day: "numeric", year: "numeric" })
      .replace(/(\w{3} \d+),/, "$1");

  const tzAbbr = (d: Date, tz: string) => {
    const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(d);
    return p.find((x) => x.type === "timeZoneName")?.value ?? tz;
  };

  const tzLong = (d: Date, tz: string) => {
    const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "long" }).formatToParts(d);
    return p.find((x) => x.type === "timeZoneName")?.value ?? tz;
  };

  let details = "";
  for (const tz of zones) {
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
