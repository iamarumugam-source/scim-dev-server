"use client";

import { createContext, useContext, useMemo, useState, useCallback } from "react";
import { Copy, Check, SquarePlus, SquareMinus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(text);
      toast.success("Copied");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    },
    [text],
  );

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "transition-colors text-muted-foreground hover:text-foreground flex-shrink-0",
        className,
      )}
      aria-label="Copy"
    >
      {copied
        ? <Check className="h-3 w-3 text-primary" />
        : <Copy className="h-3 w-3" />}
    </button>
  );
}

function CopyAllButton({ data }: { data: unknown }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  }, [data]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
      aria-label="Copy all JSON"
    >
      {copied
        ? <Check className="h-3 w-3 text-primary" />
        : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy JSON"}
    </button>
  );
}

function ToggleButton({
  expanded,
  onClick,
}: {
  expanded: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 text-primary/50 hover:text-primary transition-colors"
      aria-label={expanded ? "Collapse" : "Expand"}
    >
      {expanded
        ? <SquareMinus className="h-3.5 w-3.5" />
        : <SquarePlus  className="h-3.5 w-3.5" />}
    </button>
  );
}


// ─── Match highlighting ───────────────────────────────────────────────────────
// A context rather than prop drilling: the tree is recursive and arbitrarily
// deep, so threading a query through every node would touch every signature.

const HighlightContext = createContext<string>("");

function Highlight({ text }: { text: string }) {
  const q = useContext(HighlightContext).trim().toLowerCase();
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-[2px] bg-[color:var(--j-mark)] px-0.5 text-inherit">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

// ─── Syntax palette ───────────────────────────────────────────────────────────
//
// Replaces hardcoded VS Code hex values that were duplicated onto every span.
// The previous light-mode string colour was #a31515 — red — which in a log
// viewer reads as "error" on every string value. And #0000ff for booleans is
// maximally saturated, the classic eye-strain choice on white.
//
// Measured against this app's real card surfaces (#ffffff / #18181b):
//   contrast  — all five roles >= 4.5:1, i.e. WCAG AA for body text, both modes
//   CVD       — worst adjacent pair deltaE 8.3 light / 10.6 dark (>=8 target)
//
// Type is never carried by colour alone either: strings keep their quotes,
// numbers are bare digits, and null/boolean render italic — so the distinction
// survives greyscale and colour-vision deficiency.
function JsonSyntaxTokens() {
  return (
    <style>{`
      .jsonv {
        --j-key:    #1c5cab;
        --j-string: #0a6e4f;
        --j-number: #8a4b00;
        --j-bool:   #6d28d9;
        --j-punct:  #71717a;
        --j-mark:   #fde68a;
      }
      .dark .jsonv {
        --j-key:    #7cb7f0;
        --j-string: #57d0b4;
        --j-number: #ef9a5a;
        --j-bool:   #c4b5fd;
        --j-punct:  #a1a1aa;
        --j-mark:   #78500a;
      }
    `}</style>
  );
}

function PrimitiveValue({ value }: { value: JsonPrimitive }) {
  if (value === null) {
    return (
      <span className="italic text-[color:var(--j-bool)]">null</span>
    );
  }
  if (typeof value === "boolean") {
    return (
      <span className="italic text-[color:var(--j-bool)]">{value.toString()}</span>
    );
  }
  if (typeof value === "number") {
    return (
      <span className="tabular-nums text-[color:var(--j-number)]">{value}</span>
    );
  }
  return (
    <span className="break-all text-[color:var(--j-string)]">
      &quot;<Highlight text={String(value)} />&quot;
    </span>
  );
}

function KeyLabel({
  name,
  isIndex,
}: {
  name: string | number;
  isIndex: boolean;
}) {
  if (isIndex) {
    return (
      <span className="text-muted-foreground/60 mr-1 select-none flex-shrink-0">
        {name}
      </span>
    );
  }
  return (
    <span className="flex-shrink-0 font-medium text-[color:var(--j-key)]">
      &quot;<Highlight text={String(name)} />&quot;
    </span>
  );
}

interface JsonNodeProps {
  value: JsonValue;
  keyName?: string | number;
  depth: number;
  isLast: boolean;
  isArrayItem: boolean;
  forceExpand: boolean;
}

function JsonNode({
  value,
  keyName,
  depth,
  isLast,
  isArrayItem,
  forceExpand,
}: JsonNodeProps) {
  const isArray    = Array.isArray(value);
  const isObject   = value !== null && typeof value === "object" && !isArray;
  const isComplex  = isArray || isObject;

  const [expanded, setExpanded] = useState(forceExpand || depth < 2);

  const entries: [string | number, JsonValue][] = isArray
    ? (value as JsonArray).map((v, i) => [i, v])
    : isObject
      ? Object.entries(value as JsonObject)
      : [];

  const [open, close] = isArray ? ["[", "]"] : ["{", "}"];
  const hasChildren   = entries.length > 0;
  const count         = entries.length;

  if (isComplex) {
    return (
      <div className="min-w-0 overflow-hidden">
        <div
          className={cn(
            "flex items-center gap-1 group/row rounded px-1 -mx-1 min-w-0 overflow-hidden",
            hasChildren && "hover:bg-muted/60 cursor-pointer",
          )}
          onClick={() => hasChildren && setExpanded((p) => !p)}
        >
          <span className="w-3.5 flex-shrink-0" />

          {keyName !== undefined && (
            <>
              <KeyLabel name={keyName} isIndex={isArrayItem} />
              <span className="text-muted-foreground flex-shrink-0">:</span>
            </>
          )}

          <span className="text-muted-foreground flex-shrink-0">{open}</span>

          {hasChildren && (
            <ToggleButton
              expanded={expanded}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((p) => !p);
              }}
            />
          )}

          {!hasChildren && (
            <span className="text-muted-foreground flex-shrink-0">{close}</span>
          )}

          {hasChildren && !expanded && (
            <>
              <span className="text-xs text-muted-foreground/60 select-none tabular-nums flex-shrink-0">
                {count} {isArray ? "items" : "properties"}
              </span>
              <span className="text-muted-foreground flex-shrink-0">{close}</span>
            </>
          )}
        </div>

        {expanded && hasChildren && (
          <div className="ml-5 border-l border-border/60 pl-3 mt-0.5 min-w-0 overflow-hidden">
            {entries.map(([k, v], i) => (
              <JsonNode
                key={k}
                keyName={k}
                value={v}
                depth={depth + 1}
                isLast={i === entries.length - 1}
                isArrayItem={isArray}
                forceExpand={forceExpand}
              />
            ))}
          </div>
        )}

        {expanded && (
          <div className="pl-4">
            <span className="text-muted-foreground">
              {close}{!isLast && ","}
            </span>
          </div>
        )}
      </div>
    );
  }

  const primitiveText =
    value === null
      ? "null"
      : typeof value === "string"
        ? `"${value}"`
        : String(value);

  return (
    <div className="flex items-start group/row rounded px-1 -mx-1 hover:bg-muted/60 min-w-0 overflow-hidden">
      <span className="w-3.5 flex-shrink-0 mt-0.5" />
      {keyName !== undefined && (
        <>
          <KeyLabel name={keyName} isIndex={isArrayItem} />
          <span className="text-muted-foreground mx-1 flex-shrink-0 mt-0.5">:</span>
        </>
      )}
      <span className="break-all min-w-0 ml-1">
        <PrimitiveValue value={value as JsonPrimitive} />
        {!isLast && <span className="text-muted-foreground">,</span>}
      </span>
      <CopyButton
        text={primitiveText}
        className="ml-1.5 mt-0.5 opacity-0 group-hover/row:opacity-100 flex-shrink-0"
      />
    </div>
  );
}

interface JsonViewerProps {
  data: unknown;
  className?: string;
}

export function JsonViewer({ data, className }: JsonViewerProps) {
  const [allExpanded, setAllExpanded] = useState(false);
  const [treeKey,     setTreeKey]     = useState(0);
  const [query,       setQuery]       = useState("");

  const handleExpandAll   = () => { setAllExpanded(true);  setTreeKey((k) => k + 1); };
  const handleCollapseAll = () => { setAllExpanded(false); setTreeKey((k) => k + 1); };

  const searching = query.trim().length > 0;

  // Number of matches, counted off the serialised form — cheap, and it tells you
  // whether a search found anything without hunting for highlights.
  const matchCount = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return 0;
    try {
      const hay = JSON.stringify(data)?.toLowerCase() ?? "";
      let n = 0, i = hay.indexOf(q);
      while (i !== -1) { n++; i = hay.indexOf(q, i + q.length); }
      return n;
    } catch { return 0; }
  }, [data, query]);

  // Searching force-expands, otherwise matches stay hidden inside collapsed
  // nodes and the highlight is invisible.
  const expand = allExpanded || searching;
  const treeSeed = `${treeKey}-${searching ? "s" : "c"}`;

  return (
    <div
      className={cn(
        "jsonv flex flex-col overflow-hidden rounded-md border border-border bg-card text-card-foreground",
        className,
      )}
    >
      <JsonSyntaxTokens />

      <div className="flex flex-shrink-0 items-center gap-2 border-b border-border/60 bg-muted/30 px-2 py-1.5">
        {/* Search first: on a SCIM payload the usual question is "does this
            response contain X", which previously meant reading the whole tree. */}
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find in JSON…"
            aria-label="Find in JSON"
            className="h-6 w-full rounded border border-transparent bg-transparent pl-7 pr-6 font-mono text-[11px] outline-none placeholder:text-muted-foreground/70 focus:border-border focus:bg-background"
          />
          {searching && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {searching && (
          <span className={cn(
            "flex-shrink-0 tabular-nums text-[10px]",
            matchCount === 0 ? "text-destructive" : "text-muted-foreground",
          )}>
            {matchCount === 0 ? "no matches" : `${matchCount} match${matchCount === 1 ? "" : "es"}`}
          </span>
        )}

        <button
          onClick={allExpanded ? handleCollapseAll : handleExpandAll}
          disabled={searching}
          title={searching ? "Searching expands everything" : undefined}
          className="flex-shrink-0 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          {expand ? "Collapse all" : "Expand all"}
        </button>
        <CopyAllButton data={data} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 font-mono text-xs leading-5">
        <HighlightContext.Provider value={query}>
          <JsonNode
            key={treeSeed}
            value={data as JsonValue}
            depth={0}
            isLast={true}
            isArrayItem={false}
            forceExpand={expand}
          />
        </HighlightContext.Provider>
      </div>
    </div>
  );
}
