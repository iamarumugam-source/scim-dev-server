"use client";

// Shared layout primitives for expanded-row detail views (users, groups, …).
//
// Full-width label/content rows rather than a multi-column grid. Sections stack
// top-to-bottom, so wildly differing section heights can never read as ragged
// columns — and everything stays visible without a click. Tabs were tried here
// and rejected: an expanded row exists to take in a whole resource at a glance,
// which tab clicks defeat.
//
// Lives in its own module so every editor uses the SAME primitives and cannot
// drift apart visually.

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function Band({
  label, children, first,
}: {
  label: string;
  children: React.ReactNode;
  first?: boolean;
}) {
  return (
    <div className={cn(
      "grid grid-cols-1 gap-1 px-3 py-2.5 sm:grid-cols-[112px_1fr] sm:gap-4",
      !first && "border-t",
    )}>
      <p className="pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function LabelText({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{children}</span>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-muted-foreground">{children}</span>;
}

export function InlineList({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">{children}</div>;
}

/**
 * Renders nothing when empty. In view mode a row of "—" placeholders is noise;
 * at a glance you want what IS set. Every attribute, set or not, is still
 * visible in edit mode and in the raw JSON.
 */
export function Inline({
  label, value, mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <span className="inline-flex min-w-0 items-baseline gap-1.5">
      <LabelText>{label}</LabelText>
      <span className={cn("truncate text-xs", mono && "font-mono")} title={value}>{value}</span>
    </span>
  );
}

/**
 * SCIM ids and ETags are the values you actually need on a clipboard when
 * debugging a provisioning run, so make taking them one click rather than a
 * careful drag-select.
 */
export function CopyValue({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  };
  return (
    <button
      onClick={copy}
      title={`Copy ${value}`}
      className={cn(
        "group/copy inline-flex max-w-full items-center gap-1.5 rounded text-left font-mono text-[11px] text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <span className="truncate">{value}</span>
      {copied
        ? <Check className="h-3 w-3 flex-shrink-0 text-[color:var(--status-good,#0ca30c)]" />
        : <Copy className="h-3 w-3 flex-shrink-0 opacity-0 transition-opacity group-hover/copy:opacity-100" />}
    </button>
  );
}
