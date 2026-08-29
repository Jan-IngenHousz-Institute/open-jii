"use client";

import { useMyScopedMetrics } from "@/hooks/metrics/useMyScopedMetrics/useMyScopedMetrics";
import { usePublicMetrics } from "@/hooks/metrics/usePublicMetrics/usePublicMetrics";

import { useTranslation } from "@repo/i18n";
import { Trans } from "@repo/i18n/client";
import { AreaChart } from "@repo/ui/components/charts/area-chart";
import type { PlotlyChartConfig } from "@repo/ui/components/charts/types";
import { detectAxisType } from "@repo/ui/components/charts/utils";

interface ResearchActivityPanelProps {
  locale: string;
}

/**
 * The dashboard's own activity, with the community as context rather than as
 * the headline. A trend beats a counter: the shape is what tells the reader
 * whether their work is moving.
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
  const days = scoped.activity;
  const hasTrend = days.length > 1;

  const chartConfig: PlotlyChartConfig = {
    showLegend: false,
    showModeBar: false,
    showGrid: false,
    backgroundColor: "rgba(0,0,0,0)",
    height: 96,
    xAxisType: detectAxisType(days.map((day) => day.date)),
    locale,
  };

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
      className="h-24 w-full"
    />
  );

  return (
    <section className="border-border bg-card flex flex-col gap-3 rounded-lg border p-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-foreground text-3xl font-bold tabular-nums">
          {format(scoped.measurements30d)}
        </span>
        <span className="text-muted-foreground text-sm">
          <Trans
            t={t}
            i18nKey="dashboard.activity.summary"
            values={{
              experiments: format(scoped.activeExperiments30d),
              contributors: format(scoped.contributors30d),
            }}
            components={{ em: <span className="text-foreground font-medium" /> }}
          />
        </span>
      </div>

      {hasTrend ? renderTrend() : null}

      {platform?.community ? (
        <p className="text-muted-foreground text-xs">
          <Trans
            t={t}
            i18nKey="dashboard.activity.context"
            values={{ measurements: format(platform.community.measurements30d) }}
            components={{ em: <span className="text-foreground font-medium" /> }}
          />
        </p>
      ) : null}
    </section>
  );
}
