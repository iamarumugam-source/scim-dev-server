"use client";

import { useState, useCallback, useRef } from "react";
import { FileSearch, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { HarFile } from "./types";
import type { HarHistoryEntry } from "@/hooks/useHarHistory";

interface Props {
  onFile:         (har: HarFile, name: string) => void;
  history?:       HarHistoryEntry[];
  onClearHistory?: () => void;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)   return "just now";
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  return `${days}d ago`;
}

export function DropZone({ onFile, history = [], onClearHistory }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const inputRef                    = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as HarFile;
        if (!parsed?.log?.entries) { setError("Invalid HAR — no entries found."); return; }
        onFile(parsed, file.name);
      } catch { setError("Failed to parse file. Make sure it is a valid HAR."); }
    };
    reader.readAsText(file);
  }, [onFile]);

  return (
    <div className="space-y-6 p-6">
      {/* Drop target */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-16 cursor-pointer transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30",
        )}
      >
        <input ref={inputRef} type="file" accept=".har" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <FileSearch className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">Drop a HAR file here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">
            Chrome DevTools → Network tab → ⋮ → Save all as HAR with content
          </p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {/* Recent files */}
      {history.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <Clock className="h-3 w-3" />
              Recent files
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] gap-1 text-muted-foreground hover:text-destructive"
              onClick={onClearHistory}
            >
              <Trash2 className="h-3 w-3" /> Clear
            </Button>
          </div>
          <Separator />
          <div className="space-y-1">
            {history.map((entry, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <FileSearch className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="flex-1 font-mono truncate text-foreground/80">{entry.name}</span>
                <span className="flex-shrink-0 tabular-nums">
                  {entry.entryCount.toLocaleString()} req{entry.entryCount !== 1 ? "s" : ""}
                </span>
                <span className="flex-shrink-0 text-muted-foreground/60">{formatRelative(entry.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
