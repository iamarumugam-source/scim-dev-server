"use client";

// ─── Changelog ────────────────────────────────────────────────────────────────
//
// Brought onto the same pattern as the SCIM pages: VizTokens + Section grouping,
// a StatTile overview row with accent chips, and a facet/search filter bar in the
// shape the Logs preview uses.
//
// What changed beyond styling:
//   • 12 releases × ~150 entries all rendered expanded, which is a very long
//     scroll with no way in. Only the latest release is open by default now.
//   • No filtering at all. Type facets and a search box make "what got fixed"
//     or "find the entry about usernames" a couple of clicks.
//   • The type legend was an unlabelled row of badges that looked decorative.
//     The facets now double as the legend, so the same row explains and filters.
//
// Client component because the filter and search hold state; the data lives in
// components/changelog/versions.ts.

import { useMemo, useState, useRef, useEffect } from "react";
import {
  ScrollText, Search, X, Filter, Tag, Rocket, ListChecks, CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput,
} from "@/components/ui/input-group";
import { VizTokens, Section, StatTile } from "@/components/scim/dashboard/viz";
import { VersionBlock } from "@/components/changelog/version-block";
import { TYPE_CONFIG, type ChangeType } from "@/components/changelog/change-item";
import { VERSIONS } from "@/components/changelog/versions";
import { cn } from "@/lib/utils";

const TYPES = Object.keys(TYPE_CONFIG) as ChangeType[];

export default function ChangelogPage() {
  const [query, setQuery] = useState("");
  const [types, setTypes] = useState<Set<ChangeType>>(new Set());
  // Which releases are expanded. Controlled rather than per-card `defaultOpen`,
  // which Radix only reads on mount — see the note in VersionBlock.
  const [openVersions, setOpenVersions] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const totalChanges = useMemo(
    () => VERSIONS.reduce((n, v) => n + v.changes.length, 0),
    [],
  );

  const typeCounts = useMemo(() => {
    const c = Object.fromEntries(TYPES.map((t) => [t, 0])) as Record<ChangeType, number>;
    for (const v of VERSIONS) for (const ch of v.changes) c[ch.type]++;
    return c;
  }, []);

  // Filter the CHANGES, then drop releases left with nothing — otherwise a type
  // filter leaves a column of empty release cards.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return VERSIONS
      .map((v) => ({
        v,
        changes: v.changes.filter((c) =>
          (types.size === 0 || types.has(c.type)) &&
          (!q || c.text.toLowerCase().includes(q) ||
            v.title.toLowerCase().includes(q) ||
            v.version.includes(q))),
      }))
      .filter((r) => r.changes.length > 0);
  }, [query, types]);

  const shownChanges = filtered.reduce((n, r) => n + r.changes.length, 0);
  const isFiltered   = query.trim().length > 0 || types.size > 0;

  // Whenever the query or type filter changes, open every release that still has
  // a match. Without this a match inside a collapsed release stays invisible.
  useEffect(() => {
    if (isFiltered) setOpenVersions(new Set(filtered.map((r) => r.v.version)));
    else            setOpenVersions(new Set([VERSIONS[0].version]));
  }, [isFiltered, filtered]);

  const toggleVersion = (ver: string, next: boolean) =>
    setOpenVersions((p) => {
      const n = new Set(p);
      if (next) n.add(ver); else n.delete(ver);
      return n;
    });

  const toggleType = (t: ChangeType) =>
    setTypes((p) => { const n = new Set(p); if (n.has(t)) n.delete(t); else n.add(t); return n; });
  const clearFilters = () => { setQuery(""); setTypes(new Set()); };

  const latest = VERSIONS[0];

  return (
    <div className="viz container mx-auto max-w-4xl space-y-7 py-8">
      <VizTokens />

      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <ScrollText className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Changelog</h1>
            <p className="text-xs text-muted-foreground">
              A running log of significant changes, features and fixes.
            </p>
          </div>
        </div>

        <InputGroup className="w-full sm:w-72">
          <InputGroupAddon><Search className="h-3.5 w-3.5" /></InputGroupAddon>
          <InputGroupInput
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search changes…"
            aria-label="Search changelog"
            className="text-xs"
          />
          <InputGroupAddon align="inline-end">
            {query ? (
              <InputGroupButton size="icon-xs" variant="ghost" onClick={() => setQuery("")} aria-label="Clear search">
                <X className="h-3.5 w-3.5" />
              </InputGroupButton>
            ) : <Kbd>⌘K</Kbd>}
          </InputGroupAddon>
        </InputGroup>
      </div>

      {/* ─── Overview ────────────────────────────────────────────────────── */}
      <Section title="Overview">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Releases" value={VERSIONS.length}
            icon={<Rocket className="h-4 w-4" />}
            sub={`since ${new Date(VERSIONS[VERSIONS.length - 1].date).toLocaleDateString("en", { month: "short", year: "numeric" })}`}
          />
          <StatTile
            label="Changes logged" value={totalChanges}
            icon={<ListChecks className="h-4 w-4" />}
            sub="across all releases"
          />
          <StatTile
            label="Latest" value={`v${latest.version}`}
            icon={<Tag className="h-4 w-4" />}
            sub={latest.title}
          />
          <StatTile
            label="Last updated"
            value={new Date(latest.date).toLocaleDateString("en", { day: "numeric", month: "short" })}
            icon={<CalendarDays className="h-4 w-4" />}
            sub={new Date(latest.date).toLocaleDateString("en", { year: "numeric" })}
          />
        </div>
      </Section>

      {/* ─── Filter bar ──────────────────────────────────────────────────── */}
      {/* Doubles as the legend: the old page had an unlabelled badge row that
          looked decorative and did nothing. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-muted/20 px-3 py-2">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Filter className="h-3 w-3" /> Type
        </span>
        <div className="flex flex-wrap items-center gap-1">
          {TYPES.map((t) => {
            const cfg = TYPE_CONFIG[t];
            const on  = types.has(t);
            const n   = typeCounts[t];
            return (
              <button
                key={t}
                onClick={() => toggleType(t)}
                aria-pressed={on}
                disabled={n === 0 && !on}
                title={on ? `Stop filtering by ${cfg.label}` : `Show only ${cfg.label}`}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] font-semibold transition-colors",
                  on
                    ? cn("shadow-sm", cfg.class)
                    : "border-border bg-transparent text-muted-foreground hover:bg-background hover:text-foreground",
                  n === 0 && !on && "opacity-40",
                )}
              >
                <cfg.icon className="h-2.5 w-2.5" />
                {cfg.label}
                <span className="tabular-nums opacity-70">{n}</span>
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {isFiltered && (
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-[11px]" onClick={clearFilters}>
              <X className="h-3 w-3" /> Clear
            </Button>
          )}
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {isFiltered
              ? <><span className="font-medium text-foreground">{shownChanges}</span> of {totalChanges} shown</>
              : <><span className="font-medium text-foreground">{totalChanges}</span> changes</>}
          </span>
        </div>
      </div>

      {/* ─── Releases ────────────────────────────────────────────────────── */}
      <Section title="Releases" hint={isFiltered ? "filtered" : "newest first"}>
        {filtered.length === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Search className="h-4 w-4" /></EmptyMedia>
              <EmptyTitle className="text-sm">No matching changes</EmptyTitle>
              <EmptyDescription className="text-xs">
                Nothing in the changelog matches the current filters.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={clearFilters}>
                <X className="h-3.5 w-3.5" /> Clear filters
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="relative">
            {filtered.map(({ v, changes }) => (
              <VersionBlock
                key={v.version}
                v={v}
                changes={changes}
                matchedOf={v.changes.length}
                isLatest={v.version === latest.version}
                open={openVersions.has(v.version)}
                onOpenChange={(next) => toggleVersion(v.version, next)}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
