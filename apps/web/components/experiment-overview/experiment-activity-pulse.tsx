"use client";

import { useExperimentMetrics } from "~/hooks/metrics/useExperimentMetrics/useExperimentMetrics";
import { useLocale } from "~/hooks/useLocale";

import { useTranslation } from "@repo/i18n";
import { AreaChart } from "@repo/ui/components/charts/area-chart";
import type { PlotlyChartConfig } from "@repo/ui/components/charts/types";
import { detectAxisType } from "@repo/ui/components/charts/utils";

interface ExperimentActivityPulseProps {
  experimentId: string;
}

/**
 * Whether this experiment is still collecting, answered where the question is
 * asked. A silent experiment says so rather than disappearing: on this page the
 * absence of a reading is itself the answer.
 */
export function ExperimentActivityPulse({ experimentId }: ExperimentActivityPulseProps) {
  const { t } = useTranslation("publicMetrics");
  const locale = useLocale();
  const { data } = useExperimentMetrics(experimentId);

  const scoped = data?.scoped ?? null;
  if (scoped === null) {
    return null;
  }

  const format = (value: number) => new Intl.NumberFormat(locale).format(value);
  const days = scoped.activity;
  const isCollecting = scoped.measurements30d > 0;

  // Device-published rows carry no contributor, so the clause is dropped rather
  // than reporting that nobody took the measurements.
  const hasContributors = scoped.contributors30d > 0;

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

  const renderTrend = () => (
    <AreaChart
      data={[
        {
          x: days.map((day) => day.date),
          y: days.map((day) => day.measurements),
          name: t("experiment.trend"),
          fill: "tozeroy",
          mode: "lines",
        },
      ]}
      config={chartConfig}
      className="h-16 w-full sm:h-14 sm:w-64 lg:w-80"
    />
  );

  if (!isCollecting) {
    return <p className="text-muted-foreground text-sm">{t("experiment.quiet")}</p>;
  }

  return (
    <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline gap-2">
          <span className="text-foreground text-xl font-semibold tabular-nums">
            {format(scoped.measurements30d)}
          </span>
          <span className="text-muted-foreground text-sm">{t("experiment.measurements")}</span>
        </div>
        <span className="text-muted-foreground text-xs">
          {hasContributors
            ? t("experiment.byContributors", { count: scoped.contributors30d })
            : t("experiment.window")}
        </span>
      </div>
      {days.length > 1 ? renderTrend() : null}
    </section>
  );
}
