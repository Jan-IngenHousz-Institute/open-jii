"use client";

import { useResourceMetrics } from "~/hooks/metrics/useResourceMetrics/useResourceMetrics";
import { useLocale } from "~/hooks/useLocale";

import type { ResourceKind } from "@repo/api/domains/metrics/metrics.schema";
import { useTranslation } from "@repo/i18n";
import { Card } from "@repo/ui/components/card";

interface ResourceMetricsSummaryProps {
  kind: ResourceKind;
}

interface Stat {
  key: string;
  value: string;
}

/**
 * The activity behind a list page, above its table. Counts only what the
 * reader may see, so the figures agree with the rows underneath.
 */
export function ResourceMetricsSummary({ kind }: ResourceMetricsSummaryProps) {
  const { t } = useTranslation("publicMetrics");
  const locale = useLocale();
  const { data } = useResourceMetrics(kind);

  if (data === undefined || data.activeCount === 0) {
    return null;
  }

  const format = (value: number) => new Intl.NumberFormat(locale).format(value);
  const compact = (value: number) =>
    new Intl.NumberFormat(locale, { notation: "compact" }).format(value);

  const stats: Stat[] = [
    { key: "active", value: format(data.activeCount) },
    { key: "measurements", value: compact(data.totalMeasurements) },
  ];

  const renderStat = (stat: Stat) => (
    <div key={stat.key} className="flex flex-col">
      <span className="text-foreground text-xl font-semibold tabular-nums">{stat.value}</span>
      <span className="text-muted-foreground text-xs">
        {t(`resourceMetrics.${kind}.${stat.key}`, { days: data.windowDays })}
      </span>
    </div>
  );

  return (
    <Card className="flex flex-row flex-wrap gap-x-10 gap-y-3 p-5">{stats.map(renderStat)}</Card>
  );
}
