"use client";

import { useState, useCallback, useRef } from "react";
import { FileSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HarFile } from "./types";

interface Props {
  onFile: (har: HarFile, name: string) => void;
}

export function DropZone({ onFile }: Props) {
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
  );
}
