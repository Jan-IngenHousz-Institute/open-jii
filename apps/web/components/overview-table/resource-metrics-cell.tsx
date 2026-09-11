"use client";

import { ActivityStrip } from "@/components/metrics/activity-strip";

import type { ResourceSeries } from "@repo/api/domains/metrics/metrics.schema";
import { useTranslation } from "@repo/i18n";

interface ResourceMetricsCellProps {
  activity: ResourceSeries | null;
  windowDays: number;
}

/** Drawn from the row's own list response, so a table of any size costs one request. */
export function ResourceMetricsCell({ activity, windowDays }: ResourceMetricsCellProps) {
  const { t } = useTranslation("publicMetrics");

  if (activity === null) {
    return null;
  }

  return (
    <ActivityStrip days={activity.days} label={t("resourceMetrics.strip", { days: windowDays })} />
  );
}
