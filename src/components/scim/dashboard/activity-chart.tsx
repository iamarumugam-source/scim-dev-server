"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    theme: {
      light: "oklch(0.6 0.15 237)",
      dark:  "oklch(0.72 0.12 237)",
    },
  },
} satisfies ChartConfig;

export function ActivityChart({ data, isLoading }: ActivityChartProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">API Calls — Last 7 Days</CardTitle>
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
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
