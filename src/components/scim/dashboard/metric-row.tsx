"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface MetricRowProps {
  label:   string;
  value:   number;
  max:     number;
  color:   string;
  suffix?: string;
}

export function MetricRow({ label, value, max, color, suffix = "" }: MetricRowProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value.toLocaleString()}{suffix}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", color)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
        />
      </div>
    </div>
  );
}
