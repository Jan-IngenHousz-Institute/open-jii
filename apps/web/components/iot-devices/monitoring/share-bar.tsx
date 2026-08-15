"use client";

import { useTranslation } from "@repo/i18n";
import { BarChart } from "@repo/ui/components/charts/bar-chart";

import { MONITORING_SERIES_COLORS } from "./monitoring-palette";

export interface ShareSegment {
  key: string;
  label: string;
  count: number;
}

interface ShareBarProps {
  segments: ShareSegment[];
  /** Row label shown on the category axis. */
  category: string;
}

/**
 * One composition read as proportions: a percent-normalized stacked bar, the
 * idiomatic answer to "is this one firmware or a split fleet". Preferred over
 * a pie, which makes small slices unreadable and comparisons harder.
 */
export function ShareBar({ segments, category }: ShareBarProps) {
  const { t } = useTranslation("iot");
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);

  if (total === 0) {
    return (
      <p className="text-muted-foreground text-xs">{t("iot.devices.monitoring.noBreakdown")}</p>
    );
  }

  return (
    <div className="h-24 w-full">
      <BarChart
        barmode="stack"
        barnorm="percent"
        data={segments.map((segment, index) => ({
          name: segment.label,
          x: [segment.count],
          y: [category],
          orientation: "h" as const,
          color: MONITORING_SERIES_COLORS[index % MONITORING_SERIES_COLORS.length],
        }))}
        config={{
          showLegend: true,
          legendPosition: "bottom",
          showModeBar: false,
          xAxisType: "linear",
          yAxisType: "category",
        }}
      />
    </div>
  );
}
