"use client";

import { useExperimentMetrics } from "~/hooks/metrics/useExperimentMetrics/useExperimentMetrics";
import { useLocale } from "~/hooks/useLocale";

import { useTranslation } from "@repo/i18n";
import { Trans } from "@repo/i18n/client";
import { AreaChart } from "@repo/ui/components/charts/area-chart";
import type { PlotlyChartConfig } from "@repo/ui/components/charts/types";
import { detectAxisType } from "@repo/ui/components/charts/utils";

interface ExperimentActivityPulseProps {
  experimentId: string;
}

/**
 * Whether this experiment is still collecting, answered on the page where the
 * question is asked. A silent experiment says so rather than disappearing:
 * absence of a reading is itself the answer here.
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

  const chartConfig: PlotlyChartConfig = {
    showLegend: false,
    showModeBar: false,
    showGrid: false,
    backgroundColor: "rgba(0,0,0,0)",
    height: 64,
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
      className="h-16 w-full max-w-xs"
    />
  );

  return (
    <section className="border-border flex flex-wrap items-center justify-between gap-4 rounded-lg border px-4 py-3">
      <p className="text-muted-foreground text-sm">
        {isCollecting ? (
          <Trans
            t={t}
            i18nKey="experiment.collecting"
            values={{
              measurements: format(scoped.measurements30d),
              contributors: format(scoped.contributors30d),
            }}
            components={{ em: <span className="text-foreground font-semibold" /> }}
          />
        ) : (
          t("experiment.quiet")
        )}
      </p>
      {days.length > 1 ? renderTrend() : null}
    </section>
  );
}
