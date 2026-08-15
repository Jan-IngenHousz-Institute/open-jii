"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import type { PublicDailyActivity } from "@repo/api/domains/metrics/metrics.schema";
import { useTranslation } from "@repo/i18n";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@repo/ui/components/chart";

const DAYS_SHOWN = 30;

interface DailyActivityChartProps {
  data: PublicDailyActivity[];
  locale: string;
}

export function DailyActivityChart({ data, locale }: DailyActivityChartProps) {
  const { t } = useTranslation("publicMetrics");

  const points = data.slice(-DAYS_SHOWN);

  // Date-only strings parse as UTC midnight; formatting must stay in UTC or
  // negative-offset timezones render the previous day.
  const formatTick = (date: string) =>
    new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }).format(
      new Date(date),
    );

  const formatCount = (value: number) =>
    new Intl.NumberFormat(locale, { notation: "compact" }).format(value);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-foreground text-sm font-medium">{t("charts.activityTitle")}</h3>
      <ChartContainer
        config={{
          measurements: {
            label: t("charts.measurements"),
            color: "var(--primary)",
          },
        }}
        className="h-56 w-full"
      >
        <BarChart data={points} margin={{ left: 4, right: 4, top: 4 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="date" tickFormatter={formatTick} tickLine={false} minTickGap={32} />
          <YAxis tickFormatter={formatCount} tickLine={false} axisLine={false} width={44} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar
            dataKey="measurements"
            fill="var(--color-measurements)"
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
          />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
