"use client";

// Visualization primitives for the dashboard preview.
//
// Built on shadcn primitives throughout: Card for every panel, the shadcn
// `chart` wrapper (ChartContainer / ChartTooltip / ChartLegend) over Recharts for
// the real charts, Empty for empty states, Badge for status. Only the composite
// proportion bar and the rate meter are hand-rolled — this project has no
// shadcn Progress component, and both are single composite bars rather than
// charts.
//
// ─── Colour ───────────────────────────────────────────────────────────────────
// Series colours are declared as ChartConfig `theme: { light, dark }`, which the
// shadcn ChartStyle turns into per-mode `--color-<key>` custom properties
// (THEMES = { light: "", dark: ".dark" }, matching this app's class-based dark
// mode). Non-Recharts marks read the roles from <VizTokens/>.
//
// Validated with the dataviz validator against this app's REAL surfaces
// (light #ffffff, dark #18181b):
//   light — all checks pass; contrast WARN on aqua/yellow/magenta, relieved by
//           the direct value labels every chart here ships
//   dark  — all checks pass, including contrast
//
// The app's own --chart-1..5 are deliberately NOT used: they are five steps of a
// single blue hue (a sequential ramp), so using them for categorical series
// renders adjacent series near-indistinguishable — and the light and dark blocks
// hold identical values, i.e. never re-stepped for a dark surface.

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, Cell, LabelList,
  CartesianGrid, XAxis, YAxis,
} from "recharts";
import {
  Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from "@/components/ui/chart";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Palette ──────────────────────────────────────────────────────────────────

export const CATEGORICAL: { light: string; dark: string }[] = [
  { light: "#2a78d6", dark: "#3987e5" }, // blue
  { light: "#eb6834", dark: "#d95926" }, // orange
  { light: "#1baf7a", dark: "#199e70" }, // aqua
  { light: "#eda100", dark: "#c98500" }, // yellow
  { light: "#e87ba4", dark: "#d55181" }, // magenta
];

const SEQ  = { light: "#2a78d6", dark: "#3987e5" };
const FILL = { light: "#cde2fb", dark: "#104281" };

export function VizTokens() {
  return (
    <style>{`
      .viz {
        --seq-strong: ${SEQ.light}; --seq-soft: ${FILL.light};
        --status-good: #0ca30c; --status-warning: #fab219;
        --status-serious: #ec835a; --status-critical: #d03b3b;
        --inactive: ${CATEGORICAL[4].light};
      }
      .dark .viz {
        --seq-strong: ${SEQ.dark}; --seq-soft: ${FILL.dark};
        --inactive: ${CATEGORICAL[4].dark};
      }
    `}</style>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────
// The shipped dashboard defines a SectionLabel but has it commented out at both
// call sites, leaving 9+ cards as one flat wall. This reinstates grouping.

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        {/* A short accent rule gives each section a visible start; without it the
            headings float and the page reads as one undifferentiated column. */}
        <span className="h-3.5 w-1 rounded-full bg-[color:var(--seq-strong)]" />
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</h2>
        {hint && <span className="text-[11px] text-muted-foreground/70">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

// ─── Stat tile ────────────────────────────────────────────────────────────────
// A bare number is the right form for a single magnitude — no chart.

// Decorative identity tints for tile icons. Deliberately NOT the status palette
// — status colours (good/warning/serious/critical) are reserved for state and
// must never be spent on decoration, or a red icon stops meaning "problem".
// These are the same contrast-safe tint/text pairs the avatars and entitlement
// badges already use, so this adds colour without adding a new palette.
const ACCENTS = {
  blue:    "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  violet:  "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  amber:   "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  rose:    "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
  sky:     "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",
} as const;

export type Accent = keyof typeof ACCENTS;

export function StatTile({
  label, value, sub, tone = "default", icon, spark, delta, href, accent,
}: {
  label: string;
  value: string | number;
  sub?: ReactNode;
  tone?: "default" | "good" | "warning" | "critical";
  icon?: ReactNode;
  spark?: { label: string; count: number }[];
  /** Week-over-week percentage. null means no prior period to compare against. */
  delta?: number | null;
  /** When set, the whole tile becomes a link — tiles were previously dead ends. */
  href?: string;
  /** Decorative icon tint. Identity only — never encodes state. */
  accent?: Accent;
}) {
  const toneClass = {
    default:  "",
    good:     "text-[color:var(--status-good)]",
    warning:  "text-[color:var(--status-warning)]",
    critical: "text-[color:var(--status-critical)]",
  }[tone];

  const inner = (
    <Card className={cn("h-full gap-0", href && "transition-colors hover:border-primary/40 hover:bg-accent/40")}>
      <CardHeader className="pb-0">
        <CardDescription className="text-[11px] font-medium uppercase tracking-wider">
          {label}
        </CardDescription>
        <CardTitle className={cn("flex items-center gap-2 text-2xl font-semibold tabular-nums tracking-tight", toneClass)}>
          {typeof value === "number" ? value.toLocaleString() : value}
          {delta !== undefined && <DeltaBadge delta={delta} />}
        </CardTitle>
        <CardAction className="text-muted-foreground">
          {icon && accent ? (
            // Tinted chip rather than a bare grey glyph — this is what makes a
            // wall of tiles read as distinct cards instead of one flat block.
            <span className={cn("flex size-7 items-center justify-center rounded-md", ACCENTS[accent])}>
              {icon}
            </span>
          ) : href ? (
            <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover/tile:opacity-100" />
          ) : icon}
        </CardAction>
      </CardHeader>
      <CardContent className="pt-2">
        {spark && spark.length > 1 && <Sparkline data={spark} />}
        {sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );

  if (!href) return inner;
  return (
    <Link href={href} className="group/tile block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl">
      {inner}
    </Link>
  );
}

// Direction is carried by an arrow AND a sign, not by colour alone.
function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="text-[11px] font-normal text-muted-foreground">no prior week</span>;
  }
  const flat = Math.abs(delta) < 0.5;
  const up   = delta > 0;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "flex items-center gap-0.5 text-[11px] font-medium",
        flat ? "text-muted-foreground"
             : up ? "text-[color:var(--status-good)]" : "text-[color:var(--status-critical)]",
      )}
      title="vs the previous 7 days"
    >
      <Icon className="h-3 w-3" />
      {flat ? "flat" : `${up ? "+" : ""}${delta.toFixed(0)}%`}
    </span>
  );
}

const sparkConfig = {
  count: { label: "Calls", theme: SEQ },
} satisfies ChartConfig;

function Sparkline({ data }: { data: { label: string; count: number }[] }) {
  return (
    <ChartContainer config={sparkConfig} className="h-[26px] w-full">
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <Area
          dataKey="count" type="monotone" strokeWidth={2}
          stroke="var(--color-count)" fill="var(--color-count)" fillOpacity={0.16}
          dot={false} isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}

// ─── Proportion bar ───────────────────────────────────────────────────────────
// Parts-of-a-whole in one bar. 2px surface gaps between segments; every segment
// is also named in the legend, so identity is never colour-alone (which also
// relieves the light-mode contrast WARN).

export function ProportionBar({
  segments, total,
}: {
  segments: { label: string; value: number; color: string }[];
  total: number;
}) {
  const shown = segments.filter((s) => s.value > 0);
  if (total === 0) return <div className="h-2.5 w-full rounded-full bg-muted" aria-hidden="true" />;

  return (
    <div>
      <div
        className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full"
        role="img"
        aria-label={shown.map((s) => `${s.label} ${s.value}`).join(", ")}
      >
        {shown.map((s) => (
          <div
            key={s.label}
            title={`${s.label}: ${s.value.toLocaleString()} (${((s.value / total) * 100).toFixed(1)}%)`}
            style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
            className="first:rounded-l-full last:rounded-r-full"
          />
        ))}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5 text-[11px]">
            <span className="h-2 w-2 flex-shrink-0 rounded-sm" style={{ background: s.color }} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="font-medium tabular-nums">{s.value.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Rate-limit meter ─────────────────────────────────────────────────────────
// Surfaces something the shipped dashboard never shows: how close the tenant is
// to its per-minute cap, before a 429 explains it the hard way.

export function RateMeter({
  used, limit, enabled, throttled,
}: { used: number; limit: number; enabled: boolean; throttled: number }) {
  const pct  = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const tone = pct >= 90 ? "critical" : pct >= 65 ? "warning" : "good";
  const color = `var(--status-${tone})`;
  const text = enabled
    ? (tone === "good" ? "Healthy" : tone === "warning" ? "Near limit" : "At limit")
    : "Disabled";

  return (
    <div className="space-y-2.5">
      <div className="flex items-end justify-between gap-2">
        <p className="text-2xl font-semibold tabular-nums tracking-tight">
          {used.toLocaleString()}
          <span className="ml-1 text-sm font-normal text-muted-foreground">/ {limit}</span>
        </p>
        {/* Status colour never travels alone — a dot plus a word accompany it. */}
        <Badge variant="outline" className="gap-1.5 text-[10px]" style={{ borderColor: color, color }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
          {text}
        </Badge>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${enabled ? pct : 0}%`, background: color }}
        />
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {enabled ? (
          <>Requests in the last 60s, per tenant. {throttled > 0
            ? <><strong className="text-foreground">{throttled}</strong> throttled (429) in the recent sample.</>
            : "Nothing throttled recently."}</>
        ) : "Rate limiting is turned off for this tenant."}
      </p>
    </div>
  );
}

// ─── Volume chart ─────────────────────────────────────────────────────────────
// Single series over time → area + line. No legend: the card title names it.

const volumeConfig = {
  count: { label: "Calls", theme: SEQ },
} satisfies ChartConfig;

export function VolumeChart({ data }: { data: { label: string; count: number }[] }) {
  if (data.length === 0) return <EmptyChart title="No traffic yet" hint="Calls appear here once Okta starts provisioning." />;

  return (
    <ChartContainer config={volumeConfig} className="h-[160px] w-full">
      <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/60" />
        <XAxis
          dataKey="label" tickLine={false} axisLine={false} tickMargin={8}
          minTickGap={28} className="text-[10px]"
        />
        <ChartTooltip cursor content={<ChartTooltipContent indicator="line" />} />
        <Area
          dataKey="count" type="monotone" strokeWidth={2}
          stroke="var(--color-count)" fill="var(--color-count)" fillOpacity={0.18}
          dot={false} activeDot={{ r: 4, strokeWidth: 2 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}

// ─── Horizontal bar charts ────────────────────────────────────────────────────
// Magnitude across a handful of named things. Values are direct-labelled rather
// than read off an axis; labels stay in text ink while the coloured mark carries
// identity. 4px rounded data-ends on the value side, anchored to the baseline.

export function MethodChart({ data }: { data: { label: string; value: number }[] }) {
  if (data.length === 0) return <EmptyChart title="No requests yet" hint="Method breakdown appears once traffic arrives." />;

  // One config entry per method so each gets its own themed --color-* var.
  const config: ChartConfig = Object.fromEntries(
    data.map((d, i) => [d.label, { label: d.label, theme: CATEGORICAL[i % CATEGORICAL.length] }]),
  );

  return (
    <ChartContainer config={config} className="h-[var(--h)] w-full" style={{ "--h": `${data.length * 30 + 10}px` } as React.CSSProperties}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 40, top: 2, bottom: 2 }} barCategoryGap={6}>
        <XAxis type="number" dataKey="value" hide />
        <YAxis
          type="category" dataKey="label" tickLine={false} axisLine={false}
          width={62} className="font-mono text-[11px]"
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={12}>
          {data.map((d) => <Cell key={d.label} fill={`var(--color-${d.label})`} />)}
          <LabelList
            dataKey="value" position="right" offset={8}
            className="fill-foreground text-[11px] tabular-nums" formatter={(v: number) => v.toLocaleString()}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

const endpointConfig = {
  value: { label: "Calls", theme: SEQ },
} satisfies ChartConfig;

export function EndpointChart({ data }: { data: { label: string; value: number }[] }) {
  if (data.length === 0) return <EmptyChart title="Nothing recorded yet" hint="Top endpoints appear once traffic arrives." />;

  return (
    <ChartContainer config={endpointConfig} className="h-[var(--h)] w-full" style={{ "--h": `${data.length * 28 + 10}px` } as React.CSSProperties}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 44, top: 2, bottom: 2 }} barCategoryGap={5}>
        <XAxis type="number" dataKey="value" hide />
        <YAxis
          type="category" dataKey="label" tickLine={false} axisLine={false}
          width={128} className="font-mono text-[10px]"
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} barSize={11}>
          <LabelList
            dataKey="value" position="right" offset={8}
            className="fill-foreground text-[10px] tabular-nums" formatter={(v: number) => v.toLocaleString()}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

// ─── Shared empty state ───────────────────────────────────────────────────────

export function EmptyChart({ title, hint, media }: { title: string; hint?: string; media?: ReactNode }) {
  return (
    <Empty className="border-0 py-8">
      <EmptyHeader>
        {media && <EmptyMedia variant="icon">{media}</EmptyMedia>}
        <EmptyTitle className="text-sm">{title}</EmptyTitle>
        {hint && <EmptyDescription className="text-xs">{hint}</EmptyDescription>}
      </EmptyHeader>
    </Empty>
  );
}
