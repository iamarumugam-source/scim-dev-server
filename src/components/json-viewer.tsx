"use client";

import { useState, useCallback } from "react";
import { Copy, Check, SquarePlus, SquareMinus } from "lucide-react";
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
      {copied ? (
        <Check className="h-3 w-3 text-emerald-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

function CopyAllButton({ data }: { data: unknown }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    toast.success("Json copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  }, [data]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
      aria-label="Copy all JSON"
    >
      {copied ? (
        <Check className="h-3 w-3 text-emerald-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
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
      className="flex-shrink-0 text-blue-500/60 hover:text-blue-500 dark:text-blue-400/60 dark:hover:text-blue-400 transition-colors"
      aria-label={expanded ? "Collapse" : "Expand"}
    >
      {expanded ? (
        <SquareMinus className="h-3.5 w-3.5" />
      ) : (
        <SquarePlus className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function PrimitiveValue({ value }: { value: JsonPrimitive }) {
  if (value === null) {
    return (
      <span className="text-rose-500 dark:text-rose-400 italic">null</span>
    );
  }
  if (typeof value === "boolean") {
    return (
      <span className="text-amber-600 dark:text-amber-400">
        {value.toString()}
      </span>
    );
  }
  if (typeof value === "number") {
    return <span className="text-sky-600 dark:text-sky-400">{value}</span>;
  }
  return (
    <span className="text-emerald-600 dark:text-emerald-400">
      &quot;{value}&quot;
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
    <span className="text-violet-600 dark:text-violet-400 font-medium flex-shrink-0">
      &quot;{name}&quot;
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
  const isArray = Array.isArray(value);
  const isObject = value !== null && typeof value === "object" && !isArray;
  const isComplex = isArray || isObject;

  const [expanded, setExpanded] = useState(forceExpand || depth < 2);

  const entries: [string | number, JsonValue][] = isArray
    ? (value as JsonArray).map((v, i) => [i, v])
    : isObject
      ? Object.entries(value as JsonObject)
      : [];

  const [open, close] = isArray ? ["[", "]"] : ["{", "}"];
  const hasChildren = entries.length > 0;
  const count = entries.length;

  if (isComplex) {
    return (
      <div className="min-w-0">
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
                {count} properties
              </span>
              <span className="text-muted-foreground flex-shrink-0">
                {close}
              </span>
            </>
          )}
        </div>

        {expanded && hasChildren && (
          <div className="ml-5 border-l border-border/60 pl-3 mt-0.5 min-w-0">
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
              {close}
              {!isLast && ","}
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
    <div className="flex items-center group/row rounded px-1 -mx-1 hover:bg-muted/60 min-w-0 overflow-hidden">
      <span className="w-3.5 flex-shrink-0" />
      {keyName !== undefined && (
        <>
          <KeyLabel name={keyName} isIndex={isArrayItem} />
          <span className="text-muted-foreground mx-1 flex-shrink-0">:</span>
        </>
      )}
      <span className="truncate min-w-0 ml-1">
        <PrimitiveValue value={value as JsonPrimitive} />
        {!isLast && <span className="text-muted-foreground">,</span>}
      </span>
      <CopyButton
        text={primitiveText}
        className="ml-1.5 opacity-0 group-hover/row:opacity-100"
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
  const [treeKey, setTreeKey] = useState(0);

  const handleExpandAll = () => {
    setAllExpanded(true);
    setTreeKey((k) => k + 1);
  };

  const handleCollapseAll = () => {
    setAllExpanded(false);
    setTreeKey((k) => k + 1);
  };

  return (
    <div
      className={cn(
        "flex flex-col rounded-md bg-card text-card-foreground border border-border overflow-hidden",
        className,
      )}
    >
      <div className="flex items-center justify-end gap-1 px-3 py-1.5 border-b border-border/60 bg-muted/30 flex-shrink-0">
        <button
          onClick={allExpanded ? handleCollapseAll : handleExpandAll}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
        >
          {allExpanded ? "Collapse all" : "Expand all"}
        </button>
        <CopyAllButton data={data} />
      </div>
      <div className="font-mono text-sm leading-6 p-4 overflow-y-auto overflow-x-hidden min-h-0 flex-1">
        <JsonNode
          key={treeKey}
          value={data as JsonValue}
          depth={0}
          isLast={true}
          isArrayItem={false}
          forceExpand={allExpanded}
        />
      </div>
    </div>
  );
}
