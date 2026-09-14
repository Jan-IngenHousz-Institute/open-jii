"use client";

import { ActivityStrip } from "@/components/metrics/activity-strip";

import type { ResourceKind, ResourceSeries } from "@repo/api/domains/metrics/metrics.schema";
import { useTranslation } from "@repo/i18n";

interface ResourceMetricsCellProps {
  activity: ResourceSeries | null;
  windowDays: number;
  /** What this kind counts: a macro run is an analysis, not a measurement. */
  kind: ResourceKind;
}

/** Drawn from the row's own list response, so a table of any size costs one request. */
export function ResourceMetricsCell({ activity, windowDays, kind }: ResourceMetricsCellProps) {
  const { t } = useTranslation("publicMetrics");

  if (activity === null) {
    return null;
  }

  return (
    <ActivityStrip
      days={activity.days}
      label={t("resourceMetrics.strip", {
        days: windowDays,
        unit: t(`resourceMetrics.${kind}.unit`),
      })}
    />
  );
}
