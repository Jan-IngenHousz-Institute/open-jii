"use client";

import { ActivityStrip } from "@/components/metrics/activity-strip";
import { useResourceMetrics } from "@/hooks/metrics/useResourceMetrics/useResourceMetrics";

import type { ResourceKind } from "@repo/api/domains/metrics/metrics.schema";
import { useTranslation } from "@repo/i18n";

interface ResourceMetricsCellProps {
  kind: ResourceKind;
  resourceId: string;
}

/**
 * A row's measurement activity. One query serves every row on the page: React
 * Query dedupes by key, so the table reads a single response rather than
 * fanning out per row.
 */
export function ResourceMetricsCell({ kind, resourceId }: ResourceMetricsCellProps) {
  const { t } = useTranslation("publicMetrics");
  const { data } = useResourceMetrics(kind);

  const resource = data?.resources.find((entry) => entry.id === resourceId);
  if (resource === undefined) {
    return null;
  }

  return (
    <ActivityStrip
      days={resource.days}
      label={t("resourceMetrics.strip", { days: data?.windowDays ?? 0 })}
    />
  );
}
