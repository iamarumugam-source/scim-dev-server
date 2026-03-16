"use client";

import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface MethodChartProps {
  byMethod:   Record<string, number>;
  totalCalls: number;
  isLoading:  boolean;
}

// Per-method fill colours — match the badge palette used elsewhere in the dashboard
const METHOD_FILL: Record<string, string> = {
  GET:    "oklch(0.6 0.15 237)",
  POST:   "oklch(0.6 0.15 145)",
  PUT:    "oklch(0.7 0.15 85)",
  PATCH:  "oklch(0.7 0.15 85)",
  DELETE: "oklch(0.55 0.2 25)",
};

const FALLBACK_FILL = "oklch(0.55 0.05 250)";

export function MethodChart({ byMethod, totalCalls, isLoading }: MethodChartProps) {
  const data = Object.entries(byMethod)
    .sort(([, a], [, b]) => b - a)
    .map(([method, count]) => ({ method, count }));

  // Build a ChartConfig so ChartTooltipContent can resolve labels
  const chartConfig = Object.fromEntries(
    data.map(({ method }) => [method, { label: method, color: METHOD_FILL[method] ?? FALLBACK_FILL }]),
  ) as ChartConfig;

  if (isLoading) {
    return (
      <div className="space-y-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    );
  }

  if (!data.length) {
    return <p className="text-xs text-muted-foreground">No calls recorded yet.</p>;
  }

  // Chart height scales with number of methods (min 2 rows shown)
  const chartH = Math.max(data.length * 36, 72);

  return (
    <ChartContainer config={chartConfig} className="w-full" style={{ height: chartH }}>
      <BarChart
        data={data}
        layout="vertical"
        accessibilityLayer
        margin={{ left: 4, right: 32, top: 0, bottom: 0 }}
        barCategoryGap="25%"
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="method"
          tickLine={false}
          axisLine={false}
          width={44}
          tick={{ fontSize: 10, fontFamily: "monospace", fontWeight: 700 }}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(value, name) => (
                <span className="tabular-nums font-mono font-medium">
                  {Number(value).toLocaleString()}
                  <span className="text-muted-foreground ml-1.5 font-normal">
                    ({totalCalls > 0 ? Math.round((Number(value) / totalCalls) * 100) : 0}%)
                  </span>
                </span>
              )}
            />
          }
        />
        <Bar dataKey="count" radius={3}>
          {data.map(({ method }) => (
            <Cell key={method} fill={METHOD_FILL[method] ?? FALLBACK_FILL} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
