"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface DailyVolume {
  date:  string;
  label: string;
  count: number;
}

interface ActivityChartProps {
  data:      DailyVolume[];
  isLoading: boolean;
}

const chartConfig = {
  count: {
    label: "API Calls",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function ActivityChart({ data, isLoading }: ActivityChartProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          API Calls — Last 7 Days
        </p>
        {isLoading ? (
          <div className="flex items-end gap-2 h-[120px]">
            {[40, 65, 30, 80, 55, 70, 45].map((h, i) => (
              <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
            ))}
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[120px] w-full">
            <BarChart data={data} accessibilityLayer barCategoryGap="30%">
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 10 }}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel indicator="dot" />}
              />
              <Bar dataKey="count" fill="var(--color-count)" radius={3} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
