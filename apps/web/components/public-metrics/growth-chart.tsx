"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import type { PublicDailyActivity } from "@repo/api/domains/metrics/metrics.schema";
import { useTranslation } from "@repo/i18n";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@repo/ui/components/chart";

const MAX_POINTS = 200;

interface GrowthChartProps {
  data: PublicDailyActivity[];
  locale: string;
}

function thin(data: PublicDailyActivity[]): PublicDailyActivity[] {
  if (data.length <= MAX_POINTS) {
    return data;
  }
  const step = Math.ceil(data.length / MAX_POINTS);
  return data.filter((_, index) => index % step === 0 || index === data.length - 1);
}

export function GrowthChart({ data, locale }: GrowthChartProps) {
  const { t } = useTranslation("publicMetrics");

  const points = thin(data);

  // Date-only strings parse as UTC midnight; formatting must stay in UTC or
  // negative-offset timezones render the previous day.
  const formatTick = (date: string) =>
    new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit", timeZone: "UTC" }).format(
      new Date(date),
    );

  const formatCount = (value: number) =>
    new Intl.NumberFormat(locale, { notation: "compact" }).format(value);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-foreground text-sm font-medium">{t("charts.growthTitle")}</h3>
      <ChartContainer
        config={{
          cumulativeMeasurements: {
            label: t("charts.cumulativeMeasurements"),
            color: "var(--primary)",
          },
        }}
        className="h-56 w-full"
      >
        <AreaChart data={points} margin={{ left: 4, right: 4, top: 4 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="date" tickFormatter={formatTick} tickLine={false} minTickGap={48} />
          <YAxis tickFormatter={formatCount} tickLine={false} axisLine={false} width={44} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area
            dataKey="cumulativeMeasurements"
            type="monotone"
            stroke="var(--color-cumulativeMeasurements)"
            fill="var(--color-cumulativeMeasurements)"
            fillOpacity={0.15}
            strokeWidth={2}
            dot={false}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
