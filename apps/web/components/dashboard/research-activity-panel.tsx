"use client";

import { useMyScopedMetrics } from "@/hooks/metrics/useMyScopedMetrics/useMyScopedMetrics";
import { usePublicMetrics } from "@/hooks/metrics/usePublicMetrics/usePublicMetrics";

import { useTranslation } from "@repo/i18n";
import { AreaChart } from "@repo/ui/components/charts/area-chart";
import type { PlotlyChartConfig } from "@repo/ui/components/charts/types";
import { detectAxisType } from "@repo/ui/components/charts/utils";

interface ResearchActivityPanelProps {
  locale: string;
}

interface Figure {
  key: string;
  value: number;
}

/**
 * The reader's own 30 days, with the community underneath as context rather
 * than as the headline. A trend beats a counter: the shape is what says
 * whether the work is moving.
 */
export function ResearchActivityPanel({ locale }: ResearchActivityPanelProps) {
  const { t } = useTranslation("publicMetrics");
  const { data: mine } = useMyScopedMetrics();
  const { data: platform } = usePublicMetrics();

  const scoped = mine?.scoped ?? null;
  if (scoped === null) {
    return null;
  }

  const format = (value: number) => new Intl.NumberFormat(locale).format(value);
  const compact = (value: number) =>
    new Intl.NumberFormat(locale, { notation: "compact" }).format(value);

  const days = scoped.activity;
  const hasTrend = days.length > 1;
  const community = platform?.community ?? null;

  const figures: Figure[] = [
    { key: "experiments", value: scoped.activeExperiments30d },
    ...(scoped.contributors30d > 0 ? [{ key: "contributors", value: scoped.contributors30d }] : []),
  ];

  const chartConfig: PlotlyChartConfig = {
    showLegend: false,
    showModeBar: false,
    // A display chart: hover reads values, drag would zoom or select.
    dragMode: false,
    scrollZoom: false,
    showGrid: false,
    backgroundColor: "rgba(0,0,0,0)",
    xAxisType: detectAxisType(days.map((day) => day.date)),
    locale,
  };

  const renderFigure = (figure: Figure) => (
    <div key={figure.key} className="flex items-baseline gap-1.5">
      <span className="text-foreground text-sm font-semibold tabular-nums">
        {format(figure.value)}
      </span>
      <span className="text-muted-foreground text-xs">
        {t(`dashboard.activity.${figure.key}`, { count: figure.value })}
      </span>
    </div>
  );

  const renderTrend = () => (
    <AreaChart
      data={[
        {
          x: days.map((day) => day.date),
          y: days.map((day) => day.measurements),
          name: t("dashboard.activity.trend"),
          fill: "tozeroy",
          mode: "lines",
        },
      ]}
      config={chartConfig}
      className="h-20 w-full sm:h-24"
    />
  );

  return (
    <section className="border-border bg-card flex flex-col gap-4 rounded-lg border p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            {t("dashboard.activity.label")}
          </span>
          <span className="text-foreground text-2xl font-bold tabular-nums sm:text-3xl">
            {format(scoped.measurements30d)}
          </span>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            {figures.map(renderFigure)}
          </div>
        </div>

        {community ? (
          <p className="text-muted-foreground max-w-xs text-xs sm:text-right">
            {t("dashboard.activity.context", {
              measurements: compact(community.measurements30d),
            })}
          </p>
        ) : null}
      </div>

      {hasTrend ? renderTrend() : null}
    </section>
  );
}
