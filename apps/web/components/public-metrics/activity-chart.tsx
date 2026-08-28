"use client";

import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import type { MetricsActivityDay } from "@repo/api/domains/metrics/metrics.schema";
import { useTranslation } from "@repo/i18n";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@repo/ui/components/chart";

const DAYS_SHOWN = 30;

type ActivityMode = "daily" | "cumulative" | "volume";

interface ActivityChartProps {
  data: MetricsActivityDay[];
  locale: string;
}

/** One chart, three measures: daily bars, cumulative area, volume bars. */
export function ActivityChart({ data, locale }: ActivityChartProps) {
  const { t } = useTranslation("publicMetrics");
  const [mode, setMode] = useState<ActivityMode>("daily");

  const points = mode === "cumulative" ? data : data.slice(-DAYS_SHOWN);
  const dataKey =
    mode === "daily"
      ? "measurements"
      : mode === "cumulative"
        ? "cumulativeMeasurements"
        : "volumeBytes";

  const formatTick = (date: string) =>
    new Intl.DateTimeFormat(
      locale,
      mode === "cumulative"
        ? { month: "short", year: "2-digit", timeZone: "UTC" }
        : { month: "short", day: "numeric", timeZone: "UTC" },
    ).format(new Date(date));

  const formatCount = (value: number) =>
    new Intl.NumberFormat(locale, { notation: "compact" }).format(value);

  const config = { [dataKey]: { label: t(`activityChart.${mode}`), color: "var(--primary)" } };

  const renderModeButton = (candidate: ActivityMode) => (
    <button
      key={candidate}
      type="button"
      aria-pressed={mode === candidate}
      onClick={() => setMode(candidate)}
      className="aria-pressed:bg-primary aria-pressed:text-primary-foreground text-muted-foreground rounded-full px-3 py-1 text-xs font-medium"
    >
      {t(`activityChart.${candidate}`)}
    </button>
  );

  const modes: ActivityMode[] = ["daily", "cumulative", "volume"];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-foreground text-sm font-medium">{t(`activityChart.title.${mode}`)}</h3>
        <div className="border-border flex rounded-full border">{modes.map(renderModeButton)}</div>
      </div>
      <ChartContainer config={config} className="h-52 w-full">
        {mode === "cumulative" ? (
          <AreaChart data={points} margin={{ left: 4, right: 4, top: 4 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={formatTick} tickLine={false} minTickGap={48} />
            <YAxis tickFormatter={formatCount} tickLine={false} axisLine={false} width={44} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              dataKey={dataKey}
              type="monotone"
              stroke={`var(--color-${dataKey})`}
              fill={`var(--color-${dataKey})`}
              fillOpacity={0.15}
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        ) : (
          <BarChart data={points} margin={{ left: 4, right: 4, top: 4 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={formatTick} tickLine={false} minTickGap={32} />
            <YAxis tickFormatter={formatCount} tickLine={false} axisLine={false} width={44} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey={dataKey}
              fill={`var(--color-${dataKey})`}
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
            />
          </BarChart>
        )}
      </ChartContainer>
    </div>
  );
}
