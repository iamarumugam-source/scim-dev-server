"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { TEMPLATE_EXAMPLES } from "./constants";

interface Props { value: string; onChange: (v: string) => void }

export function RawJsonEditor({ value, onChange }: Props) {
  const [showHint, setShowHint] = useState(false);

  const isValid = (() => {
    if (!value.trim()) return null;
    try { JSON.parse(value); return true; } catch { return false; }
  })();

  const parsed  = isValid === true ? JSON.parse(value) : null;
  const preview = parsed !== null
    ? Array.isArray(parsed)
      ? `array · ${parsed.length} item${parsed.length !== 1 ? "s" : ""}`
      : typeof parsed === "object"
        ? `object · ${Object.keys(parsed).length} key${Object.keys(parsed).length !== 1 ? "s" : ""}`
        : String(parsed)
    : null;

  return (
    <div className="space-y-1.5">
      <Textarea
        value={value}
        placeholder={"Paste any valid JSON — object, array, or primitive.\nUse {{user.prop}} or {{faker.method}} inside string values.\n\n// Named field \"employments\" → use a bare array:\n[{\"contractId\": \"{{faker.string.uuid}}\", \"title\": \"{{user.title}}\"}]\n\n// Named field \"manager\" → use a bare object:\n{\"value\": \"{{user.id}}\", \"displayName\": \"{{user.name.formatted}}\"}\n\n// Empty name → spread: paste the whole extension as one object:\n{\"employments\": [...], \"manager\": {...}}"}
        className={cn(
          "min-h-[100px] text-xs font-mono resize-y transition-colors",
          isValid === false && "border-destructive focus-visible:ring-destructive/20",
        )}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {isValid === true && (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              ✓ Valid JSON{preview ? ` — ${preview}` : ""}
            </span>
          )}
          {isValid === false && (
            <span className="text-[10px] text-destructive font-medium">✗ Invalid JSON</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowHint((p) => !p)}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {showHint ? "hide hints" : "template syntax ↓"}
        </button>
      </div>

      {showHint && (
        <div className="rounded-md border border-border bg-muted/20 p-2.5 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Template expressions — any string value can contain:
          </p>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {TEMPLATE_EXAMPLES.map(({ token, label }) => (
              <div key={token} className="flex items-center gap-1.5">
                <code className="text-[10px] font-mono text-primary bg-primary/5 px-1 py-0.5 rounded">
                  {token}
                </code>
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/70 mt-1">
            Use any <code className="font-mono">user.*</code> dot-path or{" "}
            <code className="font-mono">faker.*</code> method. Non-string values (numbers, booleans, null) are always kept as-is.
          </p>
        </div>
      )}
    </div>
  );
}
